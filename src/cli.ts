#!/usr/bin/env node

/**
 * CLI entry point for skannr
 */

import { analyzeProject, getCacheManager } from './index';
import * as path from 'path';
import { loadConfig } from './config';
import { discoverModules } from './scanner';

interface CliArgs {
  root: string;
  question: string;
  limit: number;
  limitProvided: boolean;
  generateMapping: boolean;
  mappingOutputPath?: string;
  moduleKeys?: string[];
  lang: 'typescript' | 'javascript' | 'python' | 'auto';
  skipCache?: boolean;
  cacheCommand?: 'clear' | 'stats';
}

/**
 * Parse command line arguments
 */
function parseArgs(): CliArgs | null {
  const args = process.argv.slice(2);

  let root = process.cwd();
  let question = '';
  let limit = 10;
  let limitProvided = false;
  let generateMapping = false;
  let mappingOutputPath: string | undefined;
  let moduleKeys: string[] | undefined;
  let lang: 'typescript' | 'javascript' | 'python' | 'auto' = 'auto';
  let skipCache = false;
  let cacheCommand: 'clear' | 'stats' | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--root' && i + 1 < args.length) {
      root = args[i + 1];
      i++;
    } else if (arg === '--question' && i + 1 < args.length) {
      question = args[i + 1];
      i++;
    } else if (arg === '--limit' && i + 1 < args.length) {
      limit = parseInt(args[i + 1], 10);
      if (isNaN(limit) || limit < 1) {
        console.error('Error: --limit must be a positive number');
        return null;
      }
      limitProvided = true;
      i++;
    } else if (arg === '--with-mapping') {
      generateMapping = true;
    } else if (arg === '--mapping-output' && i + 1 < args.length) {
      mappingOutputPath = args[i + 1];
      generateMapping = true; // Implies mapping generation
      i++;
    } else if (arg === '--modules' && i + 1 < args.length) {
      moduleKeys = args[i + 1].split(',').map(k => k.trim());
      i++;
    } else if (arg === '--lang' && i + 1 < args.length) {
      const langArg = args[i + 1].toLowerCase();
      if (langArg !== 'typescript' && langArg !== 'javascript' && langArg !== 'python' && langArg !== 'auto') {
        console.error('Error: --lang must be one of: typescript, javascript, python, auto');
        return null;
      }
      lang = langArg as CliArgs['lang'];
      i++;
    } else if (arg === '--skip-cache') {
      skipCache = true;
    } else if (arg === '--cache-clear') {
      cacheCommand = 'clear';
    } else if (arg === '--cache-stats') {
      cacheCommand = 'stats';
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      return null;
    } else {
      console.error(`Unknown argument: ${arg}`);
      printHelp();
      return null;
    }
  }

  // Handle cache commands
  if (cacheCommand) {
    return { root, question: '', limit, limitProvided, generateMapping, moduleKeys, lang, cacheCommand };
  }

  if (!question) {
    console.error('Error: --question is required (or use --cache-* for cache management)\n');
    printHelp();
    return null;
  }

  return { root, question, limit, limitProvided, generateMapping, mappingOutputPath, moduleKeys, lang, skipCache };
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
uca - Universal Code Analyzer

Usage:
  uca --question "<text>" [options]
  uca --cache-clear    # Clear all caches
  uca --cache-stats    # Show cache statistics

Options:
  --root <path>            Project root directory (default: current directory)
  --question "<text>"      Natural language question about the codebase (required)
  --limit <number>         Number of top files to analyze (default: 10)
  --with-mapping           Generate symbol mapping for on-demand retrieval
  --modules <keys>         Comma-separated module keys (auto-discovered when omitted)
  --lang <mode>            typescript | javascript | python | auto (default: auto)
  --mapping-output <path>  Custom path for mapping file (implies --with-mapping)
  --skip-cache             Skip cache and force full analysis
  --cache-clear            Clear all cached analysis results
  --cache-stats            Show cache statistics (hits, misses, size)
  --help, -h               Show this help message

Example:
  uca --question "authentication logic" --limit 5
  uca --root ./my-project --question "database models"
  uca --question "API endpoints" --with-mapping
  uca --question "permissions" --modules auth,middleware --skip-cache
  uca --question "class structure" --lang python
  uca --cache-stats
  uca --cache-clear

Output:
  JSON object with ranked files and their code skeletons
  `);
}

/**
 * Main CLI function
 */
async function main(): Promise<void> {
  const args = parseArgs();

  if (!args) {
    process.exit(1);
  }

  try {
    // Handle cache commands
    if (args.cacheCommand === 'clear') {
      const cacheManager = getCacheManager();
      cacheManager.clear();
      console.log('✅ Cache cleared successfully');
      process.exit(0);
    }

    if (args.cacheCommand === 'stats') {
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

    const absoluteRoot = path.resolve(args.root);
    const config = loadConfig(absoluteRoot);
    const moduleKeys =
      args.moduleKeys
      ?? (config.modules ? Object.keys(config.modules) : discoverModules(absoluteRoot));

    const resolvedLimit = args.limitProvided ? args.limit : (config.defaultLimit ?? args.limit);
    const langExtensions = resolveExtensionsForLanguage(args.lang);
    const extensions = langExtensions ?? config.extensions;

    const result = await analyzeProject({
      root: absoluteRoot,
      question: args.question,
      limit: resolvedLimit,
      generateMapping: args.generateMapping,
      mappingOutputPath: args.mappingOutputPath,
      moduleKeys,
      moduleDefinitions: config.modules,
      lang: args.lang,
      skipCache: args.skipCache,
      exclude: config.exclude,
      extensions,
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error analyzing project:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run CLI
main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});

function resolveExtensionsForLanguage(lang: CliArgs['lang']): string[] | undefined {
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
