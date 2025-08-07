// Export prompts tool implementation

import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { LangfuseAPIClient } from '../lib/langfuse-client.js';

// Input schema for the tool
export const exportPromptsSchema = z.object({
  names: z.array(z.string()).optional().describe('Specific prompt names to export (exports all if not specified)'),
  includeAllVersions: z.boolean().optional().default(false).describe('Export all versions or just latest'),
  format: z.enum(['json', 'jsonl']).optional().default('json').describe('Export format'),
});

export type ExportPromptsInput = z.infer<typeof exportPromptsSchema>;

export async function createExportPromptsHandler(client: LangfuseAPIClient) {
  return async function exportPromptsHandler(input: ExportPromptsInput): Promise<CallToolResult> {
    try {
      const exportData: any[] = [];
      let promptNames: string[] = [];

      // Get list of prompts to export
      if (input.names && input.names.length > 0) {
        promptNames = input.names;
      } else {
        // Fetch all prompt names
        const allPrompts = await client.listPrompts({ limit: 100 });
        promptNames = allPrompts.data.map(p => p.name);
        
        // Handle pagination if needed
        if (allPrompts.meta.totalPages > 1) {
          for (let page = 2; page <= allPrompts.meta.totalPages; page++) {
            const pageData = await client.listPrompts({ page, limit: 100 });
            promptNames.push(...pageData.data.map(p => p.name));
          }
        }
      }

      // Export each prompt
      for (const name of promptNames) {
        try {
          if (input.includeAllVersions) {
            // Get all versions (would need API support for listing versions)
            // For now, just get the latest
            const prompt = await client.getPrompt({ name });
            exportData.push({
              name: prompt.name,
              version: prompt.version,
              type: prompt.type,
              prompt: prompt.prompt,
              config: prompt.config,
              labels: prompt.labels,
              tags: prompt.tags,
              commitMessage: prompt.commitMessage,
              createdAt: prompt.createdAt,
            });
          } else {
            // Get latest version
            const prompt = await client.getPrompt({ name, label: 'latest' });
            exportData.push({
              name: prompt.name,
              version: prompt.version,
              type: prompt.type,
              prompt: prompt.prompt,
              config: prompt.config,
              labels: prompt.labels,
              tags: prompt.tags,
              commitMessage: prompt.commitMessage,
              createdAt: prompt.createdAt,
            });
          }
        } catch (error: any) {
          // Include error in export for failed prompts
          exportData.push({
            name,
            error: error.message,
          });
        }
      }

      // Format output based on requested format
      let output: string;
      if (input.format === 'jsonl') {
        output = exportData.map(item => JSON.stringify(item)).join('\n');
      } else {
        output = JSON.stringify({
          exportedAt: new Date().toISOString(),
          totalPrompts: exportData.length,
          prompts: exportData,
        }, null, 2);
      }

      return {
        content: [{
          type: 'text',
          text: output,
        }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error exporting prompts: ${error.message}`,
        }],
        isError: true,
      };
    }
  };
}