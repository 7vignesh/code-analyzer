/**
 * Opt-in anonymous usage telemetry (CLI flags only — no code, questions, or paths).
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires -- version at runtime from package root
const PKG_VERSION: string = require('../package.json').version as string;

const CONFIG_PATH = path.join(os.homedir(), '.skannr', 'config.json');
const TELEMETRY_ENDPOINT = 'https://skannr-telemetry.vercel.app/api/event';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface TelemetryConfig {
  enabled: boolean;
  anonymousId: string;
  askedAt: string;
  /** User ran `--telemetry-off`; blocks deferred opt-in. */
  explicitOptOut?: boolean;
}

function readRawConfig(): TelemetryConfig | null {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as TelemetryConfig;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function saveConfig(config: TelemetryConfig): void {
  try {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch {
    /* ignore */
  }
}

/** If the user was shown the banner and never opted out, enable after 7 days. */
export function maybeApplyDeferredTelemetryOptIn(): void {
  const c = readRawConfig();
  if (!c || c.enabled || c.explicitOptOut) {
    return;
  }
  const asked = new Date(c.askedAt).getTime();
  if (Number.isNaN(asked)) {
    return;
  }
  if (Date.now() - asked < SEVEN_DAYS_MS) {
    return;
  }
  saveConfig({ ...c, enabled: true });
}

export async function askTelemetryConsent(): Promise<void> {
  maybeApplyDeferredTelemetryOptIn();
  if (readRawConfig() !== null) {
    return;
  }

  console.log(`
  \x1b[90m─────────────────────────────────────────────────────\x1b[0m
  \x1b[1mHelp improve Skannr?\x1b[0m

  Send anonymous usage data (which flags you use, nothing else).
  No code, no questions, no file paths — ever.

  Run \x1b[36mskannr --telemetry-off\x1b[0m to disable at any time.
  Run \x1b[36mskannr --telemetry-on\x1b[0m to enable.

  \x1b[90mAutomatic opt-in after 7 days if no action taken.\x1b[0m
  \x1b[90m─────────────────────────────────────────────────────\x1b[0m
`);

  saveConfig({
    enabled: false,
    anonymousId: crypto.randomUUID(),
    askedAt: new Date().toISOString(),
    explicitOptOut: false,
  });
}

export function setTelemetryExplicit(enabled: boolean): void {
  const cur = readRawConfig();
  const base: TelemetryConfig = cur ?? {
    enabled: false,
    anonymousId: crypto.randomUUID(),
    askedAt: new Date().toISOString(),
    explicitOptOut: false,
  };
  saveConfig({
    ...base,
    enabled,
    explicitOptOut: enabled ? false : true,
  });
}

export function track(
  event: string,
  flags: Record<string, boolean | string | number>,
): void {
  try {
    maybeApplyDeferredTelemetryOptIn();
    const config = readRawConfig();
    if (!config?.enabled) {
      return;
    }

    const payload = JSON.stringify({
      event,
      flags,
      anonymousId: config.anonymousId,
      version: PKG_VERSION,
      node: process.version,
      platform: process.platform,
    });

    const req = https.request(
      TELEMETRY_ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        res.resume();
      },
    );
    req.on('error', () => {
      /* never crash on telemetry failure */
    });
    req.write(payload);
    req.end();
  } catch {
    /* completely silent */
  }
}
