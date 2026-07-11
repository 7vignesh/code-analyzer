/**
 * Blast Radius: determines downstream impact and risk of a git diff.
 *
 * Pipeline: parse diff → identify changed files → traverse reverse dependency
 * graph N hops → score affected nodes by centrality → flag untested nodes →
 * compute aggregate risk score.
 *
 * Limitation (v1): graph traversal is file-level, not symbol-level.
 * A changed file is treated as a unit; individual function-call edges are not
 * tracked. Symbol extraction from diffs is used for reporting only.
 */

import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import parseDiff from 'parse-diff';
import { scanFiles, readFileContent } from './scanner';
import { analyzeDependencyGraph } from './ranker-enhanced';
import { getAdapter } from './languages/registry';
import { loadConfig } from './config';
import type { Symbol } from './languages/LanguageAdapter';

// ---------------------------------------------------------------------------
// Risk formula weights (sum = 10). Shift toward WEIGHT_UNTESTED because
// untested affected code is the strongest signal that a merge is risky.
// ---------------------------------------------------------------------------
const WEIGHT_AFFECTED_COUNT = 2.5;
const WEIGHT_CENTRALITY = 2.5;
const WEIGHT_UNTESTED = 3.5;
const WEIGHT_HOP_SPREAD = 1.5;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A symbol touched by the diff within a single file. */
export interface ChangedSymbol {
  name: string;
  kind: Symbol['kind'];
  file: string;
}

/** A downstream file affected by the change, with metadata. */
export interface AffectedNode {
  /** Path relative to project root. */
  file: string;
  /** Number of hops from a changed file (1 = direct importer). */
  hopDistance: number;
  /** Normalized centrality score [0,1] — how many files depend on this one. */
  centrality: number;
  /** Whether a corresponding test file was found for this file. */
  hasTest: boolean;
}

/** Full blast-radius analysis result (shared between CLI text and JSON output). */
export interface BlastRadiusResult {
  /** Aggregate risk score (0–10). */
  riskScore: number;
  /** One-line human-readable summary. */
  summary: string;
  /** Files directly modified by the diff (relative paths). */
  changedFiles: string[];
  /** Symbols identified as changed within those files. */
  changedSymbols: ChangedSymbol[];
  /** All downstream affected files grouped by hop distance. */
  affectedNodes: AffectedNode[];
  /** Breakdown of the risk formula inputs (for transparency). */
  formulaInputs: {
    normalizedAffectedCount: number;
    avgCentrality: number;
    untestedRatio: number;
    normalizedMaxHopSpread: number;
  };
  /** Max hops used for this analysis. */
  hops: number;
}

/** Options accepted by computeBlastRadius. */
export interface BlastRadiusOptions {
  /** Absolute path to project root. */
  root: string;
  /** Raw unified diff content. If omitted, working-tree diff against HEAD is used. */
  diffContent?: string;
  /** Path to a diff file on disk. Takes precedence over diffContent if both given. */
  diffPath?: string;
  /** Maximum hop distance for traversal (default: 2). */
  hops?: number;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/** Compute the blast radius for a diff against a project. */
export function computeBlastRadius(options: BlastRadiusOptions): BlastRadiusResult {
  const { root, hops = 2 } = options;
  const diff = resolveDiff(options);
  const parsedFiles = parseDiff(diff);

  // 1. Extract changed file paths (relative to root).
  const changedFiles = extractChangedFiles(parsedFiles, root);

  if (changedFiles.length === 0) {
    return emptyResult(hops);
  }

  // 2. Extract changed symbols for reporting.
  const changedSymbols = extractChangedSymbolsFromDiff(parsedFiles, root);

  // 3. Build reverse dependency graph for the project.
  const allFiles = scanAllProjectFiles(root);
  const forwardGraph = analyzeDependencyGraph(allFiles, root);
  const reverseGraph = buildReverseGraph(forwardGraph);

  // 4. BFS N hops outward on reverse graph from changed files.
  const affectedMap = traverseAffected(changedFiles, reverseGraph, hops);

  // 5. Compute centrality for each affected node.
  const centralityMap = computeCentralityMap(reverseGraph, allFiles, root);

  // 6. Detect test files.
  const testFileSet = detectTestFiles(allFiles, root);

  // 7. Assemble AffectedNode list.
  const affectedNodes = buildAffectedNodes(affectedMap, centralityMap, testFileSet);

  // 8. Compute risk score.
  const formulaInputs = computeFormulaInputs(affectedNodes, allFiles.length, hops);
  const riskScore = computeRisk(formulaInputs);
  const summary = buildSummary(riskScore, changedFiles, affectedNodes);

  return {
    riskScore,
    summary,
    changedFiles,
    changedSymbols,
    affectedNodes,
    formulaInputs,
    hops,
  };
}

// ---------------------------------------------------------------------------
// Diff resolution
// ---------------------------------------------------------------------------

/** Resolve the diff content from options: file path > explicit string > git working tree. */
function resolveDiff(options: BlastRadiusOptions): string {
  if (options.diffPath) {
    const absPath = path.resolve(options.root, options.diffPath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`Diff file not found: ${absPath}`);
    }
    return fs.readFileSync(absPath, 'utf-8');
  }

