// List prompts tool implementation

import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { LangfuseAPIClient } from '../lib/langfuse-client.js';
import { CacheManager } from '../lib/cache.js';
import { ListPromptsParams, PaginatedResponse, PromptListItem } from '../types/index.js';

// Input schema for the tool
export const listPromptsSchema = z.object({
  name: z.string().optional().describe('Filter by prompt name (partial match)'),
  label: z.string().optional().describe("Filter by label (e.g., 'production', 'staging')"),
  tag: z.string().optional().describe('Filter by tag'),
  page: z.number().min(1).optional().describe('Page number for pagination'),
  limit: z.number().min(1).max(100).optional().describe('Number of results per page (default: 20, max: 100)'),
});

export type ListPromptsInput = z.infer<typeof listPromptsSchema>;

export async function createListPromptsHandler(client: LangfuseAPIClient) {
  const cache = CacheManager.getInstance().getCache<PaginatedResponse<PromptListItem>>('prompts-list', {
    ttl: 60, // 1 minute cache for list operations
  });

  return async function listPromptsHandler(input: ListPromptsInput): Promise<CallToolResult> {
    try {
      // Create cache key from parameters
      const cacheKey = JSON.stringify({
        name: input.name || '',
        label: input.label || '',
        tag: input.tag || '',
        page: input.page || 1,
        limit: input.limit || 20,
      });

      // Check cache first
      const cachedResult = cache.get(cacheKey);
      if (cachedResult) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              prompts: cachedResult.data,
              pagination: cachedResult.meta,
              cached: true,
            }, null, 2),
          }],
        };
      }

      // Fetch from API
      const params: ListPromptsParams = {
        name: input.name,
        label: input.label,
        tag: input.tag,
        page: input.page || 1,
        limit: input.limit || 20,
      };

      const response = await client.listPrompts(params);

      // Cache the result
      cache.set(cacheKey, response);

      // Format the response
      const result = {
        prompts: response.data.map(prompt => ({
          name: prompt.name,
          type: prompt.type,
          latestVersion: prompt.latestVersion,
          labels: prompt.labels,
          tags: prompt.tags,
          createdAt: prompt.createdAt,
          updatedAt: prompt.updatedAt,
        })),
        pagination: {
          page: response.meta.page,
          limit: response.meta.limit,
          totalPages: response.meta.totalPages,
          totalItems: response.meta.totalItems,
          hasNextPage: response.meta.page < response.meta.totalPages,
          hasPreviousPage: response.meta.page > 1,
        },
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
          text: `Error listing prompts: ${error.message}`,
        }],
        isError: true,
      };
    }
  };
}