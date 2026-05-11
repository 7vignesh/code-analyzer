/**
 * Watch project files and re-run analysis on change (debounced).
 */

import chokidar from 'chokidar';
import * as path from 'path';
import { analyzeProject } from './index';
import type { AnalysisResult, AnalyzeOptions } from './types';

export type WatchAnalyzeOptions = AnalyzeOptions & {
  skipCache?: boolean;
};

export async function watchAndAnalyze(
  options: WatchAnalyzeOptions,
  onResult: (result: AnalysisResult, elapsedMs: number) => void,
): Promise<void> {
  const root = path.resolve(options.root);

  const ignored: (string | RegExp)[] = [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/__pycache__/**',
    '**/*.pyc',
    '**/.next/**',
    '**/coverage/**',
    '**/.cache/**',
    '**/target/**',
  ];

  console.log(`\x1b[36m  Watching ${root} for changes...\x1b[0m`);
  console.log('  Press Ctrl+C to stop.\n');

  let running = false;
  let firstRun = true;

  const run = async (): Promise<void> => {
    if (running) {
      return;
    }
    running = true;
    try {
      console.log(`\x1b[90m  [${new Date().toLocaleTimeString()}] Re-analyzing...\x1b[0m`);
      const t0 = Date.now();
      const raw = await analyzeProject({
        ...options,
        root,
        skipCache: true,
      });
      const elapsedMs = Date.now() - t0;
      if (raw.files.length === 0) {
        if (firstRun) {
          throw new Error('NO_FILES');
        }
        console.log('\x1b[90m  (no matching files; skipping output)\x1b[0m\n');
        return;
      }
      onResult(raw, elapsedMs);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'NO_FILES') {
        throw err;
      }
      console.error(`\x1b[31m  Error: ${msg}\x1b[0m`);
    } finally {
      running = false;
      firstRun = false;
    }
  };

  await run();

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  const debounced = (): void => {
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      void run();
    }, 800);
  };

  const watcher = chokidar.watch(root, {
    ignored,
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  watcher.on('change', (filePath: string) => {
    console.log(`\x1b[90m  Changed: ${path.relative(root, filePath)}\x1b[0m`);
    debounced();
  });

  watcher.on('add', debounced);
  watcher.on('unlink', debounced);

  await new Promise<void>((resolve) => {
    const shutdown = async (): Promise<void> => {
      await watcher.close();
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
      }
      console.log('\n  Stopped watching.');
      resolve();
      process.exit(0);
    };

    process.once('SIGINT', () => {
      void shutdown();
    });
    process.once('SIGTERM', () => {
      void shutdown();
    });
  });
}
