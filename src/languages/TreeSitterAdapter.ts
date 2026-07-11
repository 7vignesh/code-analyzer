/**
 * Universal tree-sitter adapter using web-tree-sitter (WASM).
 * Handles Python, Go, Rust, Java, and any future language by loading
 * the appropriate grammar at runtime. No native compilation required.
 */

import * as path from 'path';
import { LanguageAdapter, SkeletonResult, Symbol } from './LanguageAdapter';
import { LangConfig, getLangConfigForExt } from './lang-config';

// web-tree-sitter types (loaded dynamically to avoid ESM/CJS issues)
let Parser: any = null;
let initPromise: Promise<void> | null = null;
const loadedLanguages = new Map<string, any>();

/** Resolve path to a bundled .wasm grammar file. */
function grammarPath(filename: string): string {
  return path.join(__dirname, 'grammars', filename);
}

/** Initialize the WASM parser (once). */
async function ensureInit(): Promise<boolean> {
  if (Parser) return true;
  if (initPromise) {
    await initPromise;
    return Parser !== null;
  }
  initPromise = (async () => {
    try {
      const mod = require('web-tree-sitter');
      const P = mod.default ?? mod;
      await P.init();
      Parser = P;
    } catch {
      Parser = null;
    }
  })();
  await initPromise;
  return Parser !== null;
}

/** Load a language grammar (cached). */
async function loadLanguage(config: LangConfig): Promise<any | null> {
  if (loadedLanguages.has(config.id)) {
    return loadedLanguages.get(config.id);
  }
  try {
    const wasmPath = grammarPath(config.grammarFile);
    const lang = await Parser.Language.load(wasmPath);
    loadedLanguages.set(config.id, lang);
    return lang;
  } catch {
    return null;
  }
}

/** Synchronous wrapper — uses cached state if already initialized. */
function getParserSync(config: LangConfig): { parser: any; language: any } | null {
  if (!Parser) return null;
  const lang = loadedLanguages.get(config.id);
  if (!lang) return null;
  const parser = new Parser();
  parser.setLanguage(lang);
  return { parser, language: lang };
}

/**
 * Extract the text of a node's named field, or null if not present.
 */
function fieldText(node: any, fieldName: string): string | null {
  const child = node.childForFieldName(fieldName);
  return child ? child.text : null;
}

/**
 * Get the signature of a function/method node (everything except the body).
 */
function getSignature(node: any, lines: string[], config: LangConfig): string {
  const bodyNode = node.childForFieldName(config.bodyField);
  if (!bodyNode) {
    // No body field — return the whole node text (might be a declaration)
    return node.text;
  }
  const startRow = node.startPosition.row;
  const bodyStartRow = bodyNode.startPosition.row;
  // Return lines from node start to body start (exclusive of body content)
  const sigLines = lines.slice(startRow, bodyStartRow);
  if (sigLines.length === 0) {
    // Body is on the same line as the signature
    const fullLine = lines[startRow] || '';
    const bodyCol = bodyNode.startPosition.column;
    return fullLine.slice(0, bodyCol).trimEnd();
  }
  return sigLines.join('\n');
}

/**
 * Get the indent level of a node based on its start column.
 */
function indent(node: any): string {
  return ' '.repeat(node.startPosition.column);
}

/**
 * Determine the body placeholder based on language.
 */
function bodyPlaceholder(config: LangConfig): string {
  if (config.id === 'python') return '    ...';
  return '  /* trimmed */';
}

/**
 * Generate skeleton for a class node.
 */
