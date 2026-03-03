/**
 * Benchmark script for code-analyzer
 * Runs against the Rocket.Chat monorepo to demonstrate real-world token reduction.
 * Compares full-scan token cost vs skeletonized analysis across representative queries.
 */

import { analyzeProject } from './index';
import { scanTypeScriptFiles } from './scanner';
import { countTokens } from './tokenizer';
import * as path from 'path';
import * as fs from 'fs';

interface BenchmarkResult {
  projectName: string;
  projectRoot: string;
  query: string;
  // Baseline: what an LLM would consume reading ALL files
  allFilesCount: number;
  allFilesTotalTokens: number;
  // Our tool output
  analyzedFileCount: number;
  analyzedOriginalTokens: number;
  analyzedSkeletonTokens: number;
  tokenReductionVsFullScan: number;   // skeleton vs full-repo scan
  tokenReductionVsTopN: number;       // skeleton vs top-N original files
  enhancedRanking: boolean;
  executionTimeMs: number;
  topFiles: {
    path: string;
    score: number;
    originalTokens: number;
    skeletonTokens: number;
    reductionPct: number;
  }[];
}

/**
 * Quickly sum tokens across all .ts/.tsx files in a directory.
 * Uses a capped sample to stay fast, then extrapolates.
 */
function sampleDirectoryTokens(
  rootPath: string,
  maxFiles = 50
): { fileCount: number; totalTokens: number; isSampled: boolean } {
  const allFiles = scanTypeScriptFiles(rootPath);
  const isSampled = allFiles.length > maxFiles;
  const filesToRead = isSampled ? allFiles.slice(0, maxFiles) : allFiles;

  let totalTokens = 0;
  for (const f of filesToRead) {
    try {
      const content = fs.readFileSync(f, 'utf-8');
      totalTokens += countTokens(content);
    } catch {
      // skip unreadable
    }
  }

  const estimatedTotal = isSampled
    ? Math.round((totalTokens / filesToRead.length) * allFiles.length)
    : totalTokens;

  return { fileCount: allFiles.length, totalTokens: estimatedTotal, isSampled };
}

/**
 * Run a single benchmark scenario
 */
async function benchmarkProject(
  projectRoot: string,
  projectName: string,
  query: string,
  options: { limit?: number; enhancedRanking?: boolean } = {}
): Promise<BenchmarkResult> {
  const limit = options.limit ?? 10;

  // Baseline: estimate full-repo token cost
  const baseline = sampleDirectoryTokens(projectRoot, 200);

  const start = Date.now();
  const result = await analyzeProject({
    root: projectRoot,
    question: query,
    limit,
    enhancedRanking: options.enhancedRanking ?? true,
    generateMapping: false,
  });
  const executionTimeMs = Date.now() - start;

  let analyzedOriginal = 0;
  let analyzedSkeleton = 0;

  const topFiles = result.files.map(f => {
    analyzedOriginal += f.originalTokenCount;
    analyzedSkeleton += f.skeletonTokenCount;
    return {
      path: f.path,
      score: f.score,
      originalTokens: f.originalTokenCount,
      skeletonTokens: f.skeletonTokenCount,
      reductionPct:
        f.originalTokenCount > 0
          ? ((f.originalTokenCount - f.skeletonTokenCount) / f.originalTokenCount) * 100
          : 0,
    };
  });

  const tokenReductionVsFullScan =
    baseline.totalTokens > 0
      ? ((baseline.totalTokens - analyzedSkeleton) / baseline.totalTokens) * 100
      : 0;

  const tokenReductionVsTopN =
    analyzedOriginal > 0
      ? ((analyzedOriginal - analyzedSkeleton) / analyzedOriginal) * 100
      : 0;

  return {
    projectName,
    projectRoot,
    query,
    allFilesCount: baseline.fileCount,
    allFilesTotalTokens: baseline.totalTokens,
    analyzedFileCount: result.files.length,
    analyzedOriginalTokens: analyzedOriginal,
    analyzedSkeletonTokens: analyzedSkeleton,
    tokenReductionVsFullScan,
    tokenReductionVsTopN,
    enhancedRanking: options.enhancedRanking ?? true,
    executionTimeMs,
    topFiles,
  };
}

