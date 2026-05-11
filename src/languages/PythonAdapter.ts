import * as path from 'path';
import Parser = require('tree-sitter');
import { LanguageAdapter, SkeletonResult, Symbol } from './LanguageAdapter';

type SyntaxNode = Parser.SyntaxNode;

let pythonLanguage: Parser.Language | undefined;

function ensureParserLoaded(): void {
  if (!pythonLanguage) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    pythonLanguage = require('tree-sitter-python') as Parser.Language;
  }
}

function getParser(): Parser {
  ensureParserLoaded();
  const parser = new Parser();
  parser.setLanguage(pythonLanguage!);
  return parser;
}

function collapseOneLineBody(line: string): string {
  const idx = line.indexOf(':');
  if (idx === -1) {
    return line;
  }
  return `${line.slice(0, idx + 1)} ...`;
}

function baseIndent(line: string | undefined): string {
  if (!line) {
    return '';
  }
  return line.match(/^(\s*)/)?.[1] ?? '';
}

interface SkeletonState {
  lines: string[];
  keep: Set<number>;
  replace: Map<number, string>;
  ellipsisAfter: Set<number>;
}

function addRange(state: SkeletonState, start: number, end: number): void {
  const max = state.lines.length - 1;
  const lo = Math.max(0, start);
  const hi = Math.min(max, end);
  for (let i = lo; i <= hi; i++) {
    state.keep.add(i);
  }
}

function emitFunctionHeader(state: SkeletonState, node: SyntaxNode): void {
  const body = node.childForFieldName('body');
  const start = node.startPosition.row;
  if (!body) {
    addRange(state, start, node.endPosition.row);
    return;
  }
  if (body.startPosition.row > start) {
    addRange(state, start, body.startPosition.row - 1);
    state.ellipsisAfter.add(body.startPosition.row - 1);
    return;
  }
  state.replace.set(start, collapseOneLineBody(state.lines[start]));
}

function emitClassHeaderLines(state: SkeletonState, node: SyntaxNode): void {
  const body = node.childForFieldName('body');
  const start = node.startPosition.row;
  if (!body) {
    addRange(state, start, node.endPosition.row);
    return;
  }
  if (body.startPosition.row > start) {
    addRange(state, start, body.startPosition.row - 1);
    return;
  }
  state.replace.set(start, collapseOneLineBody(state.lines[start]));
}

function processDecoratedDefinition(state: SkeletonState, node: SyntaxNode): void {
  for (const child of node.namedChildren) {
    if (child.type === 'decorator') {
      addRange(state, child.startPosition.row, child.endPosition.row);
    } else {
      processStatement(state, child);
    }
  }
}

function processStatement(state: SkeletonState, node: SyntaxNode): void {
  switch (node.type) {
    case 'import_statement':
    case 'import_from_statement':
      addRange(state, node.startPosition.row, node.endPosition.row);
      return;
    case 'type_alias_statement':
      addRange(state, node.startPosition.row, node.endPosition.row);
      return;
    case 'decorated_definition':
      processDecoratedDefinition(state, node);
      return;
    case 'function_definition':
      emitFunctionHeader(state, node);
      return;
    case 'class_definition': {
      emitClassHeaderLines(state, node);
      const body = node.childForFieldName('body');
      if (body?.type !== 'block') {
        return;
      }
      const start = node.startPosition.row;
      const meaningful = body.namedChildren.filter(
        (c: SyntaxNode) => c.type !== 'pass_statement',
      );
      if (meaningful.length === 0) {
        if (body.startPosition.row > start) {
          state.ellipsisAfter.add(body.startPosition.row - 1);
        } else if (!state.replace.has(start)) {
          state.replace.set(start, collapseOneLineBody(state.lines[start]));
        }
        return;
      }
      for (const st of body.namedChildren) {
        processStatement(state, st);
      }
      return;
    }
    case 'expression_statement': {
      const hasAssign = node.namedChildren.some(
        (c: SyntaxNode) => c.type === 'assignment',
      );
      if (hasAssign) {
        addRange(state, node.startPosition.row, node.endPosition.row);
      }
      return;
    }
    default:
      return;
  }
}

function buildSkeletonAst(content: string): string {
  const parser = getParser();
  const tree = parser.parse(content);
  const lines = content.split(/\r?\n/);
  const state: SkeletonState = {
    lines,
    keep: new Set<number>(),
    replace: new Map<number, string>(),
    ellipsisAfter: new Set<number>(),
  };

  if (tree.rootNode.type === 'module') {
    for (const child of tree.rootNode.namedChildren) {
      processStatement(state, child);
    }
  }

  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (state.replace.has(i)) {
      out.push(state.replace.get(i)!);
      continue;
    }
    if (state.keep.has(i)) {
      out.push(lines[i]);
      if (state.ellipsisAfter.has(i)) {
        const ind = baseIndent(lines[i]);
        out.push(`${ind}    ...`);
      }
    }
  }

  return out.join('\n').trim();
}

function walkImports(node: SyntaxNode, acc: Set<string>): void {
  if (node.type === 'import_from_statement') {
    const mod = node.childForFieldName('module_name');
    if (mod) {
      acc.add(mod.text);
    }
  } else if (node.type === 'import_statement') {
    for (const child of node.namedChildren) {
      if (child.type === 'dotted_name') {
        acc.add(child.text);
      } else if (child.type === 'aliased_import') {
        const n = child.childForFieldName('name');
        if (n?.type === 'dotted_name') {
          acc.add(n.text);
        }
      }
    }
  }
  for (const child of node.namedChildren) {
    walkImports(child, acc);
  }
}

function walkSymbols(node: SyntaxNode, symbols: Symbol[]): void {
  if (node.type === 'function_definition') {
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      symbols.push({
        name: nameNode.text,
        kind: 'function',
        line: node.startPosition.row + 1,
      });
    }
  } else if (node.type === 'class_definition') {
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      symbols.push({
        name: nameNode.text,
        kind: 'class',
        line: node.startPosition.row + 1,
      });
    }
  } else if (node.type === 'type_alias_statement') {
    const left = node.childForFieldName('left');
    if (left) {
      symbols.push({
        name: left.text,
        kind: 'type',
        line: node.startPosition.row + 1,
      });
    }
  } else if (node.type === 'assignment') {
    const left = node.childForFieldName('left');
    if (left?.type === 'identifier') {
      symbols.push({
        name: left.text,
        kind: 'variable',
        line: node.startPosition.row + 1,
      });
    }
  }
  for (const child of node.namedChildren) {
    walkSymbols(child, symbols);
  }
}

export class PythonAdapter implements LanguageAdapter {
  name = 'python';
  extensions = ['.py', '.pyi'];

  canHandle(filePath: string): boolean {
    return this.extensions.includes(path.extname(filePath).toLowerCase());
  }

  generateSkeleton(content: string, _filePath: string, _rootDir?: string): SkeletonResult {
    try {
      return { skeleton: buildSkeletonAst(content) };
    } catch {
      return { skeleton: content.split('\n').slice(0, 50).join('\n') };
    }
  }

  extractSymbols(content: string): Symbol[] {
    try {
      const parser = getParser();
      const tree = parser.parse(content);
      const symbols: Symbol[] = [];
      walkSymbols(tree.rootNode, symbols);
      return symbols;
    } catch {
      return [];
    }
  }

  extractImports(content: string): string[] {
    try {
      const parser = getParser();
      const tree = parser.parse(content);
      const mods = new Set<string>();
      walkImports(tree.rootNode, mods);
      return [...mods];
    } catch {
      return [];
    }
  }
}
