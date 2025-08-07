// Delete prompt tool implementation (placeholder until API support)

import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { LangfuseAPIClient } from '../lib/langfuse-client.js';
import { validatePromptName } from '../lib/validation.js';

// Input schema for the tool
export const deletePromptSchema = z.object({
  name: z.string().describe('Prompt name'),
  version: z.number().positive().optional().describe('Specific version to delete'),
  deleteAll: z.boolean().optional().describe('Delete all versions of the prompt'),
});

export type DeletePromptInput = z.infer<typeof deletePromptSchema>;

export async function createDeletePromptHandler(client: LangfuseAPIClient) {
  return async function deletePromptHandler(input: DeletePromptInput): Promise<CallToolResult> {
    try {
      // Validate inputs
      validatePromptName(input.name);

      // Check for conflicting parameters
      if (input.version && input.deleteAll) {
        throw new Error('Cannot specify both version and deleteAll');
      }

      // Attempt to delete (will throw NotImplementedError)
      await client.deletePrompt({
        name: input.name,
        version: input.version,
      });

      // This code won't be reached until API support is added
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Successfully deleted prompt '${input.name}'`,
          }, null, 2),
        }],
      };
    } catch (error: any) {
      // Special handling for not implemented error
      if (error.status === 501) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 'Delete operation not yet supported',
              message: 'The Langfuse API does not currently support deleting prompts. This feature is being tracked at: https://github.com/langfuse/langfuse/issues/7693',
              workaround: 'Consider using labels to mark prompts as deprecated or archived instead.',
            }, null, 2),
          }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text',
          text: `Error deleting prompt: ${error.message}`,
        }],
        isError: true,
      };
    }
  };
}