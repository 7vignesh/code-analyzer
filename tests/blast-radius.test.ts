/**
 * Unit tests for blast-radius core logic.
 *
 * Integration tests that exercise the full pipeline (computeBlastRadius) require
 * native tree-sitter bindings; they are marked separately and may be skipped in
 * environments without a C++ build toolchain.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Mock tree-sitter WASM to avoid loading .wasm files in unit tests.
jest.mock('web-tree-sitter', () => ({
  default: {
    init: jest.fn().mockResolvedValue(undefined),
    Language: { load: jest.fn().mockResolvedValue({}) },
  },
}), { virtual: true });
jest.mock('../src/languages/TreeSitterAdapter', () => ({
  TreeSitterAdapter: class {
    name = 'tree-sitter';
    extensions = ['.py', '.pyi', '.go', '.rs', '.java'];
    canHandle() { return false; }
    generateSkeleton() { return { skeleton: '', lineRanges: [] }; }
    extractSymbols() { return []; }
    extractImports() { return []; }
    initializeSync() {}
    async initialize() {}
  },
}));

import {
  buildReverseGraph,
  traverseAffected,
  computeBlastRadius,
  formatBlastRadiusText,
  formatBlastRadiusJson,
} from '../src/blast-radius';

describe('blast-radius', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blast-radius-'));
    const { execSync } = require('child_process');
    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------------------
  // buildReverseGraph
  // -------------------------------------------------------------------------
  describe('buildReverseGraph', () => {
    it('inverts a forward dependency map', () => {
      const forward = new Map<string, string[]>([
        ['A.ts', ['B.ts', 'C.ts']],
        ['D.ts', ['C.ts']],
      ]);

      const reverse = buildReverseGraph(forward);

      expect(reverse.get('B.ts')).toEqual(['A.ts']);
      expect(reverse.get('C.ts')!.sort()).toEqual(['A.ts', 'D.ts']);
    });

    it('returns empty map for empty input', () => {
      const reverse = buildReverseGraph(new Map());
      expect(reverse.size).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // traverseAffected — N-hop BFS on reverse graph
  // -------------------------------------------------------------------------
  describe('traverseAffected', () => {
    it('returns correct files at each hop distance', () => {
      // Graph: A imports B, B imports C, D imports C
      // Reverse: C ← [B, D], B ← [A]
      const reverseGraph = new Map<string, string[]>([
        ['C.ts', ['B.ts', 'D.ts']],
        ['B.ts', ['A.ts']],
      ]);

      // Changed: C.ts. With 2 hops:
      //   Hop 1: B.ts, D.ts (they import C)
      //   Hop 2: A.ts (imports B)
      const affected = traverseAffected(['C.ts'], reverseGraph, 2);

      expect(affected.get('B.ts')).toBe(1);
      expect(affected.get('D.ts')).toBe(1);
      expect(affected.get('A.ts')).toBe(2);
      expect(affected.has('C.ts')).toBe(false); // seed excluded
      expect(affected.size).toBe(3);
    });

    it('respects max hops limit', () => {
      const reverseGraph = new Map<string, string[]>([
        ['C.ts', ['B.ts']],
        ['B.ts', ['A.ts']],
      ]);

      const affected = traverseAffected(['C.ts'], reverseGraph, 1);

      expect(affected.get('B.ts')).toBe(1);
      expect(affected.has('A.ts')).toBe(false); // beyond 1 hop
      expect(affected.size).toBe(1);
    });

    it('does not revisit already-visited nodes (handles cycles)', () => {
      // Cycle: A → B → C → A (in reverse: A ← C, C ← B, B ← A)
      const reverseGraph = new Map<string, string[]>([
        ['A.ts', ['C.ts']],
        ['C.ts', ['B.ts']],
        ['B.ts', ['A.ts']],
      ]);

      const affected = traverseAffected(['A.ts'], reverseGraph, 3);

      // C at hop 1, B at hop 2. A is the seed so excluded.
      expect(affected.get('C.ts')).toBe(1);
      expect(affected.get('B.ts')).toBe(2);
      expect(affected.size).toBe(2);
    });

    it('returns empty map when no reverse edges exist', () => {
      const reverseGraph = new Map<string, string[]>();
      const affected = traverseAffected(['isolated.ts'], reverseGraph, 3);
      expect(affected.size).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Risk score on known input/output
  // -------------------------------------------------------------------------
  describe('risk score computation (integration)', () => {
    it('computes expected risk for a file with one dependent and no tests', () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir);

      fs.writeFileSync(
        path.join(srcDir, 'core.ts'),
        'export function compute(): number { return 42; }\n',
      );
      fs.writeFileSync(
        path.join(srcDir, 'app.ts'),
        'import { compute } from "./core";\nexport const result = compute();\n',
      );

      // Commit so HEAD exists.
      const { execSync } = require('child_process');
      execSync('git add .', { cwd: tempDir, stdio: 'ignore' });
      execSync('git commit -m "init"', { cwd: tempDir, stdio: 'ignore' });

      const diff = [
        'diff --git a/src/core.ts b/src/core.ts',
        'index 1234567..abcdefg 100644',
        '--- a/src/core.ts',
        '+++ b/src/core.ts',
        '@@ -1 +1 @@',
        '-export function compute(): number { return 42; }',
        '+export function compute(): number { return 99; }',
      ].join('\n');

      const result = computeBlastRadius({
        root: tempDir,
        diffContent: diff,
        hops: 2,
      });

      expect(result.changedFiles).toContain('src/core.ts');
      // app.ts imports core.ts → should be affected at hop 1.
      const appNode = result.affectedNodes.find((n) => n.file.includes('app'));
      expect(appNode).toBeDefined();
      expect(appNode!.hopDistance).toBe(1);

      // No test files exist → untestedRatio = 1.
      expect(result.formulaInputs.untestedRatio).toBe(1);

      // Risk must be > 0 and ≤ 10.
      expect(result.riskScore).toBeGreaterThan(0);
      expect(result.riskScore).toBeLessThanOrEqual(10);
    });
  });

  // -------------------------------------------------------------------------
  // Zero affected nodes edge cases
  // -------------------------------------------------------------------------
  describe('zero affected nodes', () => {
    it('returns risk score 0 when diff is empty', () => {
      const result = computeBlastRadius({
        root: tempDir,
        diffContent: '',
        hops: 2,
      });

      expect(result.riskScore).toBe(0);
      expect(result.changedFiles).toEqual([]);
      expect(result.affectedNodes).toEqual([]);
      expect(result.summary).toContain('No changed files');
    });

    it('returns risk score 0 when changed file has no dependents', () => {
      const srcDir = path.join(tempDir, 'src');
      fs.mkdirSync(srcDir);
      fs.writeFileSync(
        path.join(srcDir, 'isolated.ts'),
        'export const x = 1;\n',
      );

      const diff = [
        'diff --git a/src/isolated.ts b/src/isolated.ts',
        'index 1234567..abcdefg 100644',
        '--- a/src/isolated.ts',
        '+++ b/src/isolated.ts',
        '@@ -1 +1 @@',
        '-export const x = 1;',
        '+export const x = 2;',
      ].join('\n');

      const result = computeBlastRadius({
        root: tempDir,
        diffContent: diff,
        hops: 2,
      });

      expect(result.riskScore).toBe(0);
      expect(result.changedFiles).toContain('src/isolated.ts');
      expect(result.affectedNodes).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Output formatting
  // -------------------------------------------------------------------------
  describe('formatters', () => {
    it('formatBlastRadiusText produces readable output', () => {
      const mockResult = {
        riskScore: 4.2,
        summary: 'Risk 4.2/10 (moderate): 1 file(s) changed, 2 downstream affected, 1 untested.',
        changedFiles: ['src/core.ts'],
        changedSymbols: [{ name: 'compute', kind: 'function' as const, file: 'src/core.ts' }],
        affectedNodes: [
          { file: 'src/app.ts', hopDistance: 1, centrality: 0.8, hasTest: true },
          { file: 'src/cli.ts', hopDistance: 2, centrality: 0.3, hasTest: false },
        ],
        formulaInputs: {
          normalizedAffectedCount: 0.1,
          avgCentrality: 0.55,
          untestedRatio: 0.5,
          normalizedMaxHopSpread: 1.0,
        },
        hops: 2,
      };

      const text = formatBlastRadiusText(mockResult);

      expect(text).toContain('Risk Score: 4.2/10');
      expect(text).toContain('src/core.ts');
      expect(text).toContain('src/app.ts');
      expect(text).toContain('[NO TEST]');
      expect(text).toContain('Hop 1');
      expect(text).toContain('Hop 2');
    });

    it('formatBlastRadiusJson produces valid JSON', () => {
      const mockResult = {
        riskScore: 0,
        summary: 'No changed files detected in diff.',
        changedFiles: [],
        changedSymbols: [],
        affectedNodes: [],
        formulaInputs: {
          normalizedAffectedCount: 0,
          avgCentrality: 0,
          untestedRatio: 0,
          normalizedMaxHopSpread: 0,
        },
        hops: 2,
      };

      const json = formatBlastRadiusJson(mockResult);
      const parsed = JSON.parse(json);

      expect(parsed.riskScore).toBe(0);
      expect(parsed.affectedNodes).toEqual([]);
    });
  });
});
