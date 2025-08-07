#!/usr/bin/env node
// Test with real Langfuse API

import { LangfuseAPIClient } from './build/lib/langfuse-client.js';

console.log('Testing with real Langfuse API...\n');

const client = new LangfuseAPIClient({
  publicKey: 'pk-lf-4303bdc2-c594-4e96-9501-b4f28d58d79f',
  secretKey: 'sk-lf-23851c8d-3a80-49a3-ae27-73a6bfa15a80',
  baseUrl: 'https://us.cloud.langfuse.com'
});

async function test() {
  try {
    // Test 1: List prompts
    console.log('1. Listing prompts...');
    const prompts = await client.listPrompts({ limit: 5 });
    console.log(`✅ Found ${prompts.data.length} prompts`);
    if (prompts.data.length > 0) {
      console.log('First prompt:', prompts.data[0].name);
    }
    
    // Test 2: Get a specific prompt if any exist
    if (prompts.data.length > 0) {
      console.log(`\n2. Getting prompt: ${prompts.data[0].name}`);
      const prompt = await client.getPrompt({ name: prompts.data[0].name });
      console.log('✅ Got prompt:', {
        name: prompt.name,
        type: prompt.type,
        version: prompt.version,
        labels: prompt.labels
      });
    }
    
    console.log('\n✨ API connection successful!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.details) {
      console.error('Details:', error.details);
    }
  }
}

test();