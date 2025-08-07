// Update prompt labels tool implementation

import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { LangfuseAPIClient } from '../lib/langfuse-client.js';
import { CacheManager } from '../lib/cache.js';
import { UpdatePromptLabelsParams } from '../types/index.js';
import { validatePromptName, validateLabels } from '../lib/validation.js';

// Input schema for the tool
export const updatePromptLabelsSchema = z.object({
  name: z.string().describe('Prompt name'),
  version: z.number().positive().describe('Version to update'),
  newLabels: z.array(z.string()).describe('New labels to set (replaces existing labels)'),
});

export type UpdatePromptLabelsInput = z.infer<typeof updatePromptLabelsSchema>;

export async function createUpdatePromptLabelsHandler(client: LangfuseAPIClient) {
  const cache = CacheManager.getInstance();

  return async function updatePromptLabelsHandler(input: UpdatePromptLabelsInput): Promise<CallToolResult> {
    try {
      // Validate inputs
      validatePromptName(input.name);
      validateLabels(input.newLabels);

      // Prepare update params
      const params: UpdatePromptLabelsParams = {
        name: input.name,
        version: input.version,
        newLabels: input.newLabels,
      };

      // Update the labels
      const updatedPrompt = await client.updatePromptLabels(params);

      // Invalidate caches
      cache.getCache('prompts-list').clear(); // Clear list cache
      cache.getCache('prompts').invalidatePattern(input.name); // Clear specific prompt caches

      // Format the response
      const result = {
        success: true,
        prompt: {
          name: updatedPrompt.name,
          version: updatedPrompt.version,
          type: updatedPrompt.type,
          labels: updatedPrompt.labels,
          previousLabels: input.newLabels, // Note: API doesn't return previous labels
          updatedAt: updatedPrompt.updatedAt,
        },
        message: `Successfully updated labels for '${input.name}' version ${input.version}`,
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
          text: `Error updating prompt labels: ${error.message}`,
        }],
        isError: true,
      };
    }
  };
}