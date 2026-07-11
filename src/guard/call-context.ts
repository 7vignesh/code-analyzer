/**
 * Pull caller/callee context from the existing dependency graph.
 * Enriches SymbolDiffUnit[] with cross-file relationship information
 * so the LLM can detect breakages beyond the changed file.
 */

import * as path from 'path';
import { scanFiles, readFileContent } from '../scanner';
import { analyzeDependencyGraph } from '../ranker-enhanced';
import { getAdapter } from '../languages/registry';
import { buildReverseGraph } from '../blast-radius';
import { loadConfig } from '../config';
import type { SymbolDiffUnit } from './types';

/**
 * Enrich symbol diff units with caller and callee context.
 * Uses the project's dependency graph to find:
 * - callers: files that import the changed file (reverse deps)
 * - callees: files that the changed file imports (forward deps)
 */
export function enrichWithCallContext(
  units: SymbolDiffUnit[],
  root: string,
): SymbolDiffUnit[] {
  if (units.length === 0) return units;

  // Scan project files and build dependency graph
  const config = loadConfig(root);
  const allFiles = scanFiles(root, {
    extensions: config.extensions,
    exclude: config.exclude,
  });

  const forwardGraph = analyzeDependencyGraph(allFiles, root);
  const reverseGraph = buildReverseGraph(forwardGraph);

  // Group units by file
  const fileSet = new Set(units.map((u) => u.file));

  for (const unit of units) {
    const fileRel = unit.file;
    const fileNoExt = fileRel.replace(/\.[^.]+$/, '');
    const fileBase = path.basename(fileRel, path.extname(fileRel));

    // Find callers (files that import this file)
    const callers: string[] = [];
    for (const [key, importers] of reverseGraph.entries()) {
      const normalizedKey = key.split(path.sep).join('/');
      if (
        normalizedKey === fileRel ||
        normalizedKey === fileNoExt ||
        normalizedKey.endsWith('/' + fileBase)
      ) {
        for (const importer of importers) {
          callers.push(importer);
        }
      }
    }

    // Find callees (files this file imports)
    const callees: string[] = [];
    const normalizedFileRel = fileRel.split(path.sep).join('/');
    for (const [key, imports] of forwardGraph.entries()) {
      const normalizedKey = key.split(path.sep).join('/');
      if (normalizedKey === normalizedFileRel) {
        callees.push(...imports);
        break;
      }
    }

    // Format as "file:symbol" where possible
    unit.callers = [...new Set(callers)].slice(0, 10).map((c) => formatCallerRef(c, root));
    unit.callees = [...new Set(callees)].slice(0, 10);
  }

  return units;
}

/**
 * Format a caller file reference, attempting to identify which symbols
 * in that file actually reference the changed file.
 */
function formatCallerRef(callerFile: string, root: string): string {
  const absPath = path.join(root, callerFile);
  const content = readFileContent(absPath);
  if (!content) return callerFile;

  const adapter = getAdapter(absPath);
  const symbols = adapter.extractSymbols(content);

  // Return the file with its top exported symbols for context
  const topSymbols = symbols
    .filter((s) => s.kind === 'function' || s.kind === 'class')
    .slice(0, 3)
    .map((s) => s.name);

  if (topSymbols.length > 0) {
    return `${callerFile}:${topSymbols.join(',')}`;
  }
  return callerFile;
}
