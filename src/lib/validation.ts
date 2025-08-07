// Validation utilities for prompt management

import { ValidationError, ChatMessage, PromptConfig } from '../types/index.js';

/**
 * Extract mustache variables from a prompt template
 */
export function extractVariables(prompt: string | ChatMessage[]): string[] {
  const variables = new Set<string>();
  const regex = /\{\{([^}]+)\}\}/g;

  if (typeof prompt === 'string') {
    // Extract from text prompt
    let match;
    while ((match = regex.exec(prompt)) !== null) {
      variables.add(match[1].trim());
    }
  } else if (Array.isArray(prompt)) {
    // Extract from chat messages
    for (const message of prompt) {
      let match;
      while ((match = regex.exec(message.content)) !== null) {
        variables.add(match[1].trim());
      }
    }
  }

  return Array.from(variables);
}

/**
 * Validate prompt name
 */
export function validatePromptName(name: string): void {
  if (!name || typeof name !== 'string') {
    throw new ValidationError('name', 'Prompt name is required');
  }

  if (name.length === 0) {
    throw new ValidationError('name', 'Prompt name cannot be empty');
  }

  if (name.length > 255) {
    throw new ValidationError('name', 'Prompt name cannot exceed 255 characters');
  }

  // Allow slashes for folder-like organization
  const validNameRegex = /^[a-zA-Z0-9_\-/.]+$/;
  if (!validNameRegex.test(name)) {
    throw new ValidationError('name', 'Prompt name can only contain letters, numbers, underscores, hyphens, dots, and slashes');
  }
}

/**
 * Validate prompt type and content match
 */
export function validatePromptContent(type: string, content: any): void {
  if (type === 'text') {
    if (typeof content !== 'string') {
      throw new ValidationError('prompt', 'Text prompts must be a string');
    }
  } else if (type === 'chat') {
    if (!Array.isArray(content)) {
      throw new ValidationError('prompt', 'Chat prompts must be an array of messages');
    }

    for (const message of content) {
      if (!message.role || !message.content) {
        throw new ValidationError('prompt', 'Each chat message must have role and content');
      }

      if (!['system', 'user', 'assistant'].includes(message.role)) {
        throw new ValidationError('prompt', 'Message role must be system, user, or assistant');
      }

      if (typeof message.content !== 'string') {
        throw new ValidationError('prompt', 'Message content must be a string');
      }
    }
  } else {
    throw new ValidationError('type', 'Prompt type must be text or chat');
  }
}

/**
 * Validate labels
 */
export function validateLabels(labels: string[]): void {
  if (!Array.isArray(labels)) {
    throw new ValidationError('labels', 'Labels must be an array');
  }

  const reservedLabels = ['latest', 'all'];
  for (const label of labels) {
    if (typeof label !== 'string') {
      throw new ValidationError('labels', 'Each label must be a string');
    }

    if (label.length === 0) {
      throw new ValidationError('labels', 'Label cannot be empty');
    }

    if (label.length > 50) {
      throw new ValidationError('labels', 'Label cannot exceed 50 characters');
    }

    if (reservedLabels.includes(label.toLowerCase())) {
      throw new ValidationError('labels', `Label '${label}' is reserved and cannot be used`);
    }

    // Labels should be simple identifiers
    const validLabelRegex = /^[a-zA-Z0-9_\-]+$/;
    if (!validLabelRegex.test(label)) {
      throw new ValidationError('labels', 'Labels can only contain letters, numbers, underscores, and hyphens');
    }
  }
}

/**
 * Validate tags
 */
export function validateTags(tags: string[]): void {
  if (!Array.isArray(tags)) {
    throw new ValidationError('tags', 'Tags must be an array');
  }

  for (const tag of tags) {
    if (typeof tag !== 'string') {
      throw new ValidationError('tags', 'Each tag must be a string');
    }

    if (tag.length === 0) {
      throw new ValidationError('tags', 'Tag cannot be empty');
    }

    if (tag.length > 50) {
      throw new ValidationError('tags', 'Tag cannot exceed 50 characters');
    }
  }
}

/**
 * Validate prompt config
 */
export function validatePromptConfig(config: PromptConfig): void {
  if (config.temperature !== undefined) {
    if (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2) {
      throw new ValidationError('config.temperature', 'Temperature must be a number between 0 and 2');
    }
  }

  if (config.maxTokens !== undefined) {
    if (typeof config.maxTokens !== 'number' || config.maxTokens < 1) {
      throw new ValidationError('config.maxTokens', 'Max tokens must be a positive number');
    }
  }

  if (config.topP !== undefined) {
    if (typeof config.topP !== 'number' || config.topP < 0 || config.topP > 1) {
      throw new ValidationError('config.topP', 'Top P must be a number between 0 and 1');
    }
  }

  if (config.frequencyPenalty !== undefined) {
    if (typeof config.frequencyPenalty !== 'number' || config.frequencyPenalty < -2 || config.frequencyPenalty > 2) {
      throw new ValidationError('config.frequencyPenalty', 'Frequency penalty must be a number between -2 and 2');
    }
  }

  if (config.presencePenalty !== undefined) {
    if (typeof config.presencePenalty !== 'number' || config.presencePenalty < -2 || config.presencePenalty > 2) {
      throw new ValidationError('config.presencePenalty', 'Presence penalty must be a number between -2 and 2');
    }
  }

  if (config.stopSequences !== undefined) {
    if (!Array.isArray(config.stopSequences)) {
      throw new ValidationError('config.stopSequences', 'Stop sequences must be an array');
    }

    for (const seq of config.stopSequences) {
      if (typeof seq !== 'string') {
        throw new ValidationError('config.stopSequences', 'Each stop sequence must be a string');
      }
    }
  }
}

/**
 * Compile a prompt with variables
 */
export function compilePrompt(
  prompt: string | ChatMessage[],
  variables: Record<string, string>
): string | ChatMessage[] {
  if (typeof prompt === 'string') {
    return replaceVariables(prompt, variables);
  } else {
    return prompt.map(message => ({
      ...message,
      content: replaceVariables(message.content, variables),
    }));
  }
}

/**
 * Replace mustache variables in a string
 */
function replaceVariables(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
    const trimmedName = varName.trim();
    if (trimmedName in variables) {
      return variables[trimmedName];
    }
    return match; // Keep original if variable not provided
  });
}