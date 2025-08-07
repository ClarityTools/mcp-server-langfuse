#!/usr/bin/env node
// Main entry point for Langfuse MCP Server with full CRUD operations

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequest,
  GetPromptRequest,
  ListPromptsResult,
  GetPromptResult,
} from '@modelcontextprotocol/sdk/types.js';
import { LangfuseAPIClient } from './lib/langfuse-client.js';
import { LangfuseConfig } from './types/index.js';

// Import tool handlers
import { createListPromptsHandler, listPromptsSchema } from './tools/list-prompts.js';
import { createGetPromptHandler, getPromptSchema } from './tools/get-prompt.js';
import { createCreatePromptHandler, createPromptSchema } from './tools/create-prompt.js';
import { createUpdatePromptLabelsHandler, updatePromptLabelsSchema } from './tools/update-prompt-labels.js';
import { createDeletePromptHandler, deletePromptSchema } from './tools/delete-prompt.js';
import { createBatchUpdateLabelsHandler, batchUpdateLabelsSchema } from './tools/batch-update-labels.js';
import { createExportPromptsHandler, exportPromptsSchema } from './tools/export-prompts.js';
import { createImportPromptsHandler, importPromptsSchema } from './tools/import-prompts.js';

// Get configuration from environment
function getConfig(): LangfuseConfig {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const baseUrl = process.env.LANGFUSE_BASEURL || 'https://cloud.langfuse.com';

  if (!publicKey || !secretKey) {
    throw new Error(
      'Missing required environment variables: LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY'
    );
  }

  return {
    publicKey,
    secretKey,
    baseUrl,
    requestTimeout: parseInt(process.env.LANGFUSE_REQUEST_TIMEOUT || '30000'),
    maxRetries: parseInt(process.env.LANGFUSE_MAX_RETRIES || '3'),
  };
}

async function main() {
  try {
    // Initialize configuration
    const config = getConfig();
    
    // Create Langfuse API client
    const langfuseClient = new LangfuseAPIClient(config);

    // Create MCP server with both prompts and tools capabilities
    const server = new McpServer(
      {
        name: 'langfuse-prompt-management',
        version: '2.0.0',
      },
      {
        capabilities: {
          prompts: {}, // For compatibility with MCP prompts spec
          tools: {},   // For CRUD operations
        },
      }
    );

    // Create tool handlers
    const listPromptsHandler = await createListPromptsHandler(langfuseClient);
    const getPromptHandler = await createGetPromptHandler(langfuseClient);
    const createPromptHandler = await createCreatePromptHandler(langfuseClient);
    const updatePromptLabelsHandler = await createUpdatePromptLabelsHandler(langfuseClient);
    const deletePromptHandler = await createDeletePromptHandler(langfuseClient);
    const batchUpdateLabelsHandler = await createBatchUpdateLabelsHandler(langfuseClient);
    const exportPromptsHandler = await createExportPromptsHandler(langfuseClient);
    const importPromptsHandler = await createImportPromptsHandler(langfuseClient);

    // Register prompts capability handlers for backward compatibility
    server.server.setRequestHandler(
      ListPromptsRequestSchema,
      async (request: ListPromptsRequest): Promise<ListPromptsResult> => {
        const result = await listPromptsHandler({
          page: request.params?.cursor ? parseInt(request.params.cursor) : undefined,
        });
        
        // Parse the result and convert to prompts format
        const data = JSON.parse(result.content[0].text as string);
        return {
          prompts: data.prompts.map((p: any) => ({
            name: p.name,
            arguments: p.variables?.map((v: string) => ({
              name: v,
              required: false,
            })) || [],
          })),
          nextCursor: data.pagination?.hasNextPage ? 
            (data.pagination.page + 1).toString() : undefined,
        };
      }
    );

    server.server.setRequestHandler(
      GetPromptRequestSchema,
      async (request: GetPromptRequest): Promise<GetPromptResult> => {
        const result = await getPromptHandler({
          name: request.params.name,
          arguments: request.params.arguments,
        });
        
        // Parse the result and convert to prompt messages format
        const data = JSON.parse(result.content[0].text as string);
        
        if (data.type === 'chat' && Array.isArray(data.prompt)) {
          return {
            messages: data.prompt.map((msg: any) => ({
              role: msg.role === 'system' ? 'user' : msg.role,
              content: {
                type: 'text',
                text: msg.content,
              },
            })),
          };
        } else {
          return {
            messages: [{
              role: 'user',
              content: {
                type: 'text',
                text: data.prompt,
              },
            }],
          };
        }
      }
    );

    // Register all CRUD tools
    server.tool(
      'list-prompts',
      'List all prompts with filtering, pagination, and search',
      listPromptsSchema.shape,
      listPromptsHandler
    );

    server.tool(
      'get-prompt',
      'Get a specific prompt by name with optional version/label',
      getPromptSchema.shape,
      getPromptHandler
    );

    server.tool(
      'create-prompt',
      'Create a new prompt or add a new version to existing prompt',
      createPromptSchema.shape,
      createPromptHandler
    );

    server.tool(
      'update-prompt-labels',
      'Update labels for a specific prompt version',
      updatePromptLabelsSchema.shape,
      updatePromptLabelsHandler
    );

    server.tool(
      'delete-prompt',
      'Delete a prompt or specific version (not yet available in API)',
      deletePromptSchema.shape,
      deletePromptHandler
    );

    server.tool(
      'batch-update-labels',
      'Update labels for multiple prompt versions in a single operation',
      batchUpdateLabelsSchema.shape,
      batchUpdateLabelsHandler
    );

    server.tool(
      'export-prompts',
      'Export prompts to JSON or JSONL format for backup/migration',
      exportPromptsSchema.shape,
      exportPromptsHandler
    );

    server.tool(
      'import-prompts',
      'Import prompts from JSON or JSONL format',
      importPromptsSchema.shape,
      importPromptsHandler
    );

    // Start the server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error('Langfuse Prompt Management MCP Server v2.0.0 running on stdio');
    console.error('Connected to:', config.baseUrl);
  } catch (error: any) {
    console.error('Fatal error starting server:', error.message);
    process.exit(1);
  }
}

// Run the server
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});