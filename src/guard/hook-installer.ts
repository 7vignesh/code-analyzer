/**
 * Git hook installer for skannr guard.
 * Appends to existing hooks using markers — never overwrites.
 */

import * as fs from 'fs';
import * as path from 'path';

const HOOK_START_MARKER = '# >>> skannr-guard start >>>';
const HOOK_END_MARKER = '# <<< skannr-guard end <<<';

const HOOK_CONTENT = `
${HOOK_START_MARKER}
# Run skannr guard on staged files before committing.
# Exit code 1 blocks the commit; exit code 2 is a tool error (non-blocking).
npx skannr guard
GUARD_EXIT=$?
if [ $GUARD_EXIT -eq 1 ]; then
  echo ""
  echo "  Commit blocked by skannr guard. Fix violations or use --no-verify to skip."
  echo ""
  exit 1
fi
${HOOK_END_MARKER}
`;

/**
 * Install the pre-commit hook (append-safe).
 */
export function installHook(root: string): { installed: boolean; message: string } {
  const hooksDir = path.join(root, '.git', 'hooks');
  if (!fs.existsSync(path.join(root, '.git'))) {
    return { installed: false, message: 'Not a git repository (no .git directory found).' };
  }

  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  const hookPath = path.join(hooksDir, 'pre-commit');

  if (fs.existsSync(hookPath)) {
    const existing = fs.readFileSync(hookPath, 'utf-8');

    // Already installed?
    if (existing.includes(HOOK_START_MARKER)) {
      return { installed: true, message: 'Hook already installed.' };
    }

    // Append to existing hook
    const updated = existing.trimEnd() + '\n\n' + HOOK_CONTENT.trim() + '\n';
    fs.writeFileSync(hookPath, updated, { mode: 0o755 });
  } else {
    // Create new hook
    const content = '#!/bin/sh\n' + HOOK_CONTENT;
    fs.writeFileSync(hookPath, content, { mode: 0o755 });
  }

  return { installed: true, message: `Hook installed at ${hookPath}` };
}

/**
 * Uninstall the pre-commit hook (remove only our markers).
 */
export function uninstallHook(root: string): { removed: boolean; message: string } {
  const hookPath = path.join(root, '.git', 'hooks', 'pre-commit');

  if (!fs.existsSync(hookPath)) {
    return { removed: false, message: 'No pre-commit hook found.' };
  }

  const content = fs.readFileSync(hookPath, 'utf-8');
  if (!content.includes(HOOK_START_MARKER)) {
    return { removed: false, message: 'Skannr guard hook not found in pre-commit.' };
  }

  // Remove everything between (and including) the markers
  const startIdx = content.indexOf(HOOK_START_MARKER);
  const endIdx = content.indexOf(HOOK_END_MARKER);
  if (startIdx === -1 || endIdx === -1) {
    return { removed: false, message: 'Malformed hook markers.' };
  }

  const before = content.slice(0, startIdx).trimEnd();
  const after = content.slice(endIdx + HOOK_END_MARKER.length).trimStart();
  const updated = (before + '\n' + after).trim();

  if (updated === '#!/bin/sh' || updated === '') {
    // Hook is now empty — remove the file
    fs.unlinkSync(hookPath);
  } else {
    fs.writeFileSync(hookPath, updated + '\n', { mode: 0o755 });
  }

  return { removed: true, message: 'Skannr guard hook removed.' };
}
