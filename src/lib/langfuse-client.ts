// Langfuse API Client with authentication and error handling

import {
  LangfuseConfig,
  APIError,
  AuthenticationError,
  RateLimitError,
  PaginatedResponse,
  PromptListItem,
  PromptVersion,
  CreatePromptParams,
  UpdatePromptLabelsParams,
} from '../types/index.js';

export class LangfuseAPIClient {
  private auth: string;
  private baseUrl: string;
  private requestTimeout: number;
  private maxRetries: number;

  constructor(config: LangfuseConfig) {
    if (!config.publicKey || !config.secretKey) {
      throw new AuthenticationError('Missing Langfuse API credentials');
    }

    // Basic Auth: base64(publicKey:secretKey)
    this.auth = Buffer.from(`${config.publicKey}:${config.secretKey}`).toString('base64');
    this.baseUrl = config.baseUrl || 'https://cloud.langfuse.com';
    this.requestTimeout = config.requestTimeout || 30000;
    this.maxRetries = config.maxRetries || 3;
  }

  /**
   * Make an authenticated request to the Langfuse API
   */
  private async request<T>(
    method: string,
    path: string,
    data?: any,
    retryCount = 0
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const response = await fetch(`${this.baseUrl}/api/public/v2${path}`, {
        method,
        headers: {
          'Authorization': `Basic ${this.auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        throw new RateLimitError(retryAfter);
      }

      // Handle authentication errors
      if (response.status === 401 || response.status === 403) {
        throw new AuthenticationError();
      }

      // Handle other errors
      if (!response.ok) {
        const errorText = await response.text();
        let errorDetails;
        try {
          errorDetails = JSON.parse(errorText);
        } catch {
          errorDetails = errorText;
        }
        throw new APIError(response.status, `API request failed`, errorDetails);
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeout);

      // Handle timeout
      if (error.name === 'AbortError') {
        throw new APIError(408, 'Request timeout');
      }

      // Retry on network errors or 5xx errors
      if (
        retryCount < this.maxRetries &&
        (error.name === 'FetchError' || (error instanceof APIError && error.status >= 500))
      ) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.request<T>(method, path, data, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * List prompts with filtering and pagination
   */
  async listPrompts(params: {
    name?: string;
    label?: string;
    tag?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<PromptListItem>> {
    const queryParams = new URLSearchParams();
    
    if (params.name) queryParams.append('name', params.name);
    if (params.label) queryParams.append('label', params.label);
    if (params.tag) queryParams.append('tag', params.tag);
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());

    const queryString = queryParams.toString();
    const path = `/prompts${queryString ? `?${queryString}` : ''}`;

    return this.request<PaginatedResponse<PromptListItem>>('GET', path);
  }

  /**
   * Get a specific prompt by name with optional version/label
   */
  async getPrompt(params: {
    name: string;
    version?: number;
    label?: string;
  }): Promise<PromptVersion> {
    const { name, version, label } = params;
    
    // URL encode the name to handle special characters like "/"
    const encodedName = encodeURIComponent(name);
    
    let path = `/prompts/${encodedName}`;
    
    if (version !== undefined) {
      path += `/versions/${version}`;
    } else if (label) {
      path += `?label=${encodeURIComponent(label)}`;
    }

    return this.request<PromptVersion>('GET', path);
  }

  /**
   * Create a new prompt or version
   */
  async createPrompt(params: CreatePromptParams): Promise<PromptVersion> {
    // Validate prompt content matches type
    if (params.type === 'chat' && !Array.isArray(params.prompt)) {
      throw new Error('Chat prompts must be an array of messages');
    }
    if (params.type === 'text' && typeof params.prompt !== 'string') {
      throw new Error('Text prompts must be a string');
    }

    return this.request<PromptVersion>('POST', '/prompts', params);
  }

  /**
   * Update labels for a specific prompt version
   */
  async updatePromptLabels(params: UpdatePromptLabelsParams): Promise<PromptVersion> {
    const { name, version, newLabels } = params;
    
    // URL encode the name
    const encodedName = encodeURIComponent(name);
    const path = `/prompts/${encodedName}/versions/${version}`;

    return this.request<PromptVersion>('PATCH', path, { labels: newLabels });
  }

  /**
   * Delete a prompt (placeholder - not yet available in API)
   */
  async deletePrompt(_params: {
    name: string;
    version?: number;
  }): Promise<void> {
    // This is a placeholder for future API support
    // Track issue: https://github.com/langfuse/langfuse/issues/7693
    throw new APIError(501, 'Delete operation not yet supported by Langfuse API');
  }

  /**
   * Batch update labels for multiple prompt versions
   */
  async batchUpdateLabels(updates: UpdatePromptLabelsParams[]): Promise<PromptVersion[]> {
    // Execute updates in parallel with controlled concurrency
    const concurrency = 5;
    const results: PromptVersion[] = [];
    
    for (let i = 0; i < updates.length; i += concurrency) {
      const batch = updates.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(update => this.updatePromptLabels(update))
      );
      results.push(...batchResults);
    }
    
    return results;
  }
}