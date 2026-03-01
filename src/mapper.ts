/**
 * Symbol mapping system for on-demand code retrieval
 * Tracks locations of all code blocks that were trimmed in skeletons
 */

import { Project, SourceFile, SyntaxKind } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';

export interface SymbolLocation {
  symbolId: string;
  symbolName: string;
  symbolType: 'function' | 'method' | 'constructor' | 'arrow-function' | 'variable';
  filePath: string;
  startLine: number;
  endLine: number;
  startPos: number;
  endPos: number;
  parentClass?: string;
  signature?: string;
}

export interface SymbolMapping {
  generatedAt: string;
  rootPath: string;
  files: {
    [filePath: string]: {
      originalPath: string;
      symbols: SymbolLocation[];
    };
  };
}

/**
 * Build skeleton with symbol mapping for on-demand retrieval
 */
export function buildSkeletonWithMapping(
  filePath: string,
  rootPath: string
): { skeleton: string; symbols: SymbolLocation[] } {
  const symbols: SymbolLocation[] = [];
  
  try {
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      compilerOptions: {
        allowJs: true,
        checkJs: false,
      },
    });

    const sourceFile = project.addSourceFileAtPath(filePath);
    const skeleton = generateSkeletonWithMapping(sourceFile, filePath, symbols, rootPath);
    
    return { skeleton, symbols };
  } catch (error) {
    return {
      skeleton: `/* Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'} */`,
      symbols: [],
    };
  }
}

/**
 * Generate skeleton and populate symbol mapping
 */
function generateSkeletonWithMapping(
  sourceFile: SourceFile,
  filePath: string,
  symbols: SymbolLocation[],
  rootPath: string
): string {
  const lines: string[] = [];
  const fileName = path.basename(filePath);

  lines.push(`/* Skeleton of ${fileName} - Generated with symbol mapping */\n`);

  // Imports
  const imports = sourceFile.getImportDeclarations();
  for (const imp of imports) {
    lines.push(imp.getText());
  }
  if (imports.length > 0) lines.push('');

  // Classes
  const classes = sourceFile.getClasses();
  for (const cls of classes) {
    lines.push(processClassWithMapping(cls, filePath, symbols, rootPath));
    lines.push('');
  }

  // Interfaces (no mapping needed - no implementation)
  const interfaces = sourceFile.getInterfaces();
  for (const iface of interfaces) {
    lines.push(iface.getText());
    lines.push('');
  }

  // Type aliases
  const typeAliases = sourceFile.getTypeAliases();
  for (const typeAlias of typeAliases) {
    lines.push(typeAlias.getText());
    lines.push('');
  }

  // Enums
  const enums = sourceFile.getEnums();
  for (const enumDecl of enums) {
    lines.push(enumDecl.getText());
    lines.push('');
  }

  // Top-level functions
  const functions = sourceFile.getFunctions();
  for (const func of functions) {
    lines.push(processFunctionWithMapping(func, filePath, symbols, rootPath));
    lines.push('');
  }

  // Variables (including arrow functions)
  const variables = sourceFile.getVariableStatements();
  for (const varStatement of variables) {
    lines.push(processVariableStatementWithMapping(varStatement, filePath, symbols, rootPath));
    lines.push('');
  }

  // Export declarations
  const exportDeclarations = sourceFile.getExportDeclarations();
  for (const exportDecl of exportDeclarations) {
    lines.push(exportDecl.getText());
  }

  const exportAssignments = sourceFile.getExportAssignments();
  for (const exportAssign of exportAssignments) {
    lines.push(exportAssign.getText());
  }

  return lines.join('\n').trim();
}

/**
 * Process class and map methods
 */
