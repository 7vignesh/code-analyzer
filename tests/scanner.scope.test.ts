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
});