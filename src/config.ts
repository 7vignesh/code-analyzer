import * as fs from 'fs';
import * as path from 'path';

export interface AnalyzerConfig {
  modules?: Record<string, string[]>;
  exclude?: string[];
  extensions?: string[];
  defaultLimit?: number;
}

export function loadConfig(root: string): AnalyzerConfig {
  const configPath = path.join(root, 'code-analyzer.config.json');
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(raw) as AnalyzerConfig;
    } catch {
      console.warn('[config] Failed to parse code-analyzer.config.json, using defaults');
    }
  }
  return {};
}
