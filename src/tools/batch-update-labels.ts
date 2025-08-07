// Batch update labels tool implementation

import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { LangfuseAPIClient } from '../lib/langfuse-client.js';
import { CacheManager } from '../lib/cache.js';
import { validatePromptName, validateLabels } from '../lib/validation.js';

// Schema for individual update
const updateItemSchema = z.object({
  name: z.string().describe('Prompt name'),
  version: z.number().positive().describe('Version to update'),
  newLabels: z.array(z.string()).describe('New labels to set'),
});

// Input schema for the tool
export const batchUpdateLabelsSchema = z.object({
  updates: z.array(updateItemSchema).min(1).max(50).describe('Array of label updates to perform (max 50)'),
});

export type BatchUpdateLabelsInput = z.infer<typeof batchUpdateLabelsSchema>;

export async function createBatchUpdateLabelsHandler(client: LangfuseAPIClient) {
  const cache = CacheManager.getInstance();

  return async function batchUpdateLabelsHandler(input: BatchUpdateLabelsInput): Promise<CallToolResult> {
    try {
      // Validate all inputs first
      for (const update of input.updates) {
        validatePromptName(update.name);
        validateLabels(update.newLabels);
      }

      // Perform batch update
      const results = await client.batchUpdateLabels(input.updates);

      // Invalidate caches
      cache.getCache('prompts-list').clear();
      const promptCache = cache.getCache('prompts');
      for (const update of input.updates) {
        promptCache.invalidatePattern(update.name);
      }

      // Format results
      const successCount = results.length;
      const summary = {
        totalRequested: input.updates.length,
        totalSuccessful: successCount,
        totalFailed: input.updates.length - successCount,
        results: results.map((prompt, index) => ({
          name: prompt.name,
          version: prompt.version,
          labels: prompt.labels,
          success: true,
          requestIndex: index,
        })),
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
          text: `Error in batch update: ${error.message}`,
        }],
        isError: true,
      };
    }
  };
}