import { LanguageAdapter, SkeletonResult, Symbol } from './LanguageAdapter';

export class GenericAdapter implements LanguageAdapter {
  name = 'generic';
  extensions: string[] = [];

  canHandle(): boolean {
    return true;
  }

  generateSkeleton(content: string, _filePath: string, _rootDir?: string): SkeletonResult {
    return { skeleton: content.split('\n').slice(0, 50).join('\n') };
  }

  extractSymbols(content: string): Symbol[] {
    const symbols: Symbol[] = [];
    const lines = content.split('\n');
    const seen = new Set<string>();

    lines.forEach((line, idx) => {
      const matches = line.match(/\b([A-Z][A-Za-z0-9]+|[a-z]+_[a-z0-9_]+)\b/g) || [];
      for (const match of matches) {
        if (seen.has(match)) {
          continue;
        }
        seen.add(match);
        symbols.push({
          name: match,
          kind: 'variable',
          line: idx + 1,
        });
      }
    });

    return symbols;
  }

  extractImports(content: string): string[] {
    const lines = content.split('\n').slice(0, 100);
    return lines
      .filter((line) => /^\s*(import|from|#include)\b/.test(line))
      .map((line) => line.trim());
  }
}
