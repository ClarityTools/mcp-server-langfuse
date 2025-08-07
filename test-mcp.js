#!/usr/bin/env node
// Test MCP protocol functionality

import { spawn } from 'child_process';

console.log('Testing MCP Server Protocol...\n');

// Set test environment variables
const env = {
  ...process.env,
  LANGFUSE_PUBLIC_KEY: 'test-pk',
  LANGFUSE_SECRET_KEY: 'test-sk'
};

// Start the server
const server = spawn('node', ['build/index.js'], {
  env,
  stdio: ['pipe', 'pipe', 'pipe']
});

// Send initialize request
const initRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  }
};

console.log('Sending initialize request...');
server.stdin.write(JSON.stringify(initRequest) + '\n');

// Handle responses
let buffer = '';
server.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);
        console.log('Response:', JSON.stringify(response, null, 2));
        
        // After initialize, list tools
        if (response.id === 1 && response.result) {
          console.log('\n✅ Server initialized successfully!');
          console.log('Capabilities:', response.result.capabilities);
          
          // Send tools/list request
          const toolsRequest = {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list',
            params: {}
          };
          console.log('\nListing available tools...');
          server.stdin.write(JSON.stringify(toolsRequest) + '\n');
        } else if (response.id === 2 && response.result) {
          console.log('\n✅ Tools listed successfully!');
          console.log(`Found ${response.result.tools.length} tools`);
          response.result.tools.forEach(tool => {
            console.log(`  - ${tool.name}: ${tool.description}`);
          });
          
          // Clean exit
          server.kill();
          process.exit(0);
        }
      } catch (e) {
        // Skip non-JSON output
      }
    }
  }
});

server.stderr.on('data', (data) => {
  const msg = data.toString();
  if (!msg.includes('running on stdio')) {
    console.error('Server error:', msg);
  }
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Timeout after 5 seconds
setTimeout(() => {
  console.error('\n❌ Test timed out');
  server.kill();
  process.exit(1);
}, 5000);