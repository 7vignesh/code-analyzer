/**
 * Main library exports for skannr
 */

import * as path from 'path';
import { discoverModules, readFileContent, scanFiles, scanRocketChatFiles, scanTypeScriptFiles } from './scanner';
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
  type SymbolLineRange,
} from './types';
import { getCacheManager, type CacheConfig } from './cache';
import { detectRepoLanguages, getAdapter } from './languages/registry';

export async function analyzeProject(
  options?: AnalyzeOptions & {
    skipCache?: boolean;
    cacheConfig?: Partial<CacheConfig>;
  }
): Promise<AnalysisResult> {
  if (!options) {
    throw new Error('Options are required (must include root and question)');
  }

  const {
    root,
    question,
    limit = 10,
    generateMapping = false,
    mappingOutputPath,
    enhancedRanking = false,
    moduleKeys,
    moduleDefinitions,
    exclude,
    extensions,
    lang = 'auto',
    skipCache = false,
    cacheConfig,
  } = options;

  const absoluteRoot = path.resolve(root);
  const effectiveModuleKeys =
    moduleKeys && moduleKeys.length > 0 ? moduleKeys : discoverModules(absoluteRoot);
  const effectiveExtensions = resolveExtensions(absoluteRoot, lang, extensions);

  const allFiles = scanFiles(absoluteRoot, {
    extensions: effectiveExtensions,
    exclude,
    moduleKeys: effectiveModuleKeys,
    moduleDefinitions,
  });

  if (allFiles.length === 0) {
    return {
      question,
      root: absoluteRoot,
      limit,
      files: [],
    };
  }

  const cacheManager = cacheConfig ? getCacheManager() : getCacheManager();
  if (cacheConfig) {
    // cache manager behavior intentionally unchanged
  }

  if (!skipCache) {
    const cachedResult = cacheManager.get(
      absoluteRoot,
      question,
      allFiles,
      effectiveModuleKeys,
      enhancedRanking,
      limit
    );
    if (cachedResult) {
      console.log('📦 Cache hit! Using cached analysis result');
      return cachedResult;
    }
  }

  const rankedFiles = enhancedRanking
    ? rankFilesEnhanced(allFiles, question, limit, absoluteRoot)
    : rankFiles(allFiles, question, limit);

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
    const adapter = getAdapter(rankedFile.path);

    let skeleton: string;
    let lineRanges: SymbolLineRange[] | undefined;
    if (generateMapping && adapter.name === 'typescript') {
      const mappingResult = buildSkeletonWithMapping(rankedFile.path, absoluteRoot);
      skeleton = mappingResult.skeleton;
      lineRanges = mappingResult.lineRanges;
      if (mappingResult.symbols.length > 0) {
        symbolMapping.files[relativePath] = {
          originalPath: rankedFile.path,
          symbols: mappingResult.symbols,
        };
      }
    } else {
      const sk = buildSkeletonForFile(rankedFile.path, absoluteRoot);
      skeleton = sk.skeleton;
      lineRanges = sk.lineRanges;
    }

    fileAnalyses.push({
      path: relativePath,
      score: rankedFile.score,
      why: rankedFile.why,
      skeleton,
      lineRanges,
      originalTokenCount: countTokens(originalContent),
      skeletonTokenCount: countTokens(skeleton),
    });
  }

  const result: AnalysisResult = {
    question,
    root: absoluteRoot,
    limit,
    files: fileAnalyses,
  };

  if (!skipCache) {
    cacheManager.set(
      absoluteRoot,
      question,
      allFiles,
      result,
      effectiveModuleKeys,
      enhancedRanking,
      limit
    );
  }

  if (generateMapping && Object.keys(symbolMapping.files).length > 0) {
    const mappingPath = mappingOutputPath || path.join(absoluteRoot, 'code-analyzer.mapping.json');
    saveMappingToFile(symbolMapping, mappingPath);
    console.log(`Symbol mapping saved to: ${mappingPath}`);
  }

  return result;
}

function resolveExtensions(
  root: string,
  lang: AnalyzeOptions['lang'],
  explicit?: string[]
): string[] | undefined {
  if (explicit && explicit.length > 0) {
    return explicit.map((ext) => ext.toLowerCase());
  }

  if (lang === 'typescript' || lang === 'javascript') {
    return ['.ts', '.tsx', '.js', '.jsx'];
  }

  if (lang === 'python') {
    return ['.py', '.pyi'];
  }

  if (lang === 'auto') {
    detectRepoLanguages(root);
    return undefined;
  }

  return undefined;
}

export { rankFiles } from './ranker';
export { rankFilesEnhanced } from './ranker-enhanced';
export { buildSkeletonForFile } from './skeletonizer';
export { scanTypeScriptFiles, scanRocketChatFiles, scanFiles, discoverModules } from './scanner';
export { countTokens } from './tokenizer';
export {
  buildSkeletonWithMapping,
  getSymbolDetails,
  saveMappingToFile,
  loadMappingFromFile,
  type SymbolMapping,
  type SymbolLocation,
} from './mapper';

export type {
  AnalyzeOptions,
  AnalysisResult,
  FileAnalysis,
  RankedFile,
  SymbolLineRange,
} from './types';

export {
  CacheManager,
  getCacheManager,
  initializeCacheManager,
  DEFAULT_CACHE_CONFIG,
  type CacheConfig,
  type CacheEntry,
} from './cache';
