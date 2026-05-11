import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { discoverModules, scanFiles } from '../src/scanner';

const rootDir = path.join(__dirname, 'fixtures');

describe('generic scanner', () => {
  it('discovers modules from common source folders', () => {
    const modules = discoverModules(rootDir);
    expect(modules).toContain('auth');
    expect(modules).toContain('api');
  });

  it('scans only requested module keys', () => {
    const files = scanFiles(rootDir, {
      moduleKeys: ['auth'],
      moduleDefinitions: {
        auth: ['src/auth'],
      },
      extensions: ['.ts'],
    });
    expect(files.length).toBeGreaterThan(0);
    files.forEach((file) => {
      expect(file.startsWith(path.join(rootDir, 'src/auth'))).toBe(true);
    });
  });

  it('returns empty array on invalid root', () => {
    const invalidRoot = path.join(__dirname, 'missing-fixtures');
    const files = scanFiles(invalidRoot, { extensions: ['.ts'] });
    expect(files).toEqual([]);
  });

  it('excludes common ignored folders', () => {
    const files = scanFiles(rootDir, { extensions: ['.ts'] });
    const excludedDir = path.join(rootDir, 'node_modules');

    files.forEach((file) => {
      expect(file.startsWith(excludedDir)).toBe(false);
    });
  });

  it('respects root .gitignore', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skannr-gitignore-'));
    try {
      fs.writeFileSync(path.join(tmp, 'kept.ts'), 'export const kept = 1;\n');
      fs.writeFileSync(path.join(tmp, 'dropped.ts'), 'export const dropped = 2;\n');
      fs.writeFileSync(
        path.join(tmp, '.gitignore'),
        ['dropped.ts', 'ignored-dir/', ''].join('\n'),
        'utf-8',
      );
      fs.mkdirSync(path.join(tmp, 'ignored-dir'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'ignored-dir', 'nope.ts'), 'export const nope = 3;\n');

      const files = scanFiles(tmp, { extensions: ['.ts'] });
      const rel = (abs: string) => path.relative(tmp, abs).split(path.sep).join('/');

      expect(files.some((f) => rel(f) === 'kept.ts')).toBe(true);
      expect(files.some((f) => rel(f) === 'dropped.ts')).toBe(false);
      expect(files.some((f) => rel(f).startsWith('ignored-dir/'))).toBe(false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});