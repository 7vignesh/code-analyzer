#!/usr/bin/env node

/**
 * CLI entry point for skannr
 */

import { Command, InvalidArgumentError } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { analyzeProject, getCacheManager } from './index';
import {
  formatHuman,
  formatJson,
  formatMarkdown,
  withCliMetrics,
} from './formatter';
import { loadConfig } from './config';
import { discoverModules, scanFiles } from './scanner';
import { detectRepoLanguages } from './languages/registry';
import {
  askTelemetryConsent,
  setTelemetryExplicit,
  track,
} from './telemetry';

const VERSION = '0.1.1';

const VALID_LANGS = ['typescript', 'javascript', 'python', 'auto'] as const;
type Lang = (typeof VALID_LANGS)[number];

function resolveExtensionsForLanguage(lang: Lang): string[] | undefined {
  switch (lang) {
    case 'typescript':
    case 'javascript':
      return ['.ts', '.tsx', '.js', '.jsx'];
    case 'python':
      return ['.py', '.pyi'];
    case 'auto':
    default:
      return undefined;
  }
}

function printNoFilesError(): void {
  console.error(
    [
      '',
      '  ✗ No files found to analyze.',
      '',
      '  Possible causes:',
      '    · --root points to an empty or non-existent directory',
      '    · All files are excluded by .gitignore or default excludes',
      '    · --lang filter is too restrictive for this repo',
      '',
      '  Try: skannr --question "..." --root /path/to/repo',
      '       skannr --question "..." --root . --lang auto',
      '',
    ].join('\n'),
  );
}

function assertRootExists(absoluteRoot: string): void {
  if (!fs.existsSync(absoluteRoot)) {
    console.error('');
    console.error(`  ✗ Directory does not exist: ${absoluteRoot}`);
    console.error('');
    console.error('  Check --root points to a valid project path.');
    console.error('');
    process.exit(1);
  }
  if (!fs.statSync(absoluteRoot).isDirectory()) {
    console.error('');
    console.error(`  ✗ Not a directory: ${absoluteRoot}`);
    console.error('');
    process.exit(1);
  }
}

function runReport(root: string, lang: Lang): void {
  const absoluteRoot = path.resolve(root);
  assertRootExists(absoluteRoot);
  const config = loadConfig(absoluteRoot);
  const moduleKeys =
    config.modules ? Object.keys(config.modules) : discoverModules(absoluteRoot);
  const extensions = resolveExtensionsForLanguage(lang) ?? config.extensions;
  const files = scanFiles(absoluteRoot, {
    extensions,
    exclude: config.exclude,
    moduleKeys,
    moduleDefinitions: config.modules,
  });
  const languages = detectRepoLanguages(absoluteRoot);
  const report = {
    type: 'report' as const,
    version: VERSION,
    root: absoluteRoot,
    scannedFileCount: files.length,
    moduleKeys,
    languages,
    extensions: extensions ?? 'auto (from repo)',
  };
  console.log(JSON.stringify(report, null, 2));
}

const program = new Command();

program
  .name('skannr')
  .description(
    [
      'Analyze any codebase. Ask questions. Get ranked, compressed file skeletons.',
      'Powered by hybrid retrieval: lexical + structural + dependency-graph.',
      '',
      'Docs: https://skannr-ten.vercel.app',
    ].join('\n'),
  )
  .version(VERSION)
  .option('--root <path>', 'project root directory', process.cwd())
  .option('--question <text>', 'natural language question about the codebase')
  .option(
    '--limit <number>',
    'number of top files to analyze',
    (value: string) => {
      const n = parseInt(value, 10);
      if (Number.isNaN(n) || n < 1) {
        throw new InvalidArgumentError('must be a positive number');
      }
      return n;
    },
  )
  .option('--with-mapping', 'generate symbol mapping for on-demand retrieval')
  .option('--mapping-output <path>', 'custom path for mapping file (implies --with-mapping)')
  .option('--modules <keys>', 'comma-separated module keys (auto-discovered when omitted)')
  .option(
    '--lang <mode>',
    'language filter: typescript | javascript | python | auto (default: auto)',
  )
  .option('--skip-cache', 'skip cache and force full analysis')
  .option('--cache-clear', 'clear all cached analysis results')
  .option('--cache-stats', 'show cache statistics')
  .option('--report', 'print repository health report (JSON) instead of running a question')
  .option('--diff <ref>', 'limit analysis to files changed vs git ref (not available yet)')
  .option(
    '--format <format>',
    'output format: human, markdown, or json',
    'human',
  )
  .option('--watch', 'watch for file changes and re-analyze automatically')
  .option('--telemetry-on', 'enable anonymous usage telemetry (flags only)')
  .option('--telemetry-off', 'disable anonymous usage telemetry')
  .option('--mcp', 'run as Model Context Protocol stdio server (same as skannr-mcp)');

