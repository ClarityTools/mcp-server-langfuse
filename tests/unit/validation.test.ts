// Unit tests for validation utilities

import {
  extractVariables,
  validatePromptName,
  validatePromptContent,
  validateLabels,
  validateTags,
  validatePromptConfig,
  compilePrompt,
} from '../../src/lib/validation';
import { ValidationError } from '../../src/types';

describe('Validation Utilities', () => {
  describe('extractVariables', () => {
    it('should extract variables from text prompt', () => {
      const prompt = 'Hello {{name}}, welcome to {{place}}!';
      const variables = extractVariables(prompt);
      expect(variables).toEqual(['name', 'place']);
    });

    it('should extract variables from chat messages', () => {
      const messages = [
        { role: 'system' as const, content: 'You are {{role}}' },
        { role: 'user' as const, content: 'My name is {{userName}}' },
      ];
      const variables = extractVariables(messages);
      expect(variables).toEqual(['role', 'userName']);
    });

    it('should handle duplicate variables', () => {
      const prompt = '{{name}} is {{name}} and lives in {{city}}';
      const variables = extractVariables(prompt);
      expect(variables).toEqual(['name', 'city']);
    });

    it('should handle prompts without variables', () => {
      const prompt = 'Hello world!';
      const variables = extractVariables(prompt);
      expect(variables).toEqual([]);
    });
  });

  describe('validatePromptName', () => {
    it('should accept valid prompt names', () => {
      expect(() => validatePromptName('my-prompt')).not.toThrow();
      expect(() => validatePromptName('folder/sub-folder/prompt')).not.toThrow();
      expect(() => validatePromptName('prompt_123')).not.toThrow();
      expect(() => validatePromptName('prompt.v2')).not.toThrow();
    });

    it('should reject invalid prompt names', () => {
      expect(() => validatePromptName('')).toThrow(ValidationError);
      expect(() => validatePromptName('prompt with spaces')).toThrow(ValidationError);
      expect(() => validatePromptName('prompt@123')).toThrow(ValidationError);
      expect(() => validatePromptName('a'.repeat(256))).toThrow(ValidationError);
    });
  });

  describe('validatePromptContent', () => {
    it('should validate text prompts', () => {
      expect(() => validatePromptContent('text', 'Hello world')).not.toThrow();
    });

    it('should validate chat prompts', () => {
      const messages = [
        { role: 'system', content: 'You are an assistant' },
        { role: 'user', content: 'Hello' },
      ];
      expect(() => validatePromptContent('chat', messages)).not.toThrow();
    });

    it('should reject mismatched types', () => {
      expect(() => validatePromptContent('text', [])).toThrow(ValidationError);
      expect(() => validatePromptContent('chat', 'string')).toThrow(ValidationError);
    });

    it('should reject invalid chat messages', () => {
      const invalidMessages = [
        { role: 'invalid', content: 'test' },
      ];
      expect(() => validatePromptContent('chat', invalidMessages)).toThrow(ValidationError);
    });
  });

  describe('validateLabels', () => {
    it('should accept valid labels', () => {
      expect(() => validateLabels(['production', 'staging'])).not.toThrow();
      expect(() => validateLabels(['v1', 'v2-beta'])).not.toThrow();
    });

    it('should reject reserved labels', () => {
      expect(() => validateLabels(['latest'])).toThrow(ValidationError);
      expect(() => validateLabels(['all'])).toThrow(ValidationError);
    });

    it('should reject invalid label formats', () => {
      expect(() => validateLabels(['label with spaces'])).toThrow(ValidationError);
      expect(() => validateLabels([''])).toThrow(ValidationError);
      expect(() => validateLabels(['a'.repeat(51)])).toThrow(ValidationError);
    });
  });

  describe('validatePromptConfig', () => {
    it('should accept valid config', () => {
      const config = {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 1000,
        topP: 0.9,
      };
      expect(() => validatePromptConfig(config)).not.toThrow();
    });

    it('should reject invalid temperature', () => {
      expect(() => validatePromptConfig({ temperature: -1 })).toThrow(ValidationError);
      expect(() => validatePromptConfig({ temperature: 3 })).toThrow(ValidationError);
    });

    it('should reject invalid maxTokens', () => {
      expect(() => validatePromptConfig({ maxTokens: 0 })).toThrow(ValidationError);
      expect(() => validatePromptConfig({ maxTokens: -100 })).toThrow(ValidationError);
    });
  });

  describe('compilePrompt', () => {
    it('should compile text prompt with variables', () => {
      const prompt = 'Hello {{name}}, welcome to {{place}}!';
      const variables = { name: 'Alice', place: 'Wonderland' };
      const result = compilePrompt(prompt, variables);
      expect(result).toBe('Hello Alice, welcome to Wonderland!');
    });

    it('should compile chat messages with variables', () => {
      const messages = [
        { role: 'system' as const, content: 'You are {{role}}' },
        { role: 'user' as const, content: 'My name is {{userName}}' },
      ];
      const variables = { role: 'an assistant', userName: 'Bob' };
      const result = compilePrompt(messages, variables);
      expect(result).toEqual([
        { role: 'system', content: 'You are an assistant' },
        { role: 'user', content: 'My name is Bob' },
      ]);
    });

    it('should keep unmatched variables', () => {
      const prompt = 'Hello {{name}}, your ID is {{id}}';
      const variables = { name: 'Alice' };
      const result = compilePrompt(prompt, variables);
      expect(result).toBe('Hello Alice, your ID is {{id}}');
    });
  });
});