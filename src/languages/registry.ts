import { LanguageAdapter } from './LanguageAdapter';
import { TypeScriptAdapter } from './TypeScriptAdapter';
import { PythonAdapter } from './PythonAdapter';
import { GenericAdapter } from './GenericAdapter';
import * as path from 'path';

const adapters: LanguageAdapter[] = [
  new TypeScriptAdapter(),
  new PythonAdapter(),
];

const generic = new GenericAdapter();

export function getAdapter(filePath: string): LanguageAdapter {
  const ext = path.extname(filePath).toLowerCase();
  return adapters.find((a) => a.extensions.includes(ext)) ?? generic;
}

export function detectRepoLanguages(root: string): string[] {
  const fs = require('fs');
  const extCount: Record<string, number> = {};
  walkAndCount(root, extCount, 0, 3);
  return Object.entries(extCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([ext]) => ext);
}

function walkAndCount(dir: string, counts: Record<string, number>, depth: number, maxDepth: number): void {
  if (depth > maxDepth) return;
  const fs = require('fs');
  const path = require('path');
  const ignored = new Set(['node_modules', '.git', 'dist', 'build', 'vendor', '__pycache__']);
  try {
    for (const entry of fs.readdirSync(dir)) {
      if (ignored.has(entry)) continue;
      const full = path.join(dir, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walkAndCount(full, counts, depth + 1, maxDepth);
      } else {
        const ext = path.extname(entry).toLowerCase();
        if (ext) counts[ext] = (counts[ext] ?? 0) + 1;
      }
    }
  } catch {
    // Ignore unreadable directories.
  }
}
