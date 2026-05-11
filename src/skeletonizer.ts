/**
 * Language-aware skeleton generation.
 */

import * as fs from 'fs';
import type { SkeletonResult } from './languages/LanguageAdapter';
import { getAdapter } from './languages/registry';

export function buildSkeletonForFile(
  filePath: string,
  rootDir?: string,
): SkeletonResult {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const adapter = getAdapter(filePath);
    return adapter.generateSkeleton(content, filePath, rootDir);
  } catch (error) {
    return {
      skeleton: `/* Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'} */`,
    };
  }
}