function skeletonizeClass(node: any, lines: string[], config: LangConfig): string[] {
  const out: string[] = [];
  const name = fieldText(node, config.nameField) || 'Unknown';
  const bodyNode = node.childForFieldName(config.classBodyField);

  // Class signature
  const sig = getSignature(node, lines, config);
  out.push(sig);

  if (!bodyNode) {
    return out;
  }

  // For Python, add body placeholder for the class opening
  if (config.id === 'python') {
    // Walk methods inside the class body
    for (const child of bodyNode.namedChildren) {
      if (config.methodTypes.includes(child.type)) {
        out.push('');
        const methodSig = getSignature(child, lines, config);
        out.push(methodSig);
        out.push(indent(child) + '    ...');
      }
    }
  } else {
    // For braced languages, output opening brace + method signatures
    if (!sig.includes('{')) {
      out.push(indent(node) + '{');
    }
    for (const child of bodyNode.namedChildren) {
      if (config.methodTypes.includes(child.type)) {
        const methodSig = getSignature(child, lines, config);
        out.push(methodSig);
        out.push(indent(child) + bodyPlaceholder(config));
        if (!config.id.match(/python/)) {
          out.push(indent(child) + '}');
        }
        out.push('');
      } else if (child.type === 'field_declaration' ||
                 child.type === 'field_definition' ||
                 child.type === 'annotation_type_element_declaration') {
        // Keep field declarations as-is
        out.push(child.text);
      }
    }
    out.push(indent(node) + '}');
  }

  return out;
}

/**
 * Generate skeleton for a function node.
 */
function skeletonizeFunction(node: any, lines: string[], config: LangConfig): string[] {
  const out: string[] = [];
  const sig = getSignature(node, lines, config);
  out.push(sig);

  if (config.id === 'python') {
    out.push(indent(node) + '    ...');
  } else {
    if (!sig.trimEnd().endsWith('{')) {
      out.push(indent(node) + '{');
    }
    out.push(indent(node) + bodyPlaceholder(config));
    out.push(indent(node) + '}');
  }

  return out;
}

export class TreeSitterAdapter implements LanguageAdapter {
  name: string;
  extensions: string[];
  private configs: LangConfig[];
  private _initDone = false;

  constructor(configs: LangConfig[]) {
    this.configs = configs;
    this.name = 'tree-sitter';
    this.extensions = configs.flatMap((c) => c.extensions);
  }

  canHandle(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.extensions.includes(ext);
  }

  /** Ensure WASM parser is initialized. Call at the start of each public method. */
  private ensureReady(ext: string): LangConfig | null {
    const config = getLangConfigForExt(ext);
    if (!config) return null;
    if (!Parser || !loadedLanguages.has(config.id)) return null;
    return config;
  }

  /** Async initialization — must be called once before using the adapter. */
  async initialize(): Promise<void> {
    if (this._initDone) return;
    const ok = await ensureInit();
    if (!ok) return;
    for (const config of this.configs) {
      await loadLanguage(config);
    }
    this._initDone = true;
  }

  /** Synchronous initialization attempt (for compat with existing sync API). */
  initializeSync(): void {
    // Trigger async init in background. Methods will return fallbacks
    // until initialization completes.
    if (!this._initDone) {
      this.initialize().catch(() => {});
    }
  }

  generateSkeleton(content: string, filePath: string): SkeletonResult {
    const ext = path.extname(filePath).toLowerCase();
    const config = this.ensureReady(ext);
    if (!config) {
      return { skeleton: content.split('\n').slice(0, 50).join('\n') };
    }

    try {
      const ctx = getParserSync(config);
      if (!ctx) return { skeleton: content.split('\n').slice(0, 50).join('\n') };

      const tree = ctx.parser.parse(content);
      if (!tree) return { skeleton: content.split('\n').slice(0, 50).join('\n') };

      const lines = content.split(/\r?\n/);
      const skeletonLines: string[] = [];

      skeletonLines.push(`/* Skeleton of ${path.basename(filePath)} */`);
      skeletonLines.push('');

      for (const child of tree.rootNode.namedChildren) {
        if (config.importTypes.includes(child.type)) {
          skeletonLines.push(child.text);
        } else if (config.classTypes.includes(child.type)) {
          skeletonLines.push('');
          skeletonLines.push(...skeletonizeClass(child, lines, config));
        } else if (config.functionTypes.includes(child.type)) {
          skeletonLines.push('');
          skeletonLines.push(...skeletonizeFunction(child, lines, config));
        } else if (config.interfaceTypes.includes(child.type)) {
          skeletonLines.push('');
          skeletonLines.push(child.text);
        } else if (config.typeTypes.includes(child.type)) {
          skeletonLines.push('');
          skeletonLines.push(child.text);
        }
      }

      tree.delete();
      ctx.parser.delete();

      return { skeleton: skeletonLines.join('\n').trim() };
    } catch {
      return { skeleton: content.split('\n').slice(0, 50).join('\n') };
    }
  }

