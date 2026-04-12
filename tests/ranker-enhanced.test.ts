import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { rankFilesEnhanced } from '../src/ranker-enhanced';

describe('rankFilesEnhanced hybrid retrieval', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ranker-enhanced-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('prioritizes files aligned with auth intent', () => {
    const authFile = path.join(tempDir, 'auth-permissions.ts');
    const genericFile = path.join(tempDir, 'utility.ts');

    fs.writeFileSync(
      authFile,
      [
        'export class AuthorizationService {',
        '  checkPermission(user: string, action: string): boolean {',
        '    return !!user && !!action;',
        '  }',
        '}',
      ].join('\n'),
      'utf-8'
    );

    fs.writeFileSync(
      genericFile,
      [
        'export function sum(a: number, b: number): number {',
        '  return a + b;',
        '}',
      ].join('\n'),
      'utf-8'
    );

    const ranked = rankFilesEnhanced(
      [authFile, genericFile],
      'how are permissions validated for users?',
      2,
      tempDir
    );

    expect(ranked.length).toBe(2);
    expect(path.basename(ranked[0].path)).toBe('auth-permissions.ts');
  });

  it('returns deterministic ordering for equal scores', () => {
    const aFile = path.join(tempDir, 'a.ts');
    const bFile = path.join(tempDir, 'b.ts');

    fs.writeFileSync(aFile, 'export const a = 1;', 'utf-8');
    fs.writeFileSync(bFile, 'export const b = 2;', 'utf-8');

    const ranked = rankFilesEnhanced([bFile, aFile], 'zzzz-unmatched-term', 2, tempDir);

    expect(ranked.length).toBe(2);
    expect(ranked[0].path <= ranked[1].path).toBe(true);
  });
});
