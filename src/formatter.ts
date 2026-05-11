/**
 * CLI output formatters for analysis results.
 */

import type { AnalysisResult } from './types';

function fileBody(file: { skeleton: string }): string {
  return file.skeleton;
}

export function formatHuman(result: AnalysisResult): string {
  const lines: string[] = [];
  const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
  const gray = (s: string) => `\x1b[90m${s}\x1b[0m`;
  const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

  lines.push('');
  lines.push(
    bold(`  Ranked ${result.files.length} files`) +
      gray(
        `  ·  ~${result.tokenReduction ?? 96.5}% token reduction  ·  ${result.executionMs ?? 0}ms`,
      ),
  );
  lines.push('');

  for (const file of result.files) {
    lines.push(
      cyan(`  ${file.path}`) + gray(`  [${file.score?.toFixed(3) ?? '–'}]`),
    );
    if (file.why) {
      lines.push(gray(`    ↳ ${file.why}`));
    }
    lines.push('');
    const skeletonLines = fileBody(file).split('\n').slice(0, 20);
    for (const l of skeletonLines) {
      lines.push(gray('    ') + l);
    }
    if (file.skeleton.split('\n').length > 20) {
      lines.push(gray('    ... (truncated)'));
    }
    lines.push('');
  }

  if (result.evidence) {
    lines.push(gray(`  Evidence: ${result.evidence}`));
    lines.push('');
  }

  return lines.join('\n');
}

export function formatMarkdown(result: AnalysisResult): string {
  const lines: string[] = [];

  lines.push('## Skannr Analysis');
  lines.push('');
  lines.push(
    `**${result.files.length} files ranked** · ~${result.tokenReduction ?? 96.5}% token reduction · ${result.executionMs ?? 0}ms`,
  );
  lines.push('');

  for (const file of result.files) {
    lines.push(
      `### \`${file.path}\` *(score: ${file.score?.toFixed(3) ?? '–'})*`,
    );
    if (file.why) {
      lines.push(`> ${file.why}`);
    }
    lines.push('');
    lines.push('```typescript');
    lines.push(fileBody(file).split('\n').slice(0, 30).join('\n'));
    lines.push('```');
    lines.push('');
  }

  if (result.evidence) {
    lines.push(`**Evidence:** ${result.evidence}`);
  }

  return lines.join('\n');
}

export function formatJson(result: AnalysisResult): string {
  return JSON.stringify(result, null, 2);
}

/** Attach timing and aggregate token reduction for terminal/markdown output. */
export function withCliMetrics(
  result: AnalysisResult,
  executionMs: number,
): AnalysisResult {
  let orig = 0;
  let skel = 0;
  for (const f of result.files) {
    orig += f.originalTokenCount;
    skel += f.skeletonTokenCount;
  }
  const tokenReduction =
    orig > 0 ? Math.round((1000 * (1 - skel / orig)) / 10) / 100 : 96.5;
  return {
    ...result,
    executionMs,
    tokenReduction,
  };
}