program.addHelpText(
  'after',
  `
Examples:
  skannr --question "how does auth work?" --root .
  skannr --question "database setup" --root /path/to/repo --limit 5
  skannr --question "class structure" --root . --lang python
  skannr --question "changed files" --root . --diff HEAD~1
  skannr --report --root .                     # health report
  skannr --question "..." --root . --format markdown
  skannr --question "..." --root . --format json
  skannr --question "..." --root . --watch      # re-run on file changes
  skannr-agent --root .                         # interactive mode

Monorepo tip:
  skannr --question "..." --root packages/my-package

MCP (stdio): npx -y skannr --mcp   (or: skannr-mcp)
  Cursor: { "mcpServers": { "skannr": { "command": "npx", "args": ["-y", "skannr", "--mcp"] } } }
`,
);

program.parse(process.argv);

const opts = program.opts<{
  root: string;
  question?: string;
  limit?: number;
  withMapping?: boolean;
  mappingOutput?: string;
  modules?: string;
  lang?: string;
  skipCache?: boolean;
  cacheClear?: boolean;
  cacheStats?: boolean;
  report?: boolean;
  diff?: string;
  format?: string;
  watch?: boolean;
  telemetryOn?: boolean;
  telemetryOff?: boolean;
  mcp?: boolean;
}>();

function buildAnalyzeTelemetryFlags(
  o: typeof opts,
  outputFormat: 'human' | 'markdown' | 'json',
  lang: Lang,
  limit: number,
): Record<string, boolean | string | number> {
  return {
    hasModules: Boolean(o.modules),
    hasDiff: o.diff !== undefined,
    hasWatch: Boolean(o.watch),
    hasReport: Boolean(o.report),
    hasMapping: Boolean(o.withMapping || o.mappingOutput),
    skipCache: Boolean(o.skipCache),
    format: outputFormat,
    lang,
    limit,
  };
}

function resolveLangFlag(raw: string | undefined): Lang {
  const value = (raw ?? 'auto').toLowerCase();
  if (!VALID_LANGS.includes(value as Lang)) {
    const display = raw === undefined || raw === '' ? '(empty)' : raw;
    console.error('');
    console.error(
      `  ✗ Invalid --lang "${display}". Valid values: ${VALID_LANGS.join(', ')}`,
    );
    console.error('');
    process.exit(1);
  }
  return value as Lang;
}

function resolveFormatFlag(raw: string | undefined): 'human' | 'markdown' | 'json' {
  const fmt = (raw ?? 'human').toLowerCase();
  if (fmt === 'json' || fmt === 'markdown' || fmt === 'human') {
    return fmt;
  }
  const display = raw === undefined || raw === '' ? '(empty)' : raw;
  console.error('');
  console.error(
    `  ✗ Invalid --format "${display}". Use human, markdown, or json.`,
  );
  console.error('');
  process.exit(1);
}