/**
 * Format results for console output
 */
function formatResults(results: BenchmarkResult[]): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════════════════════');
  lines.push('          CODE ANALYZER BENCHMARK — Rocket.Chat Monorepo');
  lines.push('═══════════════════════════════════════════════════════════════════════\n');

  for (const r of results) {
    lines.push(`\n📊  ${r.projectName}`);
    lines.push(`    Query: "${r.query}"`);
    lines.push('');
    lines.push(`    🗂  Repository Baseline (naive full-scan):`);
    lines.push(`        Total .ts/.tsx files : ${r.allFilesCount.toLocaleString()}`);
    lines.push(`        Estimated tokens     : ${r.allFilesTotalTokens.toLocaleString()}`);
    lines.push('');
    lines.push(`    ⚙️  Our Tool (top ${r.analyzedFileCount} files, enhanced ranking: ${r.enhancedRanking ? '✓' : '✗'}):`);
    lines.push(`        Original tokens sent : ${r.analyzedOriginalTokens.toLocaleString()}`);
    lines.push(`        Skeleton tokens sent : ${r.analyzedSkeletonTokens.toLocaleString()}`);
    lines.push(`        Reduction vs full scan  : ${r.tokenReductionVsFullScan.toFixed(1)}% ⬇️`);
    lines.push(`        Reduction vs top-N raw  : ${r.tokenReductionVsTopN.toFixed(1)}% ⬇️`);
    lines.push(`        Execution time          : ${r.executionTimeMs}ms`);
    lines.push('');
    lines.push(`    📁  Top Ranked Files:`);
    for (let i = 0; i < Math.min(5, r.topFiles.length); i++) {
      const f = r.topFiles[i];
      lines.push(
        `        ${i + 1}. ${f.path}`
      );
      lines.push(
        `           Score: ${f.score.toFixed(3)}  |  ${f.originalTokens} → ${f.skeletonTokens} tokens  (${f.reductionPct.toFixed(1)}% ⬇️)`
      );
    }
    lines.push('');
    lines.push('───────────────────────────────────────────────────────────────────────');
  }

  // Summary
  const avgReductionFullScan =
    results.reduce((s, r) => s + r.tokenReductionVsFullScan, 0) / results.length;
  const avgReductionTopN =
    results.reduce((s, r) => s + r.tokenReductionVsTopN, 0) / results.length;
  const avgTime =
    results.reduce((s, r) => s + r.executionTimeMs, 0) / results.length;

  lines.push('\n📊  SUMMARY');
  lines.push('───────────────────────────────────────────────────────────────────────');
  lines.push(`    Benchmarks run               : ${results.length}`);
  lines.push(`    Avg reduction vs full scan   : ${avgReductionFullScan.toFixed(1)}%`);
  lines.push(`    Avg reduction vs top-N raw   : ${avgReductionTopN.toFixed(1)}%`);
  lines.push(`    Avg execution time           : ${avgTime.toFixed(0)}ms`);
  lines.push('═══════════════════════════════════════════════════════════════════════\n');

  return lines.join('\n');
}

/**
 * Save benchmark output to JSON
 */
function saveResults(results: BenchmarkResult[], outputPath: string): void {
  const out = {
    generatedAt: new Date().toISOString(),
    rocketChatRoot: results[0]?.projectRoot ?? '',
    summary: {
      avgReductionVsFullScan:
        results.reduce((s, r) => s + r.tokenReductionVsFullScan, 0) / results.length,
      avgReductionVsTopN:
        results.reduce((s, r) => s + r.tokenReductionVsTopN, 0) / results.length,
      avgExecutionTimeMs:
        results.reduce((s, r) => s + r.executionTimeMs, 0) / results.length,
    },
    benchmarks: results,
  };
  fs.writeFileSync(outputPath, JSON.stringify(out, null, 2), 'utf-8');
  console.log(`\n✅  Results saved → ${outputPath}`);
}

/**
 * Main entry point
 */
