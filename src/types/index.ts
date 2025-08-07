// Type definitions for Langfuse MCP Server

export interface LangfuseConfig {
  publicKey: string;
  secretKey: string;
  baseUrl?: string;
  requestTimeout?: number;
  maxRetries?: number;
}

export interface ListPromptsParams {
  name?: string;
  label?: string;
  tag?: string;
  page?: number;
  limit?: number;
}

export interface GetPromptParams {
  name: string;
  version?: number;
  label?: string;
}

export interface CreatePromptParams {
  name: string;
  type: 'text' | 'chat';
  prompt: string | ChatMessage[];
  config?: PromptConfig;
  labels?: string[];
  tags?: string[];
  commitMessage?: string;
}

export interface UpdatePromptLabelsParams {
  name: string;
  version: number;
  newLabels: string[];
}

export interface DeletePromptParams {
  name: string;
  version?: number;
  deleteAll?: boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PromptConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
}

export interface PromptVersion {
  name: string;
  version: number;
  type: 'text' | 'chat';
  prompt: string | ChatMessage[];
  config?: PromptConfig;
  labels: string[];
  tags: string[];
  commitMessage?: string;
  createdAt: string;
  updatedAt: string;
  variables: string[];
}

export interface PromptListItem {
  name: string;
  latestVersion: number;
  type: 'text' | 'chat';
  labels: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    totalPages: number;
    totalItems: number;
  };
}

// Error types
export class APIError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class ValidationError extends Error {
  constructor(
    public field: string,
    public constraint: string
  ) {
    super(`Validation failed for ${field}: ${constraint}`);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends Error {
  constructor(
    public retryAfter: number,
    message: string = 'Rate limit exceeded'
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

// Cache types
export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  keyPrefix?: string;
}