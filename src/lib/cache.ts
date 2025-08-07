// Simple in-memory cache with TTL support

import { CacheEntry, CacheOptions } from '../types/index.js';

export class Cache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private defaultTTL: number;
  private keyPrefix: string;

  constructor(options: CacheOptions = {}) {
    this.defaultTTL = options.ttl || 300; // 5 minutes default
    this.keyPrefix = options.keyPrefix || '';
  }

  /**
   * Get a value from cache
   */
  get(key: string): T | null {
    const fullKey = this.keyPrefix + key;
    const entry = this.cache.get(fullKey);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(fullKey);
      return null;
    }

    return entry.data;
  }

  /**
   * Set a value in cache
   */
  set(key: string, value: T, ttl?: number): void {
    const fullKey = this.keyPrefix + key;
    const expiresAt = Date.now() + ((ttl || this.defaultTTL) * 1000);

    this.cache.set(fullKey, {
      data: value,
      expiresAt,
    });
  }

  /**
   * Delete a value from cache
   */
  delete(key: string): boolean {
    const fullKey = this.keyPrefix + key;
    return this.cache.delete(fullKey);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}

// Create a singleton cache manager
export class CacheManager {
  private static instance: CacheManager;
  private caches = new Map<string, Cache<any>>();

  private constructor() {
    // Start cleanup interval
    setInterval(() => {
      for (const cache of this.caches.values()) {
        cache.cleanup();
      }
    }, 60000); // Cleanup every minute
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  getCache<T>(name: string, options?: CacheOptions): Cache<T> {
    if (!this.caches.has(name)) {
      this.caches.set(name, new Cache<T>(options));
    }
    return this.caches.get(name) as Cache<T>;
  }

  clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }
}