  extractSymbols(content: string): Symbol[] {
    // Determine the config from context (we don't have filePath here,
    // so try each config until one parses successfully)
    for (const config of this.configs) {
      const ctx = getParserSync(config);
      if (!ctx) continue;

      try {
        const tree = ctx.parser.parse(content);
        if (!tree) { ctx.parser.delete(); continue; }

        const symbols: Symbol[] = [];
        this.walkSymbols(tree.rootNode, symbols, config);
        tree.delete();
        ctx.parser.delete();

        if (symbols.length > 0) return symbols;
      } catch {
        ctx.parser.delete();
      }
    }
    return [];
  }

  extractImports(content: string): string[] {
    for (const config of this.configs) {
      const ctx = getParserSync(config);
      if (!ctx) continue;

      try {
        const tree = ctx.parser.parse(content);
        if (!tree) { ctx.parser.delete(); continue; }

        const imports: string[] = [];
        for (const child of tree.rootNode.namedChildren) {
          if (config.importTypes.includes(child.type)) {
            // Extract module name from import
            const text = child.text;
            imports.push(text);
          }
        }
        tree.delete();
        ctx.parser.delete();

        if (imports.length > 0) return imports;
      } catch {
        ctx.parser.delete();
      }
    }
    return [];
  }

  /** Extract symbols with a file path hint for correct config selection. */
  extractSymbolsForFile(content: string, filePath: string): Symbol[] {
    const ext = path.extname(filePath).toLowerCase();
    const config = this.ensureReady(ext);
    if (!config) return [];

    const ctx = getParserSync(config);
    if (!ctx) return [];

    try {
      const tree = ctx.parser.parse(content);
      if (!tree) { ctx.parser.delete(); return []; }

      const symbols: Symbol[] = [];
      this.walkSymbols(tree.rootNode, symbols, config);
      tree.delete();
      ctx.parser.delete();
      return symbols;
    } catch {
      ctx.parser.delete();
      return [];
    }
  }

  /** Extract imports with a file path hint for correct config selection. */
  extractImportsForFile(content: string, filePath: string): string[] {
    const ext = path.extname(filePath).toLowerCase();
    const config = this.ensureReady(ext);
    if (!config) return [];

    const ctx = getParserSync(config);
    if (!ctx) return [];

    try {
      const tree = ctx.parser.parse(content);
      if (!tree) { ctx.parser.delete(); return []; }

      const imports: string[] = [];
      for (const child of tree.rootNode.namedChildren) {
        if (config.importTypes.includes(child.type)) {
          imports.push(child.text);
        }
      }
      tree.delete();
      ctx.parser.delete();
      return imports;
    } catch {
      ctx.parser.delete();
      return [];
    }
  }

  private walkSymbols(node: any, symbols: Symbol[], config: LangConfig): void {
    for (const child of node.namedChildren) {
      const name = fieldText(child, config.nameField);
      if (!name) continue;

      if (config.functionTypes.includes(child.type)) {
        symbols.push({
          name,
          kind: 'function',
          line: child.startPosition.row + 1,
        });
      } else if (config.classTypes.includes(child.type)) {
        symbols.push({
          name,
          kind: 'class',
          line: child.startPosition.row + 1,
        });
        // Walk class body for methods
        const body = child.childForFieldName(config.classBodyField);
        if (body) {
          for (const member of body.namedChildren) {
            if (config.methodTypes.includes(member.type)) {
              const methodName = fieldText(member, config.nameField);
              if (methodName) {
                symbols.push({
                  name: methodName,
                  kind: 'function',
                  line: member.startPosition.row + 1,
                });
              }
            }
          }
        }
      } else if (config.interfaceTypes.includes(child.type)) {
        symbols.push({
          name,
          kind: 'interface',
          line: child.startPosition.row + 1,
        });
      } else if (config.typeTypes.includes(child.type)) {
        symbols.push({
          name,
          kind: 'type',
          line: child.startPosition.row + 1,
        });
      }
    }
  }
}
