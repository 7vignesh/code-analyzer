/**
 * Main library exports for rc-code-skeletonizer
 */

import * as path from 'path';
import { scanTypeScriptFiles, readFileContent } from './scanner';
import { rankFiles } from './ranker';
import { buildSkeletonForFile } from './skeletonizer';
import { countTokens } from './tokenizer';
import {
  AnalyzeOptions,
  AnalysisResult,
  FileAnalysis,
} from './types';

/**
 * Analyze a TypeScript project and generate skeletons for relevant files
 */
export async function analyzeProject(options: AnalyzeOptions): Promise<AnalysisResult> {
  const {
    root,
    question,
    limit = 10,
  } = options;

  // Resolve absolute path
  const absoluteRoot = path.resolve(root);

  // Step 1: Scan for TypeScript files
  const allFiles = scanTypeScriptFiles(absoluteRoot);

  if (allFiles.length === 0) {
    return {
      question,
      root: absoluteRoot,
      limit,
      files: [],
    };
  }

  // Step 2: Rank files by relevance
  const rankedFiles = rankFiles(allFiles, question, limit);

  // Step 3: Generate skeletons for top files
  const fileAnalyses: FileAnalysis[] = [];

  for (const rankedFile of rankedFiles) {
    const originalContent = readFileContent(rankedFile.path);
    if (!originalContent) {
      continue;
    }

    const skeleton = buildSkeletonForFile(rankedFile.path);
    const relativePath = path.relative(absoluteRoot, rankedFile.path);

    fileAnalyses.push({
      path: relativePath,
      score: rankedFile.score,
      skeleton,
      originalTokenCount: countTokens(originalContent),
      skeletonTokenCount: countTokens(skeleton),
    });
  }

  return {
    question,
    root: absoluteRoot,
    limit,
    files: fileAnalyses,
  };
}

// Re-export individual functions for advanced usage
export { rankFiles } from './ranker';
export { buildSkeletonForFile } from './skeletonizer';
export { scanTypeScriptFiles } from './scanner';
export { countTokens } from './tokenizer';

// Re-export types
export type {
  AnalyzeOptions,
  AnalysisResult,
  FileAnalysis,
  RankedFile,
} from './types';
