/**
 * Benchmark script for code-analyzer
 * Demonstrates token reduction and analyzes performance on real codebases
 */

import { analyzeProject } from './index';
import { countTokens } from './tokenizer';
import { readFileContent } from './scanner';
import * as path from 'path';
import * as fs from 'fs';

interface BenchmarkResult {
  projectName: string;
  projectPath: string;
  query: string;
  totalFiles: number;
  analyzedFiles: number;
  totalTokens: number;
  skeletonTokens: number;
  reductionPercent: number;
  mappingGenerated: boolean;
  enhancedRanking: boolean;
  executionTimeMs: number;
  topFiles: Array<{
    path: string;
    score: number;
    originalTokens: number;
    skeletonTokens: number;
    reduction: number;
  }>;
}

/**
 * Run benchmark on a project
 */
async function benchmarkProject(
  projectPath: string,
  projectName: string,
  query: string,
  options: {
    limit?: number;
    enhancedRanking?: boolean;
    generateMapping?: boolean;
  } = {}
): Promise<BenchmarkResult> {
  const startTime = Date.now();

  const result = await analyzeProject({
    root: projectPath,
    question: query,
    limit: options.limit || 10,
    enhancedRanking: options.enhancedRanking || false,
    generateMapping: options.generateMapping || false,
  });

  const executionTimeMs = Date.now() - startTime;

  // Calculate totals
  let totalTokens = 0;
  let skeletonTokens = 0;

  const topFiles = result.files.map(f => {
    totalTokens += f.originalTokenCount;
    skeletonTokens += f.skeletonTokenCount;

    return {
      path: f.path,
      score: f.score,
      originalTokens: f.originalTokenCount,
      skeletonTokens: f.skeletonTokenCount,
      reduction: ((f.originalTokenCount - f.skeletonTokenCount) / f.originalTokenCount) * 100,
    };
  });

  const reductionPercent = totalTokens > 0
    ? ((totalTokens - skeletonTokens) / totalTokens) * 100
    : 0;

  return {
    projectName,
    projectPath,
    query,
    totalFiles: result.files.length,
    analyzedFiles: result.files.length,
    totalTokens,
    skeletonTokens,
    reductionPercent,
    mappingGenerated: options.generateMapping || false,
    enhancedRanking: options.enhancedRanking || false,
    executionTimeMs,
    topFiles,
  };
}

/**
 * Format benchmark results for display
 */
function formatResults(results: BenchmarkResult[]): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('         CODE ANALYZER BENCHMARK RESULTS');
  lines.push('═══════════════════════════════════════════════════════════════\n');

  for (const result of results) {
    lines.push(`\n📊 Project: ${result.projectName}`);
    lines.push(`   Query: "${result.query}"`);
    lines.push(`   Path: ${result.projectPath}`);
    lines.push('');
    lines.push(`   ⚙️  Configuration:`);
    lines.push(`      • Enhanced Ranking: ${result.enhancedRanking ? '✓' : '✗'}`);
    lines.push(`      • Mapping Generated: ${result.mappingGenerated ? '✓' : '✗'}`);
    lines.push(`      • Execution Time: ${result.executionTimeMs}ms`);
    lines.push('');
    lines.push(`   📈 Token Reduction:`);
    lines.push(`      • Original Tokens: ${result.totalTokens.toLocaleString()}`);
    lines.push(`      • Skeleton Tokens: ${result.skeletonTokens.toLocaleString()}`);
    lines.push(`      • Reduction: ${result.reductionPercent.toFixed(1)}% ⬇️`);
    lines.push('');
    lines.push(`   📁 Top Ranked Files (${result.analyzedFiles}):`);

    for (let i = 0; i < Math.min(5, result.topFiles.length); i++) {
      const file = result.topFiles[i];
      lines.push(`      ${i + 1}. ${file.path}`);
      lines.push(`         Score: ${file.score.toFixed(3)} | Tokens: ${file.originalTokens} → ${file.skeletonTokens} (${file.reduction.toFixed(1)}% ⬇️)`);
    }

    lines.push('');
    lines.push('───────────────────────────────────────────────────────────────');
  }

  lines.push('\n═══════════════════════════════════════════════════════════════');
  
  // Summary statistics
  const avgReduction = results.reduce((sum, r) => sum + r.reductionPercent, 0) / results.length;
  const totalOriginal = results.reduce((sum, r) => sum + r.totalTokens, 0);
  const totalSkeleton = results.reduce((sum, r) => sum + r.skeletonTokens, 0);
  const avgExecutionTime = results.reduce((sum, r) => sum + r.executionTimeMs, 0) / results.length;

  lines.push('\n📊 SUMMARY STATISTICS');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(`   Total Benchmarks: ${results.length}`);
  lines.push(`   Average Token Reduction: ${avgReduction.toFixed(1)}%`);
  lines.push(`   Total Original Tokens: ${totalOriginal.toLocaleString()}`);
  lines.push(`   Total Skeleton Tokens: ${totalSkeleton.toLocaleString()}`);
  lines.push(`   Average Execution Time: ${avgExecutionTime.toFixed(0)}ms`);
  lines.push('═══════════════════════════════════════════════════════════════\n');

  return lines.join('\n');
}

