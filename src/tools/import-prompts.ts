// Import prompts tool implementation

import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { LangfuseAPIClient } from '../lib/langfuse-client.js';
import { CacheManager } from '../lib/cache.js';
import { CreatePromptParams } from '../types/index.js';
import {
  validatePromptName,
  validatePromptContent,
  validateLabels,
  validateTags,
  validatePromptConfig,
} from '../lib/validation.js';

// Schema for imported prompt
const importedPromptSchema = z.object({
  name: z.string(),
  type: z.enum(['text', 'chat']),
  prompt: z.union([z.string(), z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  }))]),
  config: z.object({
    model: z.string().optional(),
    temperature: z.number().optional(),
    maxTokens: z.number().optional(),
    topP: z.number().optional(),
    frequencyPenalty: z.number().optional(),
    presencePenalty: z.number().optional(),
    stopSequences: z.array(z.string()).optional(),
  }).optional(),
  labels: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  commitMessage: z.string().optional(),
});

// Input schema for the tool
export const importPromptsSchema = z.object({
  data: z.string().describe('JSON or JSONL formatted prompt data to import'),
  overwriteExisting: z.boolean().optional().default(false).describe('Overwrite existing prompts with same name'),
  dryRun: z.boolean().optional().default(false).describe('Validate without actually importing'),
});

export type ImportPromptsInput = z.infer<typeof importPromptsSchema>;

export async function createImportPromptsHandler(client: LangfuseAPIClient) {
  const cache = CacheManager.getInstance();

  return async function importPromptsHandler(input: ImportPromptsInput): Promise<CallToolResult> {
    try {
      // Parse import data
      let prompts: any[] = [];
      
      // Try to parse as JSON first
      try {
        const parsed = JSON.parse(input.data);
        if (parsed.prompts && Array.isArray(parsed.prompts)) {
          prompts = parsed.prompts;
        } else if (Array.isArray(parsed)) {
          prompts = parsed;
        } else {
          prompts = [parsed];
        }
      } catch {
        // Try JSONL format
        const lines = input.data.trim().split('\n');
        for (const line of lines) {
          if (line.trim()) {
            prompts.push(JSON.parse(line));
          }
        }
      }

      if (prompts.length === 0) {
        throw new Error('No valid prompts found in import data');
      }

      // Validate all prompts first
      const validationResults: any[] = [];
      for (const prompt of prompts) {
        try {
          const parsed = importedPromptSchema.parse(prompt);
          validatePromptName(parsed.name);
          validatePromptContent(parsed.type, parsed.prompt);
          if (parsed.labels) validateLabels(parsed.labels);
          if (parsed.tags) validateTags(parsed.tags);
          if (parsed.config) validatePromptConfig(parsed.config);
          
          validationResults.push({
            name: parsed.name,
            valid: true,
            data: parsed,
          });
        } catch (error: any) {
          validationResults.push({
            name: prompt.name || 'unknown',
            valid: false,
            error: error.message,
          });
        }
      }

      // Check validation results
      const validPrompts = validationResults.filter(r => r.valid);
      const invalidPrompts = validationResults.filter(r => !r.valid);

      if (input.dryRun) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              dryRun: true,
              totalPrompts: prompts.length,
              validPrompts: validPrompts.length,
              invalidPrompts: invalidPrompts.length,
              validationResults: validationResults.map(r => ({
                name: r.name,
                valid: r.valid,
                error: r.error,
              })),
            }, null, 2),
          }],
        };
      }

      // Import valid prompts
      const importResults: any[] = [];
      for (const validPrompt of validPrompts) {
        try {
          // Check if prompt exists
          let shouldCreate = true;
          if (!input.overwriteExisting) {
            try {
              await client.getPrompt({ name: validPrompt.data.name });
              shouldCreate = false;
              importResults.push({
                name: validPrompt.data.name,
                success: false,
                skipped: true,
                reason: 'Prompt already exists (use overwriteExisting to replace)',
              });
            } catch {
              // Prompt doesn't exist, proceed with creation
            }
          }

          if (shouldCreate) {
            const params: CreatePromptParams = {
              name: validPrompt.data.name,
              type: validPrompt.data.type,
              prompt: validPrompt.data.prompt,
              config: validPrompt.data.config,
              labels: validPrompt.data.labels || [],
              tags: validPrompt.data.tags || [],
              commitMessage: validPrompt.data.commitMessage || 'Imported prompt',
            };

            const created = await client.createPrompt(params);
            importResults.push({
              name: created.name,
              success: true,
              version: created.version,
            });
          }
        } catch (error: any) {
          importResults.push({
            name: validPrompt.data.name,
            success: false,
            error: error.message,
          });
        }
      }

      // Clear caches
      cache.getCache('prompts-list').clear();
      cache.getCache('prompts').clear();

      // Summary
      const summary = {
        totalProcessed: prompts.length,
        totalValid: validPrompts.length,
        totalInvalid: invalidPrompts.length,
        totalImported: importResults.filter(r => r.success && !r.skipped).length,
        totalSkipped: importResults.filter(r => r.skipped).length,
        totalFailed: importResults.filter(r => !r.success && !r.skipped).length,
        results: importResults,
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error importing prompts: ${error.message}`,
        }],
        isError: true,
      };
    }
  };
}