async function runBenchmarks(): Promise<void> {
  const RC_METEOR = '/home/manu/vignesh/Rocket.Chat/apps/meteor';

  // Verify repo exists
  if (!fs.existsSync(RC_METEOR)) {
    console.error(`❌  Rocket.Chat not found at ${RC_METEOR}`);
    console.error('    Clone it: git clone https://github.com/RocketChat/Rocket.Chat');
    process.exit(1);
  }

  // Full-app baseline: estimate token cost if an LLM had to read everything
  const appRoot = `${RC_METEOR}/app`;
  console.log('🚀  Code Analyzer — Rocket.Chat Monorepo Benchmarks\n');
  console.log(`    Repo : ${RC_METEOR}`);
  console.log(`    Computing full-app/ baseline (first 50 files sample)...`);
  const fullBaseline = sampleDirectoryTokens(appRoot, 50);
  console.log(`    Full app/ → ${fullBaseline.fileCount} .ts files, ` +
    `~${fullBaseline.totalTokens.toLocaleString()} tokens (${fullBaseline.isSampled ? 'extrapolated' : 'exact'})\n`);

  const results: BenchmarkResult[] = [];

  // ── 1. lib/server/functions — "send message" (same scope as Echo's benchmark) ─
  console.log('▶  [1/4] send message to room  (app/lib/server/functions — 63 files)');
  results.push(await benchmarkProject(
    `${RC_METEOR}/app/lib/server/functions`,
    'Rocket.Chat › lib/server/functions',
    'send message to room',
    { limit: 10, enhancedRanking: true }
  ));
  console.log(`   ✓ ${results.at(-1)!.executionTimeMs}ms\n`);

  // ── 2. authorization — "user permissions" ────────────────────────────────────
  console.log('▶  [2/4] user permissions and access control  (app/authorization — 22 files)');
  results.push(await benchmarkProject(
    `${RC_METEOR}/app/authorization`,
    'Rocket.Chat › authorization',
    'user permissions and access control',
    { limit: 10, enhancedRanking: true }
  ));
  console.log(`   ✓ ${results.at(-1)!.executionTimeMs}ms\n`);

  // ── 3. e2e — "end-to-end encryption" ─────────────────────────────────────────
  console.log('▶  [3/4] end-to-end encryption  (app/e2e — 21 files)');
  results.push(await benchmarkProject(
    `${RC_METEOR}/app/e2e`,
    'Rocket.Chat › e2e',
    'end-to-end encryption key management',
    { limit: 10, enhancedRanking: true }
  ));
  console.log(`   ✓ ${results.at(-1)!.executionTimeMs}ms\n`);

  // ── 4. file-upload — "file upload handling" ───────────────────────────────────
  console.log('▶  [4/4] file upload and media handling  (app/file-upload — 21 files)');
  results.push(await benchmarkProject(
    `${RC_METEOR}/app/file-upload`,
    'Rocket.Chat › file-upload',
    'file upload and media handling',
    { limit: 10, enhancedRanking: true }
  ));
  console.log(`   ✓ ${results.at(-1)!.executionTimeMs}ms\n`);

  // ── Output ────────────────────────────────────────────────────────────────────
  console.log(formatResults(results));

  // Append full-app baseline note to the formatted output
  console.log(`ℹ️  Full app/ baseline (naive full-scan):`);
  console.log(`    ${fullBaseline.fileCount} files  →  ~${fullBaseline.totalTokens.toLocaleString()} tokens`);
  console.log(`    vs our tool avg skeleton: ~${Math.round(results.reduce((s, r) => s + r.analyzedSkeletonTokens, 0) / results.length).toLocaleString()} tokens per query\n`);

  const outputPath = path.join(__dirname, '..', 'benchmark-results.json');
  // Attach baseline to JSON output
  const extendedResults = {
    fullAppBaseline: {
      root: appRoot,
      fileCount: fullBaseline.fileCount,
      estimatedTotalTokens: fullBaseline.totalTokens,
      isSampled: fullBaseline.isSampled,
    },
    benchmarks: results,
  };
  fs.writeFileSync(outputPath, JSON.stringify(extendedResults, null, 2), 'utf-8');
  console.log(`✅  Saved → ${outputPath}`);
}

// ── Run ───────────────────────────────────────────────────────────────────────
if (require.main === module) {
  runBenchmarks()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌  Benchmark failed:', err);
      process.exit(1);
    });
}

export { benchmarkProject, formatResults, saveResults };

