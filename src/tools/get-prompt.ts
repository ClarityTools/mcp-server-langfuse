// Get prompt tool implementation

import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { LangfuseAPIClient } from '../lib/langfuse-client.js';
import { CacheManager } from '../lib/cache.js';
import { PromptVersion } from '../types/index.js';
import { extractVariables, compilePrompt } from '../lib/validation.js';

// Input schema for the tool
export const getPromptSchema = z.object({
  name: z.string().describe('Prompt name'),
  version: z.number().optional().describe('Specific version number'),
  label: z.string().optional().describe("Label to fetch (e.g., 'production', 'latest')"),
  arguments: z.record(z.string()).optional().describe('Arguments to compile the prompt with'),
});

export type GetPromptInput = z.infer<typeof getPromptSchema>;

export async function createGetPromptHandler(client: LangfuseAPIClient) {
  const cache = CacheManager.getInstance().getCache<PromptVersion>('prompts', {
    ttl: 300, // 5 minutes cache for individual prompts
  });

  return async function getPromptHandler(input: GetPromptInput): Promise<CallToolResult> {
    try {
      // Create cache key
      const cacheKey = `${input.name}:${input.version || 'latest'}:${input.label || ''}`;

      // Check cache first
      const cachedPrompt = cache.get(cacheKey);
      let prompt: PromptVersion;

      if (cachedPrompt) {
        prompt = cachedPrompt;
      } else {
        // Fetch from API
        prompt = await client.getPrompt({
          name: input.name,
          version: input.version,
          label: input.label,
        });

        // Cache the result
        cache.set(cacheKey, prompt);
      }

      // Extract variables
      const variables = extractVariables(prompt.prompt);

      // Compile prompt if arguments provided
      let compiledPrompt = prompt.prompt;
      if (input.arguments && Object.keys(input.arguments).length > 0) {
        compiledPrompt = compilePrompt(prompt.prompt, input.arguments);
      }

      // Format the response
      const result = {
        name: prompt.name,
        version: prompt.version,
        type: prompt.type,
        prompt: compiledPrompt,
        originalPrompt: prompt.prompt,
        config: prompt.config,
        labels: prompt.labels,
        tags: prompt.tags,
        variables,
        providedArguments: input.arguments || {},
        missingArguments: variables.filter(v => !input.arguments?.[v]),
        createdAt: prompt.createdAt,
        updatedAt: prompt.updatedAt,
        commitMessage: prompt.commitMessage,
        cached: !!cachedPrompt,
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
          text: `Error getting prompt: ${error.message}`,
        }],
        isError: true,
      };
    }
  };
}