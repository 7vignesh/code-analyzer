import { PythonAdapter } from '../src/languages/PythonAdapter';

describe('PythonAdapter (tree-sitter)', () => {
  const adapter = new PythonAdapter();

  it('extracts skeleton for class and nested method', () => {
    const src = [
      'class Calculator:',
      '    def add(self, a: int, b: int) -> int:',
      '        return a + b',
      '',
    ].join('\n');
    const { skeleton } = adapter.generateSkeleton(src, 'calc.py');
    expect(skeleton).toContain('class Calculator:');
    expect(skeleton).toContain('def add(self, a: int, b: int) -> int:');
    expect(skeleton).toContain('...');
    expect(skeleton).not.toContain('return a + b');
  });

  it('extracts imports via AST', () => {
    const src = 'from os.path import join\nimport sys\n';
    expect(adapter.extractImports(src)).toEqual(expect.arrayContaining(['os.path', 'sys']));
  });

  it('extracts symbols', () => {
    const src = 'class A:\n    pass\ndef f():\n    pass\n';
    const syms = adapter.extractSymbols(src);
    expect(syms.some((s) => s.name === 'A' && s.kind === 'class')).toBe(true);
    expect(syms.some((s) => s.name === 'f' && s.kind === 'function')).toBe(true);
  });
});
