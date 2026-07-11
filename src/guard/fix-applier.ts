/**
 * Fix applier — applies suggested fixes ONLY for fixable:true violations
 * from the current review run. Never expands scope beyond what was reviewed.
 *
 * Two-phase consent:
 * 1. Default: show a dry-run diff of what would change
 * 2. Only write when explicitly confirmed (--fix flag on same invocation)
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Violation } from './types';

export interface FixResult {
  file: string;
  symbol: string;
  rule_id: string;
  applied: boolean;
  diff: string;
}

/**
 * Filter violations to only fixable ones with a suggested fix.
 */
export function getFixableViolations(violations: Violation[]): Violation[] {
  return violations.filter((v) => v.fixable && v.suggested_fix);
}

/**
 * Generate a dry-run preview of what fixes would be applied.
 * Does NOT write to disk.
 */
export function previewFixes(violations: Violation[], root: string): FixResult[] {
  const fixable = getFixableViolations(violations);
  const results: FixResult[] = [];

  for (const v of fixable) {
    const absPath = path.join(root, v.file);
    if (!fs.existsSync(absPath)) {
      results.push({
        file: v.file,
        symbol: v.symbol,
        rule_id: v.rule_id,
        applied: false,
        diff: `[file not found: ${v.file}]`,
      });
      continue;
    }

    const content = fs.readFileSync(absPath, 'utf-8');
    const lines = content.split('\n');
    const startIdx = Math.max(0, v.line_start - 1);
    const endIdx = Math.min(lines.length, v.line_end);
    const originalLines = lines.slice(startIdx, endIdx);

    results.push({
      file: v.file,
      symbol: v.symbol,
      rule_id: v.rule_id,
      applied: false,
      diff: [
        `  ${v.file}:${v.line_start}-${v.line_end} (${v.rule_id})`,
        `  - ${originalLines.join('\n  - ')}`,
        `  + ${v.suggested_fix}`,
      ].join('\n'),
    });
  }

  return results;
}

/**
 * Apply fixes to disk. Only touches fixable:true violations with a suggested_fix.
 * Returns a summary of what was applied.
 *
 * IMPORTANT: This only applies fixes from violations passed in — never does a
 * fresh analysis pass. The caller is responsible for scoping.
 */
export function applyFixes(violations: Violation[], root: string): FixResult[] {
  const fixable = getFixableViolations(violations);
  const results: FixResult[] = [];

  // Group by file to minimize reads/writes
  const byFile = new Map<string, Violation[]>();
  for (const v of fixable) {
    const existing = byFile.get(v.file) ?? [];
    existing.push(v);
    byFile.set(v.file, existing);
  }

  for (const [file, fileViolations] of byFile.entries()) {
    const absPath = path.join(root, file);
    if (!fs.existsSync(absPath)) {
      for (const v of fileViolations) {
        results.push({
          file: v.file,
          symbol: v.symbol,
          rule_id: v.rule_id,
          applied: false,
          diff: `[file not found: ${v.file}]`,
        });
      }
      continue;
    }

    let content = fs.readFileSync(absPath, 'utf-8');
    const lines = content.split('\n');

    // Apply fixes in reverse line order to avoid offset drift
    const sorted = [...fileViolations].sort((a, b) => b.line_start - a.line_start);

    for (const v of sorted) {
      if (!v.suggested_fix) continue;

      const startIdx = Math.max(0, v.line_start - 1);
      const endIdx = Math.min(lines.length, v.line_end);
      const originalLines = lines.slice(startIdx, endIdx);

      // Replace the affected lines with the suggested fix
      lines.splice(startIdx, endIdx - startIdx, v.suggested_fix);

      results.push({
        file: v.file,
        symbol: v.symbol,
        rule_id: v.rule_id,
        applied: true,
        diff: [
          `  ${v.file}:${v.line_start}-${v.line_end} (${v.rule_id})`,
          `  - ${originalLines.join('\n  - ')}`,
          `  + ${v.suggested_fix}`,
        ].join('\n'),
      });
    }

    // Write the modified content back
    content = lines.join('\n');
    fs.writeFileSync(absPath, content, 'utf-8');
  }

  return results;
}

/**
 * Format fix results for terminal output.
 */
export function formatFixResults(results: FixResult[], dryRun: boolean): string {
  if (results.length === 0) {
    return '  No fixable violations to apply.';
  }

  const lines: string[] = [];
  const prefix = dryRun ? '  [DRY RUN] Would apply:' : '  Applied fixes:';
  lines.push(prefix);
  lines.push('');

  for (const r of results) {
    lines.push(r.diff);
    lines.push('');
  }

  if (!dryRun) {
    const files = [...new Set(results.filter((r) => r.applied).map((r) => r.file))];
    if (files.length > 0) {
      lines.push('  Changes are unstaged. To discard:');
      for (const f of files) {
        lines.push(`    git checkout -- ${f}`);
      }
    }
  }

  return lines.join('\n');
}
