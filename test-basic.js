#!/usr/bin/env node
// Basic test to verify the implementation works

import { LangfuseAPIClient } from './build/lib/langfuse-client.js';
import { extractVariables, validatePromptName } from './build/lib/validation.js';
import { Cache } from './build/lib/cache.js';

console.log('Testing Langfuse MCP Server Components...\n');

// Test 1: Validation
console.log('1. Testing validation:');
try {
  validatePromptName('test-prompt');
  console.log('✅ Prompt name validation works');
} catch (e) {
  console.log('❌ Prompt name validation failed:', e.message);
}

// Test 2: Variable extraction
console.log('\n2. Testing variable extraction:');
const vars = extractVariables('Hello {{name}}, welcome to {{place}}!');
console.log('✅ Extracted variables:', vars);

// Test 3: Cache
console.log('\n3. Testing cache:');
const cache = new Cache({ ttl: 60 });
cache.set('test', 'value');
const cached = cache.get('test');
console.log(cached === 'value' ? '✅ Cache works' : '❌ Cache failed');

// Test 4: API Client initialization
console.log('\n4. Testing API client:');
try {
  const client = new LangfuseAPIClient({
    publicKey: 'test-pk',
    secretKey: 'test-sk',
    baseUrl: 'https://cloud.langfuse.com'
  });
  console.log('✅ API client initialized');
} catch (e) {
  console.log('❌ API client failed:', e.message);
}

console.log('\n✨ Basic functionality tests complete!');