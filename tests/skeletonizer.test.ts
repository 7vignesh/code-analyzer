/**
 * Tests for skeleton generation
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildSkeletonForFile } from '../src/skeletonizer';

describe('buildSkeletonForFile', () => {
  let tempDir: string;
  let testFilePath: string;

  beforeEach(() => {
    // Create a temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skel-test-'));
    testFilePath = path.join(tempDir, 'test.ts');
  });

  afterEach(() => {
    // Clean up
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should generate skeleton for a simple class', () => {
    const sourceCode = `
export class Calculator {
  /**
   * Adds two numbers
   */
  add(a: number, b: number): number {
    return a + b;
  }

  multiply(x: number, y: number): number {
    const result = x * y;
    return result;
  }
}
    `;

    fs.writeFileSync(testFilePath, sourceCode);
    const { skeleton, lineRanges } = buildSkeletonForFile(testFilePath, tempDir);

    // Should contain class declaration
    expect(skeleton).toContain('export class Calculator');

    // Should contain method signatures
    expect(skeleton).toContain('add(a: number, b: number): number');
    expect(skeleton).toContain('multiply(x: number, y: number): number');

    // Should not contain implementation details
    expect(skeleton).toContain('/* trimmed */');
    expect(skeleton).not.toContain('return a + b');
    expect(skeleton).not.toContain('const result = x * y');

    expect(skeleton).toMatch(/\/\/ test\.ts:\d+/);
    expect(lineRanges?.some((r) => r.symbol === 'class Calculator')).toBe(true);
    expect(lineRanges?.some((r) => r.symbol === 'Calculator.add')).toBe(true);
  });

  it('should keep interface definitions intact', () => {
    const sourceCode = `
export interface User {
  id: string;
  name: string;
  email: string;
}
    `;

    fs.writeFileSync(testFilePath, sourceCode);
    const { skeleton, lineRanges } = buildSkeletonForFile(testFilePath, tempDir);

    expect(skeleton).toContain('export interface User');
    expect(skeleton).toContain('id: string');
    expect(skeleton).toContain('name: string');
    expect(skeleton).toContain('email: string');
    expect(skeleton).toMatch(/\/\/ test\.ts:\d+/);
    expect(lineRanges?.some((r) => r.symbol === 'interface User')).toBe(true);
  });

  it('should keep import statements', () => {
    const sourceCode = `
import { Something } from './somewhere';
import * as fs from 'fs';

export function doWork(): void {
  console.log('working');
}
    `;

    fs.writeFileSync(testFilePath, sourceCode);
    const { skeleton } = buildSkeletonForFile(testFilePath, tempDir);

    expect(skeleton).toContain("import { Something } from './somewhere'");
    expect(skeleton).toContain("import * as fs from 'fs'");
    expect(skeleton).toContain('export function doWork(): void');
    expect(skeleton).not.toContain("console.log('working')");
  });

  it('should handle type aliases', () => {
    const sourceCode = `
export type Status = 'active' | 'inactive' | 'pending';
export type UserId = string;
    `;

    fs.writeFileSync(testFilePath, sourceCode);
    const { skeleton, lineRanges } = buildSkeletonForFile(testFilePath, tempDir);

    expect(skeleton).toContain("export type Status = 'active' | 'inactive' | 'pending'");
    expect(skeleton).toContain('export type UserId = string');
    expect(lineRanges?.some((r) => r.symbol === 'type Status')).toBe(true);
  });

  it('should handle functions with JSDoc', () => {
    const sourceCode = `
/**
 * Calculates the sum of an array
 * @param numbers Array of numbers
 * @returns The sum
 */
export function sum(numbers: number[]): number {
  return numbers.reduce((a, b) => a + b, 0);
}
    `;

    fs.writeFileSync(testFilePath, sourceCode);
    const { skeleton } = buildSkeletonForFile(testFilePath, tempDir);

    expect(skeleton).toContain('Calculates the sum');
    expect(skeleton).toContain('export function sum(numbers: number[]): number');
    expect(skeleton).toContain('/* trimmed */');
    expect(skeleton).not.toContain('reduce');
  });

  it('should handle malformed TypeScript gracefully', () => {
    const sourceCode = 'export const x = {{{';

    fs.writeFileSync(testFilePath, sourceCode);
    const { skeleton } = buildSkeletonForFile(testFilePath, tempDir);

    // ts-morph is robust and may still parse partial content
    // Just verify it returns some output without crashing
    expect(skeleton).toBeDefined();
    expect(skeleton.length).toBeGreaterThan(0);
  });
});
