/**
 * Language-aware skeleton generation.
 */

import * as fs from 'fs';
import { getAdapter } from './languages/registry';

export function buildSkeletonForFile(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const adapter = getAdapter(filePath);
    return adapter.generateSkeleton(content, filePath);
  } catch (error) {
    return `/* Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'} */`;
  }
}
