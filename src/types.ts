/**
 * Shared type definitions for skannr
 */

/**
 * Options for analyzing a project
 */
export interface AnalyzeOptions {
  /** Root directory of the project */
  root: string;
  /** Natural language question about the codebase */
  question: string;
  /** Number of top files to return */
  limit?: number;
  /** Generate symbol mapping for on-demand retrieval */
  generateMapping?: boolean;
  /** Output path for mapping file (default: <root>/code-analyzer.mapping.json) */
  mappingOutputPath?: string;
  /** Use enhanced ranking algorithm with dependency analysis */
  enhancedRanking?: boolean;
  /** Optional filter for module keys (e.g. ['auth', 'api']) */
  moduleKeys?: string[];
  /** Optional module definitions from config (module -> directory list) */
  moduleDefinitions?: Record<string, string[]>;
  /** Optional exclusion globs */
  exclude?: string[];
  /** Optional extension allow-list */
  extensions?: string[];
  /** Language strategy */
  lang?: 'typescript' | 'javascript' | 'python' | 'auto';
}

/** Source span for a symbol (TypeScript/JavaScript skeleton grounding). */
export interface SymbolLineRange {
  symbol: string;
  start: number;
  end: number;
}

/**
 * Ranked file with relevance score
 */
export interface RankedFile {
  /** Absolute path to the file */
  path: string;
  /** Relevance score (0-1) */
  score: number;
  /** Short human-readable explanation of why this file ranked */
  why: string;
  /** Optional line ranges when skeleton metadata is attached later in the pipeline */
  lineRanges?: SymbolLineRange[];
}

/**
 * Analysis result for a single file
 */
export interface FileAnalysis {
  /** Relative path to the file */
  path: string;
  /** Relevance score (0-1) */
  score: number;
  /** Short human-readable explanation of why this file ranked */
  why: string;
  /** Generated skeleton code */
  skeleton: string;
  /** Per-symbol line ranges in the original file (TS/JS when available) */
  lineRanges?: SymbolLineRange[];
  /** Approximate token count of original file */
  originalTokenCount: number;
  /** Approximate token count of skeleton */
  skeletonTokenCount: number;
}

/**
 * Complete analysis result
 */
export interface AnalysisResult {
  /** The original question */
  question: string;
  /** The project root directory */
  root: string;
  /** Number of files requested */
  limit: number;
  /** Analyzed files with skeletons */
  files: FileAnalysis[];
  /** Approximate aggregate token reduction (percent); often set by CLI for display */
  tokenReduction?: number;
  /** Wall-clock time for the analysis run (ms); often set by CLI */
  executionMs?: number;
  /** Optional retrieval/debug line for formatters */
  evidence?: string;
}