/**
 * Save benchmark results to JSON
 */
function saveBenchmarkResults(results: BenchmarkResult[], outputPath: string): void {
  const output = {
    generatedAt: new Date().toISOString(),
    benchmarks: results,
    summary: {
      totalBenchmarks: results.length,
      averageTokenReduction: results.reduce((sum, r) => sum + r.reductionPercent, 0) / results.length,
      totalOriginalTokens: results.reduce((sum, r) => sum + r.totalTokens, 0),
      totalSkeletonTokens: results.reduce((sum, r) => sum + r.skeletonTokens, 0),
      averageExecutionTime: results.reduce((sum, r) => sum + r.executionTimeMs, 0) / results.length,
    },
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\n✅ Benchmark results saved to: ${outputPath}`);
}

/**
 * Main benchmark function
 */
async function runBenchmarks(): Promise<void> {
  console.log('🚀 Starting Code Analyzer Benchmarks...\n');

  const results: BenchmarkResult[] = [];
  const selfPath = path.resolve(__dirname, '..');

  // Benchmark 1: Self-analysis with basic ranking
  console.log('Running Benchmark 1: Self-analysis (basic ranking)...');
  const bench1 = await benchmarkProject(
    selfPath,
    'code-analyzer (self)',
    'file ranking and skeleton generation',
    { limit: 5, enhancedRanking: false, generateMapping: false }
  );
  results.push(bench1);
  console.log(`✓ Completed in ${bench1.executionTimeMs}ms\n`);

  // Benchmark 2: Self-analysis with enhanced ranking
  console.log('Running Benchmark 2: Self-analysis (enhanced ranking)...');
  const bench2 = await benchmarkProject(
    selfPath,
    'code-analyzer (self)',
    'file ranking and skeleton generation',
    { limit: 5, enhancedRanking: true, generateMapping: false }
  );
  results.push(bench2);
  console.log(`✓ Completed in ${bench2.executionTimeMs}ms\n`);

  // Benchmark 3: Self-analysis with mapping
  console.log('Running Benchmark 3: Self-analysis (with mapping)...');
  const bench3 = await benchmarkProject(
    selfPath,
    'code-analyzer (self)',
    'agent integration and symbol mapping',
    { limit: 5, enhancedRanking: true, generateMapping: true }
  );
  results.push(bench3);
  console.log(`✓ Completed in ${bench3.executionTimeMs}ms\n`);

  // Benchmark 4: Different query
  console.log('Running Benchmark 4: Different query...');
  const bench4 = await benchmarkProject(
    selfPath,
    'code-analyzer (self)',
    'AST parsing and TypeScript analysis',
    { limit: 10, enhancedRanking: true, generateMapping: false }
  );
  results.push(bench4);
  console.log(`✓ Completed in ${bench4.executionTimeMs}ms\n`);

  // Display results
  console.log(formatResults(results));

  // Save to file
  const outputPath = path.join(selfPath, 'benchmark-results.json');
  saveBenchmarkResults(results, outputPath);
}

// CLI interface
if (require.main === module) {
  runBenchmarks()
    .then(() => {
      console.log('✅ Benchmarks completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Benchmark failed:', error);
      process.exit(1);
    });
}

export { benchmarkProject, formatResults, saveBenchmarkResults };
