/**
 * File scanner for TypeScript projects
 */

import * as fs from 'fs';
import * as path from 'path';
import { getAllowedModulePaths } from './rocket-chat-scope';

/**
 * Directories to ignore during scanning
 */
const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  '.git',
  '.next',
  '.nuxt',
  'coverage',
  '.vscode',
  '.idea',
]);

/**
 * Recursively scan directory for TypeScript files
 */
export function scanTypeScriptFiles(rootDir: string): string[] {
  const results: string[] = [];

  function scan(dir: string): void {
    let entries: fs.Dirent[];
    
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      // Skip directories we can't read
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip ignored directories
        if (!IGNORED_DIRS.has(entry.name)) {
          scan(fullPath);
        }
      } else if (entry.isFile()) {
        // Include .ts and .tsx files
        if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          results.push(fullPath);
        }
      }
    }
  }

  scan(rootDir);
  return results;
}

/**
 * Scan only allowed Rocket.Chat modules
 */
export function scanRocketChatFiles(rootDir: string, moduleKeys?: string[]): string[] {
  const allowedPaths = getAllowedModulePaths(rootDir, moduleKeys);
  const results: string[] = [];

  for (const modulePath of allowedPaths) {
    if (fs.existsSync(modulePath)) {
      results.push(...scanTypeScriptFiles(modulePath));
    }
  }
  return results;
}

/**
 * Read file content safely
 */
export function readFileContent(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    return null;
  }
}
