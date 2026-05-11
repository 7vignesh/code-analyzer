import * as path from 'path';
import { LanguageAdapter, SkeletonResult, Symbol } from './LanguageAdapter';

export class PythonAdapter implements LanguageAdapter {
  name = 'python';
  extensions = ['.py', '.pyi'];

  canHandle(filePath: string): boolean {
    return this.extensions.includes(path.extname(filePath).toLowerCase());
  }

  generateSkeleton(content: string, _filePath: string, _rootDir?: string): SkeletonResult {
    const lines = content.split('\n');
    const output: string[] = [];
    const keepers = /^(?:\s*(?:@[\w.]+(?:\([^)]*\))?|(?:async\s+)?def\s+[\w_]+\s*\(.*\)\s*(?:->\s*[^:]+)?\s*:|class\s+[\w_]+(?:\([^)]*\))?\s*:|(?:from\s+\S+\s+import\s+.+)|(?:import\s+.+)|[A-Za-z_]\w*\s*=.+))/;

    for (const line of lines) {
      if (!keepers.test(line)) {
        continue;
      }

      if (/^\s*(?:async\s+)?def\s+/.test(line)) {
        const indent = line.match(/^(\s*)/)?.[1] ?? '';
        output.push(line);
        output.push(`${indent}    ...`);
        continue;
      }

      output.push(line);
    }

    return { skeleton: output.join('\n').trim() };
  }

  extractSymbols(content: string): Symbol[] {
    const lines = content.split('\n');
    const symbols: Symbol[] = [];

    lines.forEach((line, idx) => {
      const classMatch = line.match(/^\s*class\s+([A-Za-z_]\w*)/);
      if (classMatch) {
        symbols.push({ name: classMatch[1], kind: 'class', line: idx + 1 });
      }

      const functionMatch = line.match(/^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)/);
      if (functionMatch) {
        symbols.push({ name: functionMatch[1], kind: 'function', line: idx + 1 });
      }

      const variableMatch = line.match(/^([A-Za-z_]\w*)\s*=/);
      if (variableMatch) {
        symbols.push({ name: variableMatch[1], kind: 'variable', line: idx + 1 });
      }
    });

    return symbols;
  }

  extractImports(content: string): string[] {
    const imports: string[] = [];
    const lines = content.split('\n');
    for (const line of lines) {
      const fromMatch = line.match(/^\s*from\s+([A-Za-z0-9_.]+)\s+import\s+/);
      if (fromMatch) {
        imports.push(fromMatch[1]);
      }
      const importMatch = line.match(/^\s*import\s+(.+)/);
      if (importMatch) {
        imports.push(importMatch[1].split(',')[0].trim());
      }
    }
    return imports;
  }
}
