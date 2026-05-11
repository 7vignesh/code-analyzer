import type { SymbolLineRange } from '../types';

export interface Symbol {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'export';
  line: number;
}

export interface SkeletonResult {
  skeleton: string;
  lineRanges?: SymbolLineRange[];
}

export interface LanguageAdapter {
  name: string;
  extensions: string[];
  canHandle(filePath: string): boolean;
  generateSkeleton(content: string, filePath: string, rootDir?: string): SkeletonResult;
  extractSymbols(content: string): Symbol[];
  extractImports(content: string): string[];
}
