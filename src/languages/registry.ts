/**
 * Language adapter registry.
 * Routes files to the appropriate parser based on extension.
 */

import { LanguageAdapter } from './LanguageAdapter';
import { TypeScriptAdapter } from './TypeScriptAdapter';
import { TreeSitterAdapter } from './TreeSitterAdapter';
import { GenericAdapter } from './GenericAdapter';
import { LANG_CONFIGS } from './lang-config';
import * as path from 'path';

const tsAdapter = new TypeScriptAdapter();
const treeSitterAdapter = new TreeSitterAdapter(Object.values(LANG_CONFIGS));
const generic = new GenericAdapter();

// Initialize tree-sitter WASM in background (non-blocking).
treeSitterAdapter.initializeSync();

const adapters: LanguageAdapter[] = [
  tsAdapter,
  treeSitterAdapter,
];

export function getAdapter(filePath: string): LanguageAdapter {
  const ext = path.extname(filePath).toLowerCase();
  return adapters.find((a) => a.extensions.includes(ext)) ?? generic;
}

/** Await full initialization of WASM-based adapters. */
export async function initializeAdapters(): Promise<void> {
  await treeSitterAdapter.initialize();
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
