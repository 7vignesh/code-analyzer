/**
 * Shared type definitions for rc-code-skeletonizer
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
