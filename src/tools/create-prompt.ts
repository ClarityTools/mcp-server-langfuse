// Create prompt tool implementation

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
  extractVariables,
} from '../lib/validation.js';

// Chat message schema
const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']).describe('Message role'),
  content: z.string().describe('Message content'),
});

// Prompt config schema
const promptConfigSchema = z.object({
  model: z.string().optional().describe('Model name'),
  temperature: z.number().min(0).max(2).optional().describe('Temperature (0-2)'),
  maxTokens: z.number().positive().optional().describe('Maximum tokens'),
  topP: z.number().min(0).max(1).optional().describe('Top P (0-1)'),
  frequencyPenalty: z.number().min(-2).max(2).optional().describe('Frequency penalty (-2 to 2)'),
  presencePenalty: z.number().min(-2).max(2).optional().describe('Presence penalty (-2 to 2)'),
  stopSequences: z.array(z.string()).optional().describe('Stop sequences'),
}).optional();

// Input schema for the tool
export const createPromptSchema = z.object({
  name: z.string().describe('Prompt name'),
  type: z.enum(['text', 'chat']).describe('Prompt type'),
  prompt: z.union([
    z.string().describe('Text prompt content'),
    z.array(chatMessageSchema).describe('Chat prompt messages'),
  ]).describe('Prompt content (string for text, array for chat)'),
  config: promptConfigSchema.describe('Model configuration'),
  labels: z.array(z.string()).optional().describe('Labels to assign'),
  tags: z.array(z.string()).optional().describe('Tags for categorization'),
  commitMessage: z.string().optional().describe('Version commit message'),
});

export type CreatePromptInput = z.infer<typeof createPromptSchema>;

export async function createCreatePromptHandler(client: LangfuseAPIClient) {
  const cache = CacheManager.getInstance();

  return async function createPromptHandler(input: CreatePromptInput): Promise<CallToolResult> {
    try {
      // Validate inputs
      validatePromptName(input.name);
      validatePromptContent(input.type, input.prompt);
      
      if (input.labels) {
        validateLabels(input.labels);
      }
      
      if (input.tags) {
        validateTags(input.tags);
      }
      
      if (input.config) {
        validatePromptConfig(input.config);
      }

      // Prepare create params
      const params: CreatePromptParams = {
        name: input.name,
        type: input.type,
        prompt: input.prompt,
        config: input.config,
        labels: input.labels || [],
        tags: input.tags || [],
        commitMessage: input.commitMessage,
      };

      // Create the prompt
      const createdPrompt = await client.createPrompt(params);

      // Invalidate caches
      cache.getCache('prompts-list').clear(); // Clear list cache
      cache.getCache('prompts').invalidatePattern(input.name); // Clear specific prompt caches

      // Extract variables
      const variables = extractVariables(createdPrompt.prompt);

      // Format the response
      const result = {
        success: true,
        prompt: {
          name: createdPrompt.name,
          version: createdPrompt.version,
          type: createdPrompt.type,
          prompt: createdPrompt.prompt,
          config: createdPrompt.config,
          labels: createdPrompt.labels,
          tags: createdPrompt.tags,
          variables,
          createdAt: createdPrompt.createdAt,
          commitMessage: createdPrompt.commitMessage,
        },
        message: `Successfully created prompt '${input.name}' version ${createdPrompt.version}`,
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error creating prompt: ${error.message}`,
        }],
        isError: true,
      };
    }
  };
}