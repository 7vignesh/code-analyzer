/**
 * Tests for the TreeSitterAdapter (replaces old PythonAdapter tests).
 * These tests require WASM initialization, so they test the adapter's
 * fallback behavior when WASM is not available.
 */

import { TreeSitterAdapter } from '../src/languages/TreeSitterAdapter';
import { LANG_CONFIGS } from '../src/languages/lang-config';

// Mock web-tree-sitter to avoid WASM loading in CI
jest.mock('web-tree-sitter', () => ({
  default: {
    init: jest.fn().mockResolvedValue(undefined),
    Language: { load: jest.fn().mockResolvedValue(null) },
  },
}), { virtual: true });

describe('TreeSitterAdapter', () => {
  const adapter = new TreeSitterAdapter(Object.values(LANG_CONFIGS));

  it('canHandle returns true for supported extensions', () => {
    expect(adapter.canHandle('test.py')).toBe(true);
    expect(adapter.canHandle('test.go')).toBe(true);
    expect(adapter.canHandle('test.rs')).toBe(true);
    expect(adapter.canHandle('test.java')).toBe(true);
    expect(adapter.canHandle('test.pyi')).toBe(true);
  });

  it('canHandle returns false for unsupported extensions', () => {
    expect(adapter.canHandle('test.ts')).toBe(false);
    expect(adapter.canHandle('test.js')).toBe(false);
    expect(adapter.canHandle('test.rb')).toBe(false);
  });

  it('generateSkeleton returns first 50 lines fallback when WASM not loaded', () => {
    const content = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n');
    const result = adapter.generateSkeleton(content, 'test.py');
    const lines = result.skeleton.split('\n');
    expect(lines.length).toBe(50);
    expect(lines[0]).toBe('line 1');
    expect(lines[49]).toBe('line 50');
  });

  it('extractSymbols returns empty array when WASM not loaded', () => {
    const symbols = adapter.extractSymbols('def hello(): pass');
    expect(symbols).toEqual([]);
  });

  it('extractImports returns empty array when WASM not loaded', () => {
    const imports = adapter.extractImports('import os');
    expect(imports).toEqual([]);
  });

  it('has correct extensions list', () => {
    expect(adapter.extensions).toContain('.py');
    expect(adapter.extensions).toContain('.pyi');
    expect(adapter.extensions).toContain('.go');
    expect(adapter.extensions).toContain('.rs');
    expect(adapter.extensions).toContain('.java');
  });
});

describe('LangConfig', () => {
  it('all configs have required fields', () => {
    for (const config of Object.values(LANG_CONFIGS)) {
      expect(config.id).toBeTruthy();
      expect(config.extensions.length).toBeGreaterThan(0);
      expect(config.grammarFile).toContain('.wasm');
      expect(config.functionTypes.length).toBeGreaterThan(0);
      expect(config.nameField).toBeTruthy();
      expect(config.bodyField).toBeTruthy();
    }
  });

  it('no extension overlaps between configs', () => {
    const seen = new Set<string>();
    for (const config of Object.values(LANG_CONFIGS)) {
      for (const ext of config.extensions) {
        expect(seen.has(ext)).toBe(false);
        seen.add(ext);
      }
    }
  });
});