  if (options.diffContent !== undefined) {
    return options.diffContent;
  }

  // Default: working tree diff against HEAD.
  try {
    return execSync('git diff HEAD', {
      cwd: options.root,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (err) {
    throw new Error(
      `Failed to run "git diff HEAD" in ${options.root}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Changed file extraction
// ---------------------------------------------------------------------------

/** Map diff file entries to relative paths within the project root. */
function extractChangedFiles(parsedFiles: parseDiff.File[], root: string): string[] {
  const files: string[] = [];
  for (const file of parsedFiles) {
    // parse-diff gives paths like "a/src/foo.ts" or "b/src/foo.ts"
    const raw = file.to ?? file.from;
    if (!raw || raw === '/dev/null') continue;
    // Strip the leading a/ or b/ prefix that git uses.
    const rel = raw.replace(/^[ab]\//, '');
    // Only include if the file exists in the project.
    if (fs.existsSync(path.join(root, rel))) {
      files.push(rel);
    }
  }
  return [...new Set(files)];
}

// ---------------------------------------------------------------------------
// Changed symbol extraction (reporting only — traversal is file-level)
// ---------------------------------------------------------------------------

/** Identify which symbols fall within changed line ranges in the diff. */
function extractChangedSymbolsFromDiff(
  parsedFiles: parseDiff.File[],
  root: string,
): ChangedSymbol[] {
  const symbols: ChangedSymbol[] = [];

  for (const file of parsedFiles) {
    const raw = file.to ?? file.from;
    if (!raw || raw === '/dev/null') continue;
    const rel = raw.replace(/^[ab]\//, '');
    const absPath = path.join(root, rel);
    if (!fs.existsSync(absPath)) continue;

    const content = readFileContent(absPath);
    if (!content) continue;

    const adapter = getAdapter(absPath);
    const fileSymbols = adapter.extractSymbols(content);

    // Collect changed line numbers from the diff.
    const changedLines = new Set<number>();
    for (const chunk of file.chunks) {
      for (const change of chunk.changes) {
        if (change.type === 'add' || change.type === 'del') {
          // 'ln' for add, 'ln' for del (line number in respective file)
          const lineNum = 'ln' in change ? (change as any).ln : undefined;
          if (typeof lineNum === 'number') {
            changedLines.add(lineNum);
          }
        }
      }
    }

    // Match symbols whose line overlaps a changed line.
    for (const sym of fileSymbols) {
      if (sym.kind === 'export') continue; // skip synthetic export markers
      if (changedLines.has(sym.line)) {
        symbols.push({ name: sym.name, kind: sym.kind, file: rel });
      }
    }
  }

  return symbols;
}

// ---------------------------------------------------------------------------
// Reverse dependency graph
// ---------------------------------------------------------------------------

/**
 * Invert the forward graph (file → imports) into a reverse graph
 * (file → files that import it).
 */
export function buildReverseGraph(
  forwardGraph: Map<string, string[]>,
): Map<string, string[]> {
  const reverse = new Map<string, string[]>();

  for (const [file, imports] of forwardGraph.entries()) {
    for (const imp of imports) {
      // The forward graph stores resolved relative paths (potentially without ext).
      // Match by checking if the import target's basename matches any known file.
      const importers = reverse.get(imp) ?? [];
      importers.push(file);
      reverse.set(imp, importers);
    }
  }

  return reverse;
}

// ---------------------------------------------------------------------------
// BFS traversal
// ---------------------------------------------------------------------------

/**
 * BFS from changed files outward on the reverse graph, up to maxHops.
 * Returns a map of affected file → hop distance (excluding the changed files
 * themselves).
 */
export function traverseAffected(
  changedFiles: string[],
  reverseGraph: Map<string, string[]>,
  maxHops: number,
): Map<string, number> {
  const visited = new Map<string, number>();
  const queue: Array<{ file: string; hop: number }> = [];

  // Seed with changed files at hop 0 (they won't appear in output).
  for (const file of changedFiles) {
    visited.set(file, 0);
    queue.push({ file, hop: 0 });
  }

  while (queue.length > 0) {
    const { file, hop } = queue.shift()!;
    if (hop >= maxHops) continue;

    const importers = findImporters(file, reverseGraph);
    for (const importer of importers) {
      if (!visited.has(importer)) {
        const nextHop = hop + 1;
        visited.set(importer, nextHop);
        queue.push({ file: importer, hop: nextHop });
      }
    }
  }

  // Remove the seed changed files from the result.
  for (const file of changedFiles) {
    visited.delete(file);
  }

  return visited;
}

/**
 * Find files that import the target, handling partial path matching.
 * The reverse graph keys may be partial (e.g. "src/utils" without extension)
 * and use OS-specific separators, so we normalize and match flexibly.
 */
function findImporters(target: string, reverseGraph: Map<string, string[]>): string[] {
  const normalize = (p: string) => p.split(path.sep).join('/');
  const normalizedTarget = normalize(target);
  const targetNoExt = normalizedTarget.replace(/\.[^.]+$/, '');
  const targetBase = path.basename(target, path.extname(target));

  // Direct lookup (normalized).
  for (const [key, files] of reverseGraph.entries()) {
    const normalizedKey = normalize(key);
    if (normalizedKey === normalizedTarget || normalizedKey === targetNoExt) {
      return files;
    }
  }

  // Fuzzy match: target is "src/utils.ts", graph key might be "src/utils".
  const importers: string[] = [];
  for (const [key, files] of reverseGraph.entries()) {
    const normalizedKey = normalize(key);
    if (normalizedKey.endsWith('/' + targetBase) || normalizedKey === targetBase) {
      importers.push(...files);
    }
  }

  return importers;
}

// ---------------------------------------------------------------------------
// Centrality computation
// ---------------------------------------------------------------------------

/**
 * Compute normalized in-degree centrality for all project files.
 * Centrality = (number of files that import this file) / max(in-degrees).
 * This reuses the reverse graph already built from analyzeDependencyGraph output.
 */
function computeCentralityMap(
  reverseGraph: Map<string, string[]>,
  allFiles: string[],
  root: string,
): Map<string, number> {
  // Count in-degree for each file (by relative path).
  const inDegree = new Map<string, number>();
  for (const file of allFiles) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    inDegree.set(rel, 0);
  }

  for (const [_, importers] of reverseGraph.entries()) {
    // Each entry's importers list tells us who imports the key.
    // The key itself gains in-degree equal to importers.length — but that's
    // backwards. The importers are the files that import the key.
    // So the key's in-degree (how many depend on it) = importers.length.
    // But we want: for each affected file, how many files depend on IT.
    // So we need reverse-of-reverse = forward. Let's just count directly.
  }

  // Simpler approach: count how many times each file appears as an import target.
  // That's exactly what the reverse graph encodes: key = import target, value = importers.
  for (const [target, importers] of reverseGraph.entries()) {
    const existing = inDegree.get(target);
    if (existing !== undefined) {
      inDegree.set(target, importers.length);
    } else {
      // target may be a partial path — try to match to an allFiles entry
      for (const file of allFiles) {
        const rel = path.relative(root, file).split(path.sep).join('/');
        const relNoExt = rel.replace(/\.[^.]+$/, '');
        if (rel === target || relNoExt === target || relNoExt.endsWith('/' + target)) {
          inDegree.set(rel, (inDegree.get(rel) ?? 0) + importers.length);
        }
      }
    }
  }

  // Normalize to [0,1].
  const maxDegree = Math.max(1, ...inDegree.values());
  const centralityMap = new Map<string, number>();
  for (const [file, degree] of inDegree.entries()) {
    centralityMap.set(file, degree / maxDegree);
  }

  return centralityMap;
}

// ---------------------------------------------------------------------------
// Test file detection
// ---------------------------------------------------------------------------

/**
 * Detect test files using the conventions present in this repo:
 * - Files in tests/ directory with .test.ts suffix
 * - Files matching *.test.ts, *.spec.ts anywhere
 * - Files inside __tests__/ directories
 *
 * Returns a set of source-file relative paths that have at least one test file.
 */
function detectTestFiles(allFiles: string[], root: string): Set<string> {
  const testPatterns = /\.(test|spec)\.(ts|tsx|js|jsx)$|[/\\]__tests__[/\\]/;
  const testedSources = new Set<string>();

  // Collect all test files.
  const testFiles: string[] = [];
  for (const file of allFiles) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    if (testPatterns.test(rel)) {
      testFiles.push(rel);
    }
  }

  // Also scan the tests/ directory specifically (may not be in allFiles if not
  // under a scanned module).
  const testsDir = path.join(root, 'tests');
  if (fs.existsSync(testsDir)) {
    const entries = fs.readdirSync(testsDir, { recursive: true });
    for (const entry of entries) {
      const rel = 'tests/' + String(entry).split(path.sep).join('/');
      if (testPatterns.test(rel)) {
        testFiles.push(rel);
      }
    }
  }

  // For each test file, infer which source file it covers.
  // Convention: tests/ranker.test.ts covers src/ranker.ts
  //             src/__tests__/foo.test.ts covers src/foo.ts
  for (const testFile of testFiles) {
    const base = path.basename(testFile)
      .replace(/\.(test|spec)\.(ts|tsx|js|jsx)$/, '');

    // Match against all known source-relative paths.
    for (const file of allFiles) {
      const rel = path.relative(root, file).split(path.sep).join('/');
      if (testPatterns.test(rel)) continue; // skip other test files
      const srcBase = path.basename(rel, path.extname(rel));
      if (srcBase === base) {
        testedSources.add(rel);
      }
    }
  }

  return testedSources;
}

// ---------------------------------------------------------------------------
// Assemble affected nodes
// ---------------------------------------------------------------------------

function buildAffectedNodes(
  affectedMap: Map<string, number>,
  centralityMap: Map<string, number>,
  testFileSet: Set<string>,
): AffectedNode[] {
  const nodes: AffectedNode[] = [];
  for (const [file, hopDistance] of affectedMap.entries()) {
    nodes.push({
      file,
      hopDistance,
      centrality: centralityMap.get(file) ?? 0,
      hasTest: testFileSet.has(file),
    });
  }
  // Sort: higher centrality first within each hop group.
  nodes.sort((a, b) => a.hopDistance - b.hopDistance || b.centrality - a.centrality);
  return nodes;
}

// ---------------------------------------------------------------------------
// Risk score computation
// ---------------------------------------------------------------------------

/**
 * Risk score formula (0–10):
 *
 *   risk = WEIGHT_AFFECTED_COUNT * normalizedAffectedCount
 *        + WEIGHT_CENTRALITY     * avgCentrality
 *        + WEIGHT_UNTESTED       * untestedRatio
 *        + WEIGHT_HOP_SPREAD     * normalizedMaxHopSpread
 *
 * Where:
 *   normalizedAffectedCount = min(affectedCount / totalProjectFiles, 1)
 *   avgCentrality           = mean centrality of affected nodes [0,1]
 *   untestedRatio           = fraction of affected nodes with no test [0,1]
 *   normalizedMaxHopSpread  = maxHopReached / maxHopsConfigured [0,1]
 *
 * Weights: 2.5 + 2.5 + 3.5 + 1.5 = 10
 */
function computeFormulaInputs(
  affectedNodes: AffectedNode[],
  totalFiles: number,
  maxHops: number,
): BlastRadiusResult['formulaInputs'] {
  if (affectedNodes.length === 0) {
    return {
      normalizedAffectedCount: 0,
      avgCentrality: 0,
      untestedRatio: 0,
      normalizedMaxHopSpread: 0,
    };
  }

  const normalizedAffectedCount = Math.min(affectedNodes.length / Math.max(totalFiles, 1), 1);
  const avgCentrality =
    affectedNodes.reduce((sum, n) => sum + n.centrality, 0) / affectedNodes.length;
  const untestedCount = affectedNodes.filter((n) => !n.hasTest).length;
  const untestedRatio = untestedCount / affectedNodes.length;
  const maxHopReached = Math.max(...affectedNodes.map((n) => n.hopDistance));
  const normalizedMaxHopSpread = maxHopReached / Math.max(maxHops, 1);

  return { normalizedAffectedCount, avgCentrality, untestedRatio, normalizedMaxHopSpread };
}

function computeRisk(inputs: BlastRadiusResult['formulaInputs']): number {
  const raw =
    WEIGHT_AFFECTED_COUNT * inputs.normalizedAffectedCount +
    WEIGHT_CENTRALITY * inputs.avgCentrality +
    WEIGHT_UNTESTED * inputs.untestedRatio +
    WEIGHT_HOP_SPREAD * inputs.normalizedMaxHopSpread;

  return Math.round(raw * 10) / 10; // one decimal place
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function buildSummary(
  riskScore: number,
  changedFiles: string[],
  affectedNodes: AffectedNode[],
): string {
  const untested = affectedNodes.filter((n) => !n.hasTest).length;
  const riskLabel =
    riskScore <= 2 ? 'low' : riskScore <= 5 ? 'moderate' : riskScore <= 7.5 ? 'high' : 'critical';
  return (
    `Risk ${riskScore}/10 (${riskLabel}): ` +
    `${changedFiles.length} file(s) changed, ` +
    `${affectedNodes.length} downstream affected, ` +
    `${untested} untested.`
  );
}

// ---------------------------------------------------------------------------
// Output formatters
// ---------------------------------------------------------------------------

/** Plain-text report for terminal output. */
export function formatBlastRadiusText(result: BlastRadiusResult): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(`  Blast Radius Analysis (${result.hops}-hop traversal)`);
  lines.push('  ' + '─'.repeat(50));
  lines.push('');
  lines.push(`  Risk Score: ${result.riskScore}/10`);
  lines.push(`  ${result.summary}`);
  lines.push('');

  // Changed files.
  lines.push('  Changed files:');
  for (const f of result.changedFiles) {
    lines.push(`    ${f}`);
  }
  lines.push('');

  // Changed symbols.
  if (result.changedSymbols.length > 0) {
    lines.push('  Changed symbols:');
    for (const s of result.changedSymbols) {
      lines.push(`    ${s.kind} ${s.name} (${s.file})`);
    }
    lines.push('');
  }

  // Affected nodes grouped by hop.
  if (result.affectedNodes.length > 0) {
    const maxHop = Math.max(...result.affectedNodes.map((n) => n.hopDistance));
    for (let hop = 1; hop <= maxHop; hop++) {
      const atHop = result.affectedNodes.filter((n) => n.hopDistance === hop);
      if (atHop.length === 0) continue;
      lines.push(`  Hop ${hop} (${atHop.length} file${atHop.length > 1 ? 's' : ''}):`);
      for (const node of atHop) {
        const testTag = node.hasTest ? '' : ' [NO TEST]';
        lines.push(
          `    ${node.file}  centrality=${node.centrality.toFixed(2)}${testTag}`,
        );
      }
      lines.push('');
    }
  } else {
    lines.push('  No downstream files affected.');
    lines.push('');
  }

  // Formula transparency.
  const fi = result.formulaInputs;
  lines.push('  Formula inputs:');
  lines.push(`    affected_count (normalized): ${fi.normalizedAffectedCount.toFixed(3)}`);
  lines.push(`    avg_centrality:              ${fi.avgCentrality.toFixed(3)}`);
  lines.push(`    untested_ratio:              ${fi.untestedRatio.toFixed(3)}`);
  lines.push(`    hop_spread (normalized):     ${fi.normalizedMaxHopSpread.toFixed(3)}`);
  lines.push('');

  return lines.join('\n');
}

/** JSON output (for --json flag and MCP). */
export function formatBlastRadiusJson(result: BlastRadiusResult): string {
  return JSON.stringify(result, null, 2);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Scan all project source files using existing scanner infrastructure. */
function scanAllProjectFiles(root: string): string[] {
  const config = loadConfig(root);
  return scanFiles(root, {
    extensions: config.extensions,
    exclude: config.exclude,
  });
}

/** Return an empty result when no files were changed. */
function emptyResult(hops: number): BlastRadiusResult {
  return {
    riskScore: 0,
    summary: 'No changed files detected in diff.',
    changedFiles: [],
    changedSymbols: [],
    affectedNodes: [],
    formulaInputs: {
      normalizedAffectedCount: 0,
      avgCentrality: 0,
      untestedRatio: 0,
      normalizedMaxHopSpread: 0,
    },
    hops,
  };
}
