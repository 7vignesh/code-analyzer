export interface Symbol {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'export';
  line: number;
}

export interface LanguageAdapter {
  name: string;
  extensions: string[];
  canHandle(filePath: string): boolean;
  generateSkeleton(content: string, filePath: string): string;
  extractSymbols(content: string): Symbol[];
  extractImports(content: string): string[];
}
