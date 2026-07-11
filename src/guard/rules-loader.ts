/**
 * Load and validate the rules file (.skannr/rules.json or .skannr/rules.yaml).
 * Returns validated rules or throws with a clear error message.
 */

import * as fs from 'fs';
import * as path from 'path';
import { RulesFileSchema } from './schema';
import type { GuardRule, GuardConfig } from './types';
import { GuardConfigSchema } from './schema';

/** Default locations to search for the rules file. */
const RULES_PATHS = [
  '.skannr/rules.json',
  '.skannr/rules.yaml',
  '.skannr/rules.yml',
];

/** Load and validate rules from the project root. */
export function loadRules(root: string): GuardRule[] {
  const rulesPath = findRulesFile(root);
  if (!rulesPath) {
    throw new Error(
      `No rules file found. Create .skannr/rules.json with your team's review rules.\n` +
      `Example:\n` +
      `{\n` +
      `  "rules": [{\n` +
      `    "id": "no-any-type",\n` +
      `    "description": "Do not use the \`any\` type in TypeScript.",\n` +
      `    "severity": "high",\n` +
      `    "fixable": true,\n` +
      `    "category": "type-safety"\n` +
      `  }]\n` +
      `}`,
    );
  }

  const raw = fs.readFileSync(rulesPath, 'utf-8');
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Failed to parse rules file as JSON: ${rulesPath}`);
  }

  const result = RulesFileSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid rules file (${rulesPath}):\n${errors}`);
  }

  return result.data.rules;
}

/** Load guard provider configuration from .skannr/guard.json or env vars. */
export function loadGuardConfig(root: string): GuardConfig {
  const configPath = path.join(root, '.skannr', 'guard.json');

  let rawConfig: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    try {
      rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch {
      // Fall through to defaults + env
    }
  }

  // Env vars override file config
  const provider = (process.env.SKANNR_GUARD_PROVIDER || rawConfig.provider || 'gemini') as string;
  const model = (process.env.SKANNR_GUARD_MODEL || rawConfig.model || 'gemini-2.0-flash-exp') as string;
  const apiKey = process.env.SKANNR_GUARD_API_KEY
    || process.env.GEMINI_API_KEY
    || process.env.OPENAI_API_KEY
    || (rawConfig.apiKey as string | undefined);
  const baseUrl = process.env.OPENAI_BASE_URL || (rawConfig.baseUrl as string | undefined);

  const result = GuardConfigSchema.safeParse({ provider, model, apiKey, baseUrl });
  if (!result.success) {
    throw new Error(`Invalid guard config: ${result.error.issues.map((i) => i.message).join(', ')}`);
  }

  return result.data as GuardConfig;
}

/** Find the first existing rules file in the project. */
function findRulesFile(root: string): string | null {
  for (const rel of RULES_PATHS) {
    const full = path.join(root, rel);
    if (fs.existsSync(full)) {
      return full;
    }
  }
  return null;
}
