# Langfuse Prompt Management MCP Server

[Model Context Protocol](https://github.com/modelcontextprotocol) (MCP) Server for [Langfuse Prompt Management](https://langfuse.com/docs/prompts/get-started) with comprehensive CRUD operations. This server allows you to access, create, update, and manage your Langfuse prompts through the Model Context Protocol.

## Demo

Quick demo of Langfuse Prompts MCP in Claude Desktop (_unmute for voice-over explanations_):

https://github.com/user-attachments/assets/61da79af-07c2-4f69-b28c-ca7c6e606405

## Features

### Full CRUD Operations

This server extends the original read-only implementation with complete prompt management capabilities:

- **List Prompts** - Filter, paginate, and search through all prompts
- **Get Prompt** - Retrieve specific versions with variable compilation
- **Create Prompt** - Create new prompts or versions with validation
- **Update Labels** - Manage prompt version labels
- **Delete Prompt** - Remove prompts (pending API support)
- **Batch Operations** - Update multiple prompts efficiently
- **Import/Export** - Backup and migrate prompts in JSON/JSONL format

### MCP Prompt Compatibility

The server maintains backward compatibility with the [MCP Prompts specification](https://modelcontextprotocol.io/docs/concepts/prompts):

- `prompts/list`: List all available prompts with pagination
- `prompts/get`: Get and compile specific prompts

### Enhanced Tools

All functionality is exposed through MCP tools for maximum compatibility:

- `list-prompts`: List prompts with advanced filtering
  - Filter by name (partial match), label, or tag
  - Pagination support with customizable page size
  - Returns prompt metadata and variables

- `get-prompt`: Retrieve and compile specific prompts
  - Support for version and label selection
  - Automatic variable extraction and compilation
  - Returns both original and compiled content

- `create-prompt`: Create new prompts or versions
  - Support for text and chat prompts
  - Model configuration options
  - Label and tag management
  - Validation for all inputs

- `update-prompt-labels`: Update version labels
  - Replace labels for specific versions
  - Validation to prevent reserved label usage

- `batch-update-labels`: Bulk label updates
  - Update up to 50 prompts in one operation
  - Efficient parallel processing

- `export-prompts`: Export for backup/migration
  - Export all or specific prompts
  - JSON and JSONL format support
  - Include all versions or just latest

- `import-prompts`: Import from backup
  - Validation before import
  - Dry-run mode for testing
  - Overwrite protection

### Additional Features

- **Caching**: Built-in performance optimization with TTL
- **Error Handling**: Comprehensive error types with retry logic
- **Validation**: Input validation for all operations
- **Type Safety**: Full TypeScript support

## Installation & Usage

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Configure Environment

Set the following environment variables:

```bash
# Required
export LANGFUSE_PUBLIC_KEY="pk-lf-..."
export LANGFUSE_SECRET_KEY="sk-lf-..."

# Optional
export LANGFUSE_BASEURL="https://cloud.langfuse.com"  # Default
export LANGFUSE_REQUEST_TIMEOUT="30000"               # Default: 30s
export LANGFUSE_MAX_RETRIES="3"                       # Default: 3
```

### Step 3: Build

```bash
npm run build
```

### Step 4: Add to MCP Client

#### Claude Desktop

Configure Claude for Desktop by editing `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "langfuse": {
      "command": "node",
      "args": ["<absolute-path>/build/index.js"],
      "env": {
        "LANGFUSE_PUBLIC_KEY": "pk-lf-...",
        "LANGFUSE_SECRET_KEY": "sk-lf-...",
        "LANGFUSE_BASEURL": "https://cloud.langfuse.com"
      }
    }
  }
}
```

#### Other MCP Clients

For other MCP-compatible clients, use:
- Command: `node <absolute-path>/build/index.js`
- Environment variables as shown above

## Usage Examples

### Creating a Chat Prompt

```typescript
// Using the create-prompt tool
{
  "name": "customer-support/greeting",
  "type": "chat",
  "prompt": [
    {
      "role": "system",
      "content": "You are a helpful customer support agent."
    },
    {
      "role": "user",
      "content": "Hello, I need help with {{issue}}"
    }
  ],
  "labels": ["production"],
  "tags": ["support", "greeting"],
  "commitMessage": "Initial greeting prompt"
}
```

### Filtering Prompts

```typescript
// List all production prompts with "support" tag
{
  "label": "production",
  "tag": "support",
  "limit": 20
}
```

### Batch Label Updates

```typescript
// Update multiple prompts to staging
{
  "updates": [
    { "name": "prompt-1", "version": 1, "newLabels": ["staging"] },
    { "name": "prompt-2", "version": 3, "newLabels": ["staging"] }
  ]
}
```

### Export/Import

```typescript
// Export all prompts
{ "format": "json" }

// Import with validation
{
  "data": "...",
  "dryRun": true,  // Test first
  "overwriteExisting": false
}
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Development with hot reload
npm run dev

# Run tests
npm test
npm run test:coverage

# Type checking
npm run typecheck

# Linting
npm run lint

# Test in MCP Inspector
npx @modelcontextprotocol/inspector node ./build/index.js
```

## API Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LANGFUSE_PUBLIC_KEY` | Yes | - | Your Langfuse public key |
| `LANGFUSE_SECRET_KEY` | Yes | - | Your Langfuse secret key |
| `LANGFUSE_BASEURL` | No | `https://cloud.langfuse.com` | Langfuse API URL |
| `LANGFUSE_REQUEST_TIMEOUT` | No | `30000` | Request timeout in ms |
| `LANGFUSE_MAX_RETRIES` | No | `3` | Max retry attempts |

### Error Types

- `APIError` - API request failures (status, message, details)
- `ValidationError` - Input validation failures (field, constraint)
- `AuthenticationError` - Authentication failures
- `RateLimitError` - Rate limit exceeded (includes retry-after)

## Changes from v1

- Added full CRUD operations (create, update, delete)
- Enhanced filtering and search capabilities
- Batch operations support
- Import/export functionality
- Built-in caching layer
- Comprehensive error handling
- TypeScript rewrite with full type safety
- Improved validation and security

## Limitations

- Delete operations pending Langfuse API support ([track issue](https://github.com/langfuse/langfuse/issues/7693))
- Rate limited to 1000 requests/minute
- Maximum 50 items for batch operations
- Cache TTL not configurable per-operation

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a PR with clear description

## License

MIT

## Support

- [Langfuse Documentation](https://langfuse.com/docs)
- [GitHub Issues](https://github.com/langfuse/mcp-server-langfuse/issues)
- [Discord Community](https://discord.gg/langfuse)
