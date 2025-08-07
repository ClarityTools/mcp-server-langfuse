// Unit tests for cache implementation

import { Cache, CacheManager } from '../../src/lib/cache';

describe('Cache', () => {
  let cache: Cache<string>;

  beforeEach(() => {
    cache = new Cache<string>({ ttl: 1 }); // 1 second TTL
  });

  describe('basic operations', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return null for missing keys', () => {
      expect(cache.get('missing')).toBeNull();
    });

    it('should delete values', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeNull();
    });

    it('should clear all values', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.size()).toBe(0);
    });
  });

  describe('TTL handling', () => {
    it('should expire values after TTL', async () => {
      cache.set('key1', 'value1', 0.1); // 100ms TTL
      expect(cache.get('key1')).toBe('value1');
      
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(cache.get('key1')).toBeNull();
    });

    it('should use custom TTL over default', async () => {
      cache.set('key1', 'value1', 2); // 2 second TTL
      
      await new Promise(resolve => setTimeout(resolve, 1100)); // Wait past default TTL
      expect(cache.get('key1')).toBe('value1'); // Should still be there
    });
  });

  describe('pattern invalidation', () => {
    it('should invalidate entries matching pattern', () => {
      cache.set('prompt:v1', 'value1');
      cache.set('prompt:v2', 'value2');
      cache.set('other:v1', 'value3');

      cache.invalidatePattern('prompt:');
      
      expect(cache.get('prompt:v1')).toBeNull();
      expect(cache.get('prompt:v2')).toBeNull();
      expect(cache.get('other:v1')).toBe('value3');
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries on cleanup', async () => {
      cache.set('key1', 'value1', 0.1);
      cache.set('key2', 'value2', 2);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      cache.cleanup();
      expect(cache.size()).toBe(1);
      expect(cache.get('key2')).toBe('value2');
    });
  });
});

describe('CacheManager', () => {
  let manager: CacheManager;

  beforeEach(() => {
    // Reset singleton instance
    (CacheManager as any).instance = undefined;
    manager = CacheManager.getInstance();
  });

  it('should be a singleton', () => {
    const manager2 = CacheManager.getInstance();
    expect(manager).toBe(manager2);
  });

  it('should create named caches', () => {
    const cache1 = manager.getCache<string>('cache1');
    const cache2 = manager.getCache<number>('cache2');
    
    expect(cache1).toBeDefined();
    expect(cache2).toBeDefined();
    expect(cache1).not.toBe(cache2);
  });

  it('should return same cache for same name', () => {
    const cache1 = manager.getCache<string>('test');
    const cache2 = manager.getCache<string>('test');
    
    expect(cache1).toBe(cache2);
  });

  it('should clear all caches', () => {
    const cache1 = manager.getCache<string>('cache1');
    const cache2 = manager.getCache<string>('cache2');
    
    cache1.set('key', 'value');
    cache2.set('key', 'value');
    
    manager.clearAll();
    
    expect(cache1.size()).toBe(0);
    expect(cache2.size()).toBe(0);
  });
});