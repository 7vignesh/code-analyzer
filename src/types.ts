/**
 * Shared type definitions for universal-code-analyzer
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

/**
 * Ranked file with relevance score
 */
export interface RankedFile {
  /** Absolute path to the file */
  path: string;
  /** Relevance score (0-1) */
  score: number;
}

/**
 * Analysis result for a single file
 */
export interface FileAnalysis {
  /** Relative path to the file */
  path: string;
  /** Relevance score (0-1) */
  score: number;
  /** Generated skeleton code */
  skeleton: string;
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
}
