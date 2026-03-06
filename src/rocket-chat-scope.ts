import * as path from 'path';
import * as fs from 'fs';
import { RocketChatScopeConfig } from './types';

export const ROCKET_CHAT_SCOPE_CONFIG: RocketChatScopeConfig = {
  repoRootMarker: 'package.json',
  meteorAppPath: 'apps/meteor',
  ignoredDirs: [
    'node_modules',
    'dist',
    'build',
    'out',
    '.git',
    '.next',
    '.nuxt',
    'coverage',
    '.vscode',
    '.idea',
    '.meteor',
  ],
  modules: [
    { key: 'lib-server-functions', relativePath: 'app/lib/server/functions', description: 'Server functions' },
    { key: 'authorization', relativePath: 'app/authorization', description: 'User permissions and access control' },
    { key: 'e2e', relativePath: 'app/e2e', description: 'End-to-end encryption' },
    { key: 'file-upload', relativePath: 'app/file-upload', description: 'File upload and media handling' },
  ],
};

export function resolveMeteorAppRoot(root: string): string {
  // If root is already the meteor app
  if (fs.existsSync(path.join(root, '.meteor'))) {
    return root;
  }
  // If root is monorepo root
  const meteorPath = path.join(root, ROCKET_CHAT_SCOPE_CONFIG.meteorAppPath);
  if (fs.existsSync(meteorPath)) {
    return meteorPath;
  }
  return root;
}

export function isRocketChatMeteorRoot(root: string): boolean {
  return fs.existsSync(path.join(root, '.meteor'));
}

export function getAllowedModulePaths(root: string, moduleKeys?: string[]): string[] {
  const meteorRoot = resolveMeteorAppRoot(root);
  let modules = ROCKET_CHAT_SCOPE_CONFIG.modules;

  if (moduleKeys && moduleKeys.length > 0) {
    modules = modules.filter((m) => moduleKeys.includes(m.key));
    if (modules.length === 0) {
      throw new Error(`No matching modules found for keys: ${moduleKeys.join(', ')}`);
    }
  }

  return modules.map((m) => path.join(meteorRoot, m.relativePath));
}

export function normalizeModuleKeys(moduleKeys?: string[]): string[] {
  return moduleKeys || [];
}