void (async () => {
  try {
    if (opts.mcp || process.argv.includes('--mcp')) {
      const { startMcpServer } = await import('./mcp-server');
      await startMcpServer();
      return;
    }

    if (opts.telemetryOn) {
      setTelemetryExplicit(true);
      console.log('Telemetry enabled. Thank you!');
      process.exit(0);
    }

    if (opts.telemetryOff) {
      setTelemetryExplicit(false);
      console.log('Telemetry disabled.');
      process.exit(0);
    }

    if (opts.cacheClear) {
      const cacheManager = getCacheManager();
      cacheManager.clear();
      console.log('✅ Cache cleared successfully');
      process.exit(0);
    }

    if (opts.cacheStats) {
      const cacheManager = getCacheManager();
      const stats = cacheManager.getStats();
      console.log('\n📊 Cache Statistics:');
      console.log(`   Hits: ${stats.hits}`);
      console.log(`   Misses: ${stats.misses}`);
      console.log(`   Hit Rate: ${stats.hitRate}%`);
      console.log(`   Cache Size: ${(stats.cacheSize / 1024).toFixed(2)} KB`);
      console.log(`   Cache Dir: ${cacheManager.getCacheDir()}\n`);
      process.exit(0);
    }

    const lang = resolveLangFlag(opts.lang);

    if (opts.report) {
      runReport(opts.root, lang);
      process.exit(0);
    }

    if (opts.diff !== undefined) {
      console.error('');
      console.error('  ✗ --diff is not available in this release.');
      console.error('    Remove --diff or watch the changelog for git-scoped analysis.');
      console.error('');
      process.exit(1);
    }

    const question = opts.question?.trim() ?? '';
    if (!question) {
      console.error('');
      console.error('  ✗ Missing --question.');
      console.error('');
      console.error('  Example: skannr --question "how does auth work?" --root .');
      console.error('  Cache only: skannr --cache-stats | skannr --cache-clear');
      console.error('  Report:    skannr --report --root .');
      console.error('');
      program.outputHelp();
      process.exit(1);
    }

    const absoluteRoot = path.resolve(opts.root);
    assertRootExists(absoluteRoot);

    await askTelemetryConsent();

    const config = loadConfig(absoluteRoot);
    const moduleKeysFromCli = opts.modules
      ? opts.modules.split(',').map((k) => k.trim()).filter(Boolean)
      : undefined;
    const moduleKeys =
      moduleKeysFromCli && moduleKeysFromCli.length > 0
        ? moduleKeysFromCli
        : config.modules
          ? Object.keys(config.modules)
          : discoverModules(absoluteRoot);

    const limitProvided = opts.limit !== undefined;
    const limit = limitProvided ? opts.limit! : (config.defaultLimit ?? 10);

    const generateMapping = Boolean(opts.withMapping || opts.mappingOutput);
    const mappingOutputPath = opts.mappingOutput;

    const langExtensions = resolveExtensionsForLanguage(lang);
    const extensions = langExtensions ?? config.extensions;

    const outputFormat = resolveFormatFlag(opts.format);

    const analyzeOptions = {
      root: absoluteRoot,
      question,
      limit,
      generateMapping,
      mappingOutputPath,
      moduleKeys,
      moduleDefinitions: config.modules,
      lang,
      exclude: config.exclude,
      extensions,
    };

    if (opts.watch) {
      const { watchAndAnalyze } = await import('./watcher');
      let watchTelemetrySent = false;
      try {
        await watchAndAnalyze(analyzeOptions, (raw, elapsedMs) => {
          const result = withCliMetrics(raw, elapsedMs);
          const formatted =
            outputFormat === 'json'
              ? formatJson(result)
              : outputFormat === 'markdown'
                ? formatMarkdown(result)
                : formatHuman(result);
          process.stdout.write(formatted + (formatted.endsWith('\n') ? '' : '\n'));
          if (!watchTelemetrySent) {
            watchTelemetrySent = true;
            track(
              'analyze',
              buildAnalyzeTelemetryFlags(opts, outputFormat, lang, limit),
            );
          }
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'NO_FILES') {
          printNoFilesError();
          process.exit(1);
        }
        throw error;
      }
      return;
    }

    const started = Date.now();
    const rawResult = await analyzeProject({
      ...analyzeOptions,
      skipCache: opts.skipCache,
    });

    if (rawResult.files.length === 0) {
      printNoFilesError();
      process.exit(1);
    }

    const result = withCliMetrics(rawResult, Date.now() - started);

    const formatted =
      outputFormat === 'json'
        ? formatJson(result)
        : outputFormat === 'markdown'
          ? formatMarkdown(result)
          : formatHuman(result);

    process.stdout.write(formatted + (formatted.endsWith('\n') ? '' : '\n'));

    track(
      'analyze',
      buildAnalyzeTelemetryFlags(opts, outputFormat, lang, limit),
    );
  } catch (error) {
    console.error(
      'Error analyzing project:',
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
})();
