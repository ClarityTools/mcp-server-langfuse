#!/usr/bin/env node
// Test MCP server with real API - call a tool

import { spawn } from 'child_process';

console.log('Testing MCP Server with real Langfuse API...\n');

// Start the server with real credentials
const server = spawn('node', ['build/index.js'], {
  env: {
    ...process.env,
    LANGFUSE_PUBLIC_KEY: 'pk-lf-4303bdc2-c594-4e96-9501-b4f28d58d79f',
    LANGFUSE_SECRET_KEY: 'sk-lf-23851c8d-3a80-49a3-ae27-73a6bfa15a80',
    LANGFUSE_BASEURL: 'https://us.cloud.langfuse.com'
  },
  stdio: ['pipe', 'pipe', 'pipe']
});

let buffer = '';
let requestId = 1;

function sendRequest(method, params = {}) {
  const request = {
    jsonrpc: '2.0',
    id: requestId++,
    method,
    params
  };
  console.log(`\nSending ${method} request...`);
  server.stdin.write(JSON.stringify(request) + '\n');
}

server.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);
        
        if (response.error) {
          console.error('Error:', response.error);
        } else if (response.result) {
          console.log('Response received!');
          
          // Handle different responses
          if (response.id === 1) {
            console.log('✅ Server initialized');
            console.log('Capabilities:', response.result.capabilities);
            
            // List prompts using the tool
            sendRequest('tools/call', {
              name: 'list-prompts',
              arguments: { limit: 3 }
            });
            
          } else if (response.id === 2) {
            console.log('✅ Tool executed successfully!');
            const content = response.result.content[0].text;
            const data = JSON.parse(content);
            console.log(`Found ${data.prompts.length} prompts:`);
            data.prompts.forEach(p => console.log(`  - ${p.name} (${p.type})`));
            
            // Get specific prompt if any exist
            if (data.prompts.length > 0) {
              sendRequest('tools/call', {
                name: 'get-prompt',
                arguments: { 
                  name: data.prompts[0].name,
                  arguments: {}
                }
              });
            } else {
              server.kill();
              process.exit(0);
            }
            
          } else if (response.id === 3) {
            console.log('✅ Got prompt details!');
            const content = response.result.content[0].text;
            const prompt = JSON.parse(content);
            console.log('Prompt:', {
              name: prompt.name,
              type: prompt.type,
              version: prompt.version,
              variables: prompt.variables
            });
            
            // Success - clean exit
            console.log('\n🎉 All tests passed! MCP server works with real API!');
            server.kill();
            process.exit(0);
          }
        }
      } catch (e) {
        // Skip non-JSON output
      }
    }
  }
});

server.stderr.on('data', (data) => {
  const msg = data.toString();
  if (!msg.includes('running on stdio') && !msg.includes('Connected to:')) {
    console.error('Server error:', msg);
  }
});

// Initialize
sendRequest('initialize', {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: {
    name: 'test-client',
    version: '1.0.0'
  }
});

// Timeout
setTimeout(() => {
  console.error('\n❌ Test timed out');
  server.kill();
  process.exit(1);
}, 10000);