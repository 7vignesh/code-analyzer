/**
 * File scanner for universal codebases.
 */

import * as fs from 'fs';
import * as path from 'path';

export const DEFAULT_EXCLUDES = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/__pycache__/**',
  '**/*.min.js',
  '**/*.bundle.js',
  '**/vendor/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/target/**',
  '**/*.pyc',
  '**/.cache/**',
];

const DEFAULT_IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '__pycache__',
  'vendor',
  '.next',
  '.nuxt',
  'target',
  '.cache',
  '.idea',
  '.vscode',
]);

const SRC_CANDIDATES = ['src', 'lib', 'packages', 'apps', 'modules'];

export interface ScanOptions {
  extensions?: string[];
  exclude?: string[];
  moduleKeys?: string[];
  moduleDefinitions?: Record<string, string[]>;
}

export function discoverModules(root: string): string[] {
  const srcCandidates = ['src', 'lib', 'packages', 'apps', 'modules'];

  for (const candidate of srcCandidates) {
    const candidatePath = path.join(root, candidate);
    if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isDirectory()) {
      const subdirs = fs.readdirSync(candidatePath)
        .filter((name) => {
          const fullPath = path.join(candidatePath, name);
          return fs.statSync(fullPath).isDirectory() && !name.startsWith('.');
        });
      if (subdirs.length > 0) return subdirs;
    }
  }

  const ignored = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.cache', '__pycache__', 'vendor']);
  return fs.readdirSync(root)
    .filter((name) => {
      const fullPath = path.join(root, name);
      return fs.statSync(fullPath).isDirectory() && !name.startsWith('.') && !ignored.has(name);
    });
}

export function scanFiles(rootDir: string, options: ScanOptions = {}): string[] {
  const results: string[] = [];
  const excludes = options.exclude ?? DEFAULT_EXCLUDES;
  const extensions = options.extensions?.map((ext) => ext.toLowerCase());
  const scanRoots = resolveScanRoots(rootDir, options);

  const scan = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (shouldExclude(fullPath, rootDir, excludes)) {
        continue;
      }

      if (entry.isDirectory()) {
        if (!DEFAULT_IGNORED_DIRS.has(entry.name)) {
          scan(fullPath);
        }
      } else if (entry.isFile()) {
        if (!extensions || extensions.length === 0) {
          results.push(fullPath);
          continue;
        }
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.includes(ext)) {
          results.push(fullPath);
        }
      }
    }
  };

  for (const scanRoot of scanRoots) {
    if (fs.existsSync(scanRoot) && fs.statSync(scanRoot).isDirectory()) {
      scan(scanRoot);
    }
  }

  return Array.from(new Set(results));
}

export function scanTypeScriptFiles(rootDir: string): string[] {
  return scanFiles(rootDir, { extensions: ['.ts', '.tsx'] });
}

export function scanRocketChatFiles(rootDir: string, moduleKeys?: string[]): string[] {
  return scanFiles(rootDir, {
    extensions: ['.ts', '.tsx'],
    moduleKeys,
  });
}

export function readFileContent(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function resolveScanRoots(rootDir: string, options: ScanOptions): string[] {
  const moduleKeys = options.moduleKeys;
  const moduleDefinitions = options.moduleDefinitions;
  if (!moduleKeys || moduleKeys.length === 0) {
    return [rootDir];
  }

  const resolved: string[] = [];
  for (const key of moduleKeys) {
    if (moduleDefinitions?.[key]) {
      for (const rel of moduleDefinitions[key]) {
        const full = path.resolve(rootDir, rel);
        if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
          resolved.push(full);
        }
      }
      continue;
    }

    const direct = path.join(rootDir, key);
    if (fs.existsSync(direct) && fs.statSync(direct).isDirectory()) {
      resolved.push(direct);
      continue;
    }

    for (const base of SRC_CANDIDATES) {
      const candidate = path.join(rootDir, base, key);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        resolved.push(candidate);
      }
    }
  }

  if (resolved.length === 0 && moduleKeys.length > 0) {
    throw new Error(`No matching modules found for keys: ${moduleKeys.join(', ')}`);
  }

  return resolved;
}

function shouldExclude(fullPath: string, rootDir: string, excludes: string[]): boolean {
  const rel = path.relative(rootDir, fullPath).split(path.sep).join('/');
  const hasSegment = (segment: string): boolean =>
    rel === segment || rel.startsWith(`${segment}/`) || rel.includes(`/${segment}/`);

  for (const pattern of excludes) {
    if (pattern.includes('node_modules') && hasSegment('node_modules')) return true;
    if (pattern.includes('.git') && hasSegment('.git')) return true;
    if (pattern.includes('/dist/') && hasSegment('dist')) return true;
    if (pattern.includes('/build/') && hasSegment('build')) return true;
    if (pattern.includes('/coverage/') && hasSegment('coverage')) return true;
    if (pattern.includes('__pycache__') && hasSegment('__pycache__')) return true;
    if (pattern.includes('/vendor/') && hasSegment('vendor')) return true;
    if (pattern.includes('/.next/') && hasSegment('.next')) return true;
    if (pattern.includes('/.nuxt/') && hasSegment('.nuxt')) return true;
    if (pattern.includes('/target/') && hasSegment('target')) return true;
    if (pattern.includes('/.cache/') && hasSegment('.cache')) return true;
    if (pattern.endsWith('*.min.js') && rel.endsWith('.min.js')) return true;
    if (pattern.endsWith('*.bundle.js') && rel.endsWith('.bundle.js')) return true;
    if (pattern.endsWith('*.pyc') && rel.endsWith('.pyc')) return true;
  }

  return false;
}