function processClassWithMapping(
  cls: any,
  filePath: string,
  symbols: SymbolLocation[],
  rootPath: string
): string {
  const lines: string[] = [];
  const className = cls.getName() || 'Anonymous';

  const modifiers = cls.getModifiers().map((m: any) => m.getText()).join(' ');
  let classDecl = modifiers ? `${modifiers} class` : 'class';
  classDecl += ` ${className}`;

  const typeParams = cls.getTypeParameters();
  if (typeParams.length > 0) {
    classDecl += `<${typeParams.map((tp: any) => tp.getText()).join(', ')}>`;
  }

  const extendsClause = cls.getExtends();
  if (extendsClause) {
    classDecl += ` extends ${extendsClause.getText()}`;
  }

  const implementsClauses = cls.getImplements();
  if (implementsClauses.length > 0) {
    classDecl += ` implements ${implementsClauses.map((ic: any) => ic.getText()).join(', ')}`;
  }

  classDecl += ' {';
  lines.push(classDecl);

  // Properties
  const properties = cls.getProperties();
  for (const prop of properties) {
    const propModifiers = prop.getModifiers().map((m: any) => m.getText()).join(' ');
    const propName = prop.getName();
    const propType = prop.getType().getText();
    const propLine = propModifiers
      ? `  ${propModifiers} ${propName}: ${propType};`
      : `  ${propName}: ${propType};`;
    lines.push(propLine);
  }
  if (properties.length > 0) lines.push('');

  // Methods
  const methods = cls.getMethods();
  for (const method of methods) {
    const methodName = method.getName();
    const symbolId = `${className}.${methodName}`;
    
    // Record symbol location
    const startLineNum = method.getStartLineNumber();
    const endLineNum = method.getEndLineNumber();
    const startPos = method.getStart();
    const endPos = method.getEnd();

    symbols.push({
      symbolId,
      symbolName: methodName,
      symbolType: 'method',
      filePath: path.relative(rootPath, filePath),
      startLine: startLineNum,
      endLine: endLineNum,
      startPos,
      endPos,
      parentClass: className,
      signature: method.getText().split('{')[0].trim(),
    });

    lines.push(processMethodSignature(method, symbolId));
  }

  // Constructors
  const constructors = cls.getConstructors();
  for (const ctor of constructors) {
    const symbolId = `${className}.constructor`;
    
    const startLineNum = ctor.getStartLineNumber();
    const endLineNum = ctor.getEndLineNumber();
    
    symbols.push({
      symbolId,
      symbolName: 'constructor',
      symbolType: 'constructor',
      filePath: path.relative(rootPath, filePath),
      startLine: startLineNum,
      endLine: endLineNum,
      startPos: ctor.getStart(),
      endPos: ctor.getEnd(),
      parentClass: className,
    });

    lines.push(processConstructorSignature(ctor, symbolId));
  }

  lines.push('}');
  return lines.join('\n');
}

/**
 * Process method signature with symbol placeholder
 */
function processMethodSignature(method: any, symbolId: string): string {
  const lines: string[] = [];
  
  const modifiers = method.getModifiers().map((m: any) => m.getText()).join(' ');
  const name = method.getName();
  const params = method.getParameters()
    .map((p: any) => {
      const pName = p.getName();
      const pType = p.getType().getText();
      const optional = p.isOptional() ? '?' : '';
      return `${pName}${optional}: ${pType}`;
    })
    .join(', ');
  const returnType = method.getReturnType().getText();

  let signature = modifiers ? `  ${modifiers} ${name}` : `  ${name}`;
  signature += `(${params}): ${returnType} {`;
  lines.push(signature);
  lines.push(`    /* [SYMBOL:${symbolId}] - Implementation available via get_symbol_details */`);
  lines.push('  }');
  lines.push('');

  return lines.join('\n');
}

/**
 * Process constructor signature
 */
function processConstructorSignature(ctor: any, symbolId: string): string {
  const lines: string[] = [];
  
  const params = ctor.getParameters()
    .map((p: any) => {
      const modifiers = p.getModifiers().map((m: any) => m.getText()).join(' ');
      const pName = p.getName();
      const pType = p.getType().getText();
      const optional = p.isOptional() ? '?' : '';
      const paramStr = `${pName}${optional}: ${pType}`;
      return modifiers ? `${modifiers} ${paramStr}` : paramStr;
    })
    .join(', ');

  lines.push(`  constructor(${params}) {`);
  lines.push(`    /* [SYMBOL:${symbolId}] - Implementation available via get_symbol_details */`);
  lines.push('  }');
  lines.push('');

  return lines.join('\n');
}

/**
 * Process function with mapping
 */
