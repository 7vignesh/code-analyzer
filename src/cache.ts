/**
 * Caching system for code analysis results
 * Uses hybrid approach: in-memory + disk cache with MD5 file validation
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { AnalysisResult } from './types';

export interface CacheConfig {
  enabled: boolean;
  inMemory: boolean;
  onDisk: boolean;
  cacheDir: string;
}

export interface CacheEntry {
  result: AnalysisResult;
  fileHashes: Record<string, string>; // filename -> md5 hash
  createdAt: number;
  expiresAt: number;
}

/**
 * Default cache configuration
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  inMemory: true,
  onDisk: true,
  cacheDir: path.join(process.cwd(), '.code-analyzer-cache'),
};

/**
 * Cache manager for analysis results
 */
export class CacheManager {
  private config: CacheConfig;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private stats = {
    hits: 0,
    misses: 0,
    invalidations: 0,
  };

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };

    if (this.config.onDisk && !fs.existsSync(this.config.cacheDir)) {
      fs.mkdirSync(this.config.cacheDir, { recursive: true });
    }
  }

  /**
   * Generate cache key from analysis parameters
   */
  private generateKey(
    root: string,
    question: string,
    moduleKeys?: string[],
    enhancedRanking?: boolean,
    limit?: number
  ): string {
    const input = `${root}|${question}|${(moduleKeys || []).join(',')}|${enhancedRanking}|${limit}`;
    return crypto.createHash('md5').update(input).digest('hex');
  }

  /**
   * Calculate MD5 hash of file contents
   */
  private hashFile(filePath: string): string | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return crypto.createHash('md5').update(content).digest('hex');
    } catch {
      return null;
    }
  }

  /**
   * Hash all files in a directory (for change detection)
   */
  private hashFiles(fileList: string[]): Record<string, string> {
    const hashes: Record<string, string> = {};

    for (const filePath of fileList) {
      const hash = this.hashFile(filePath);
      if (hash) {
        hashes[filePath] = hash;
      }
    }

    return hashes;
  }

  /**
   * Check if cached entry is still valid (files haven't changed)
   */
  private isValidEntry(entry: CacheEntry, fileList: string[]): boolean {
    // Check expiration (24 hours)
    if (Date.now() > entry.expiresAt) {
      return false;
    }

    // Check if any files have changed
    for (const filePath of fileList) {
      const currentHash = this.hashFile(filePath);
      const cachedHash = entry.fileHashes[filePath];

      if (!currentHash || currentHash !== cachedHash) {
        return false;
      }
    }

    // Check if files were added/removed
    if (Object.keys(entry.fileHashes).length !== fileList.length) {
      return false;
    }

    return true;
  }

  /**
   * Get cached result
   */
  get(
    root: string,
    question: string,
    analyzedFiles: string[],
    moduleKeys?: string[],
    enhancedRanking?: boolean,
    limit?: number
  ): AnalysisResult | null {
    if (!this.config.enabled) {
      return null;
    }

    const key = this.generateKey(root, question, moduleKeys, enhancedRanking, limit);

    // Try memory cache first
    if (this.config.inMemory) {
      const memEntry = this.memoryCache.get(key);
      if (memEntry && this.isValidEntry(memEntry, analyzedFiles)) {
        this.stats.hits++;
        return memEntry.result;
      }
    }

    // Try disk cache
    if (this.config.onDisk) {
      const diskEntry = this.loadFromDisk(key);
      if (diskEntry && this.isValidEntry(diskEntry, analyzedFiles)) {
        this.stats.hits++;

        // Restore to memory cache
        if (this.config.inMemory) {
          this.memoryCache.set(key, diskEntry);
        }

        return diskEntry.result;
      }
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Save result to cache
   */
  set(
    root: string,
    question: string,
    analyzedFiles: string[],
    result: AnalysisResult,
    moduleKeys?: string[],
    enhancedRanking?: boolean,
    limit?: number
  ): void {
    if (!this.config.enabled) {
      return;
    }

    const key = this.generateKey(root, question, moduleKeys, enhancedRanking, limit);
    const fileHashes = this.hashFiles(analyzedFiles);

    const entry: CacheEntry = {
      result,
      fileHashes,
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    };

    // Save to memory cache
    if (this.config.inMemory) {
      this.memoryCache.set(key, entry);
    }

    // Save to disk cache
    if (this.config.onDisk) {
      this.saveToDisk(key, entry);
    }
  }

  /**
   * Load cache entry from disk
   */
  private loadFromDisk(key: string): CacheEntry | null {
    try {
      const cacheFile = path.join(this.config.cacheDir, `${key}.json`);
      if (!fs.existsSync(cacheFile)) {
        return null;
      }

      const content = fs.readFileSync(cacheFile, 'utf-8');
      return JSON.parse(content) as CacheEntry;
    } catch {
      return null;
    }
  }

  /**
   * Save cache entry to disk
   */
  private saveToDisk(key: string, entry: CacheEntry): void {
    try {
      const cacheFile = path.join(this.config.cacheDir, `${key}.json`);
      fs.writeFileSync(cacheFile, JSON.stringify(entry, null, 2), 'utf-8');
    } catch (error) {
      console.warn(`Failed to save cache to disk: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear all caches
   */
  clear(): void {
    // Clear memory cache
    this.memoryCache.clear();

    // Clear disk cache
    if (this.config.onDisk && fs.existsSync(this.config.cacheDir)) {
      try {
        fs.rmSync(this.config.cacheDir, { recursive: true, force: true });
        fs.mkdirSync(this.config.cacheDir, { recursive: true });
      } catch (error) {
        console.warn(`Failed to clear disk cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Reset stats
    this.stats = { hits: 0, misses: 0, invalidations: 0 };
  }

  /**
   * Clear memory cache only
   */
  clearMemory(): void {
    this.memoryCache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { hits: number; misses: number; invalidations: number; hitRate: number; cacheSize: number } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

    let cacheSize = 0;
    if (this.config.onDisk && fs.existsSync(this.config.cacheDir)) {
      const files = fs.readdirSync(this.config.cacheDir);
      for (const file of files) {
        const stat = fs.statSync(path.join(this.config.cacheDir, file));
        cacheSize += stat.size;
      }
    }

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      invalidations: this.stats.invalidations,
      hitRate: Math.round(hitRate * 100) / 100,
      cacheSize,
    };
  }

  /**
   * Get cache directory path
   */
  getCacheDir(): string {
    return this.config.cacheDir;
  }
}

/**
 * Global cache manager instance
 */
export let globalCacheManager: CacheManager | null = null;

/**
 * Initialize global cache manager
 */
export function initializeCacheManager(config?: Partial<CacheConfig>): CacheManager {
  globalCacheManager = new CacheManager(config);
  return globalCacheManager;
}

/**
 * Get or create global cache manager
 */
export function getCacheManager(): CacheManager {
  if (!globalCacheManager) {
    globalCacheManager = new CacheManager();
  }
  return globalCacheManager;
}
