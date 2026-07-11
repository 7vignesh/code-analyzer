/**
 * Per-language AST node type mappings for tree-sitter grammars.
 * Adding a new language = adding one entry to this map.
 */

export interface LangConfig {
  /** Language identifier. */
  id: string;
  /** File extensions this language handles (lowercase, with dot). */
  extensions: string[];
  /** Filename of the .wasm grammar (relative to grammars/ dir). */
  grammarFile: string;
  /** AST node types that represent top-level function declarations. */
  functionTypes: string[];
  /** AST node types that represent class declarations. */
  classTypes: string[];
  /** AST node types that represent methods inside classes. */
  methodTypes: string[];
  /** AST node types that represent import statements. */
  importTypes: string[];
  /** AST node types that represent interface/protocol declarations. */
  interfaceTypes: string[];
  /** AST node types that represent type alias declarations. */
  typeTypes: string[];
  /** The field name used to extract the symbol name (usually 'name'). */
  nameField: string;
  /** The field name for the function/method body (usually 'body' or 'block'). */
  bodyField: string;
  /** The field name for class body. */
  classBodyField: string;
  /** The field name for function parameters. */
  parametersField: string;
  /** The field name for return type annotation (if the language supports it). */
  returnTypeField: string;
}

export const LANG_CONFIGS: Record<string, LangConfig> = {
  python: {
    id: 'python',
    extensions: ['.py', '.pyi'],
    grammarFile: 'tree-sitter-python.wasm',
    functionTypes: ['function_definition'],
    classTypes: ['class_definition'],
    methodTypes: ['function_definition'],
    importTypes: ['import_statement', 'import_from_statement'],
    interfaceTypes: [],
    typeTypes: [],
    nameField: 'name',
    bodyField: 'body',
    classBodyField: 'body',
    parametersField: 'parameters',
    returnTypeField: 'return_type',
  },
  go: {
    id: 'go',
    extensions: ['.go'],
    grammarFile: 'tree-sitter-go.wasm',
    functionTypes: ['function_declaration'],
    classTypes: ['type_declaration'],
    methodTypes: ['method_declaration'],
    importTypes: ['import_declaration'],
    interfaceTypes: ['type_declaration'],
    typeTypes: ['type_declaration'],
    nameField: 'name',
    bodyField: 'body',
    classBodyField: 'body',
    parametersField: 'parameters',
    returnTypeField: 'result',
  },
  rust: {
    id: 'rust',
    extensions: ['.rs'],
    grammarFile: 'tree-sitter-rust.wasm',
    functionTypes: ['function_item'],
    classTypes: ['struct_item', 'enum_item'],
    methodTypes: ['function_item'],
    importTypes: ['use_declaration'],
    interfaceTypes: ['trait_item'],
    typeTypes: ['type_item'],
    nameField: 'name',
    bodyField: 'body',
    classBodyField: 'body',
    parametersField: 'parameters',
    returnTypeField: 'return_type',
  },
  java: {
    id: 'java',
    extensions: ['.java'],
    grammarFile: 'tree-sitter-java.wasm',
    functionTypes: ['method_declaration', 'constructor_declaration'],
    classTypes: ['class_declaration', 'enum_declaration'],
    methodTypes: ['method_declaration', 'constructor_declaration'],
    importTypes: ['import_declaration'],
    interfaceTypes: ['interface_declaration'],
    typeTypes: [],
    nameField: 'name',
    bodyField: 'body',
    classBodyField: 'body',
    parametersField: 'parameters',
    returnTypeField: 'type',
  },
};

/** Get the language config for a file extension, or null if unsupported. */
export function getLangConfigForExt(ext: string): LangConfig | null {
  const lower = ext.toLowerCase();
  for (const config of Object.values(LANG_CONFIGS)) {
    if (config.extensions.includes(lower)) {
      return config;
    }
  }
  return null;
}