function processFunctionWithMapping(
  func: any,
  filePath: string,
  symbols: SymbolLocation[],
  rootPath: string
): string {
  const lines: string[] = [];
  const funcName = func.getName() || 'anonymous';
  const symbolId = funcName;

  // Record symbol
  symbols.push({
    symbolId,
    symbolName: funcName,
    symbolType: 'function',
    filePath: path.relative(rootPath, filePath),
    startLine: func.getStartLineNumber(),
    endLine: func.getEndLineNumber(),
    startPos: func.getStart(),
    endPos: func.getEnd(),
    signature: func.getText().split('{')[0].trim(),
  });

  const modifiers = func.getModifiers().map((m: any) => m.getText()).join(' ');
  const params = func.getParameters()
    .map((p: any) => {
      const pName = p.getName();
      const pType = p.getType().getText();
      const optional = p.isOptional() ? '?' : '';
      return `${pName}${optional}: ${pType}`;
    })
    .join(', ');
  const returnType = func.getReturnType().getText();

  let signature = modifiers ? `${modifiers} function` : 'function';
  signature += ` ${funcName}(${params}): ${returnType} {`;
  lines.push(signature);
  lines.push(`  /* [SYMBOL:${symbolId}] - Implementation available via get_symbol_details */`);
  lines.push('}');

  return lines.join('\n');
}

/**
 * Process variable statements (handles arrow functions)
 */
function processVariableStatementWithMapping(
  varStatement: any,
  filePath: string,
  symbols: SymbolLocation[],
  rootPath: string
): string {
  const lines: string[] = [];
  
  const modifiers = varStatement.getModifiers().map((m: any) => m.getText()).join(' ');
  const declarations = varStatement.getDeclarations();
  const declarationKind = varStatement.getDeclarationKind();

  for (const decl of declarations) {
    const name = decl.getName();
    const type = decl.getType().getText();
    const initializer = decl.getInitializer();

    if (initializer) {
      const initText = initializer.getText();
      
      // Check if it's an arrow function
      if (initText.includes('=>') || initializer.getKind() === SyntaxKind.ArrowFunction) {
        const symbolId = name;
        
        symbols.push({
          symbolId,
          symbolName: name,
          symbolType: 'arrow-function',
          filePath: path.relative(rootPath, filePath),
          startLine: decl.getStartLineNumber(),
          endLine: decl.getEndLineNumber(),
          startPos: decl.getStart(),
          endPos: decl.getEnd(),
          signature: `${declarationKind} ${name}: ${type}`,
        });

        const line = modifiers
          ? `${modifiers} ${declarationKind} ${name}: ${type} = /* [SYMBOL:${symbolId}] */;`
          : `${declarationKind} ${name}: ${type} = /* [SYMBOL:${symbolId}] */;`;
        lines.push(line);
      } else if (initText.length < 50 && !initText.includes('{')) {
        // Simple value - keep it
        const line = modifiers
          ? `${modifiers} ${declarationKind} ${name}: ${type} = ${initText};`
          : `${declarationKind} ${name}: ${type} = ${initText};`;
        lines.push(line);
      } else {
        // Complex value - stub it
        const line = modifiers
          ? `${modifiers} ${declarationKind} ${name}: ${type} = /* trimmed */;`
          : `${declarationKind} ${name}: ${type} = /* trimmed */;`;
        lines.push(line);
      }
    } else {
      const line = modifiers
        ? `${modifiers} ${declarationKind} ${name}: ${type};`
        : `${declarationKind} ${name}: ${type};`;
      lines.push(line);
    }
  }

  return lines.join('\n');
}

/**
 * Get symbol details by ID from mapping
 */
export function getSymbolDetails(
  symbolId: string,
  mapping: SymbolMapping
): { content: string; location: SymbolLocation } | null {
  for (const fileInfo of Object.values(mapping.files)) {
    const symbol = fileInfo.symbols.find(s => s.symbolId === symbolId);
    if (symbol) {
      const fullPath = path.join(mapping.rootPath, symbol.filePath);
      const fileContent = fs.readFileSync(fullPath, 'utf-8');
      const lines = fileContent.split('\n');
      const symbolContent = lines
        .slice(symbol.startLine - 1, symbol.endLine)
        .join('\n');

      return {
        content: symbolContent,
        location: symbol,
      };
    }
  }
  return null;
}

/**
 * Save mapping to JSON file
 */
export function saveMappingToFile(mapping: SymbolMapping, outputPath: string): void {
  fs.writeFileSync(outputPath, JSON.stringify(mapping, null, 2), 'utf-8');
}

/**
 * Load mapping from JSON file
 */
export function loadMappingFromFile(mappingPath: string): SymbolMapping {
  const content = fs.readFileSync(mappingPath, 'utf-8');
  return JSON.parse(content);
}
