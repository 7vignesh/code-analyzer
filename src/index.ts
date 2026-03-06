/**
 * Main library exports for rc-code-skeletonizer
 */

import * as path from 'path';
import { scanTypeScriptFiles, scanRocketChatFiles, readFileContent } from './scanner';
import { resolveMeteorAppRoot, isRocketChatMeteorRoot } from './rocket-chat-scope';
import { rankFiles } from './ranker';
import { rankFilesEnhanced } from './ranker-enhanced';
import { buildSkeletonForFile } from './skeletonizer';
import { countTokens } from './tokenizer';
import {
  buildSkeletonWithMapping,
  saveMappingToFile,
  type SymbolMapping,
} from './mapper';
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
    generateMapping = false,
    mappingOutputPath,
    enhancedRanking = false,
    moduleKeys,
    strictRocketChatScope = true,
  } = options;

  // Resolve absolute path
  const absoluteRoot = path.resolve(root);

  // Step 1: Scan for TypeScript files
  let allFiles: string[] = [];

  if (strictRocketChatScope) {
    const analysisRoot = resolveMeteorAppRoot(absoluteRoot);
    if (!isRocketChatMeteorRoot(analysisRoot) && !process.env.SKIP_RC_CHECK) {
      console.warn(`Warning: ${analysisRoot} does not appear to be a Rocket.Chat Meteor app root.`);
    }
    // Use scoped scanner
    allFiles = scanRocketChatFiles(absoluteRoot, moduleKeys);
  } else {
    // Use generic scanner
    allFiles = scanTypeScriptFiles(absoluteRoot);
  }

  if (allFiles.length === 0) {
    return {
      question,
      root: absoluteRoot,
      limit,
      files: [],
    };
  }

  // Step 2: Rank files by relevance
  const rankedFiles = enhancedRanking
    ? rankFilesEnhanced(allFiles, question, limit, absoluteRoot)
    : rankFiles(allFiles, question, limit);

  // Step 3: Generate skeletons for top files
  const fileAnalyses: FileAnalysis[] = [];
  const symbolMapping: SymbolMapping = {
    generatedAt: new Date().toISOString(),
    rootPath: absoluteRoot,
    files: {},
  };

  for (const rankedFile of rankedFiles) {
    const originalContent = readFileContent(rankedFile.path);
    if (!originalContent) {
      continue;
    }

    const relativePath = path.relative(absoluteRoot, rankedFile.path);

    let skeleton: string;
    
    if (generateMapping) {
      // Use mapping-aware skeleton generation
      const result = buildSkeletonWithMapping(rankedFile.path, absoluteRoot);
      skeleton = result.skeleton;
      
      if (result.symbols.length > 0) {
        symbolMapping.files[relativePath] = {
          originalPath: rankedFile.path,
          symbols: result.symbols,
        };
      }
    } else {
      // Use standard skeleton generation
      skeleton = buildSkeletonForFile(rankedFile.path);
    }

    fileAnalyses.push({
      path: relativePath,
      score: rankedFile.score,
      skeleton,
      originalTokenCount: countTokens(originalContent),
      skeletonTokenCount: countTokens(skeleton),
    });
  }

  // Save mapping file if requested
  if (generateMapping && Object.keys(symbolMapping.files).length > 0) {
    const mappingPath = mappingOutputPath || path.join(absoluteRoot, 'code-analyzer.mapping.json');
    saveMappingToFile(symbolMapping, mappingPath);
    console.log(`Symbol mapping saved to: ${mappingPath}`);
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
export { rankFilesEnhanced } from './ranker-enhanced';
export { buildSkeletonForFile } from './skeletonizer';
export { scanTypeScriptFiles, scanRocketChatFiles } from './scanner';
export { countTokens } from './tokenizer';
export {
  buildSkeletonWithMapping,
  getSymbolDetails,
  saveMappingToFile,
  loadMappingFromFile,
  type SymbolMapping,
  type SymbolLocation,
} from './mapper';

// Re-export types
export type {
  AnalyzeOptions,
  AnalysisResult,
  FileAnalysis,
  RankedFile,
} from './types';
