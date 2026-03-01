/**
 * Skeleton generation using ts-morph
 */

import { Project, SourceFile } from 'ts-morph';
import * as path from 'path';

/**
 * Build a skeleton for a TypeScript file
 * Keeps structure but removes function/method bodies
 */
export function buildSkeletonForFile(filePath: string): string {
  try {
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      compilerOptions: {
        allowJs: true,
        checkJs: false,
      },
    });

    const sourceFile = project.addSourceFileAtPath(filePath);
    return generateSkeleton(sourceFile);
  } catch (error) {
    // If parsing fails, return an error comment
    return `/* Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'} */`;
  }
}

/**
 * Generate skeleton from a source file
 */
function generateSkeleton(sourceFile: SourceFile): string {
  const lines: string[] = [];

  // Add a header comment
  lines.push(`/* Skeleton of ${path.basename(sourceFile.getFilePath())} */\n`);

  // Get all imports
  const imports = sourceFile.getImportDeclarations();
  for (const imp of imports) {
    lines.push(imp.getText());
  }

  if (imports.length > 0) {
    lines.push('');
  }

  // Get all exports (including export declarations)
  const exportDeclarations = sourceFile.getExportDeclarations();
  const exportAssignments = sourceFile.getExportAssignments();

  // Process classes
  const classes = sourceFile.getClasses();
  for (const cls of classes) {
    lines.push(processClass(cls));
    lines.push('');
  }

  // Process interfaces
  const interfaces = sourceFile.getInterfaces();
  for (const iface of interfaces) {
    lines.push(iface.getText()); // Interfaces don't have bodies to remove
    lines.push('');
  }

  // Process type aliases
  const typeAliases = sourceFile.getTypeAliases();
  for (const typeAlias of typeAliases) {
    lines.push(typeAlias.getText());
    lines.push('');
  }

  // Process enums
  const enums = sourceFile.getEnums();
  for (const enumDecl of enums) {
    lines.push(enumDecl.getText());
    lines.push('');
  }

  // Process top-level functions
  const functions = sourceFile.getFunctions();
  for (const func of functions) {
    lines.push(processFunction(func));
    lines.push('');
  }

  // Process top-level variables (exported constants, etc.)
  const variables = sourceFile.getVariableStatements();
  for (const varStatement of variables) {
    lines.push(processVariableStatement(varStatement));
    lines.push('');
  }

  // Add export declarations at the end
  for (const exportDecl of exportDeclarations) {
    lines.push(exportDecl.getText());
  }

  for (const exportAssign of exportAssignments) {
    lines.push(exportAssign.getText());
  }

  return lines.join('\n').trim();
}

/**
 * Process a class declaration to keep structure but remove method bodies
 */
function processClass(cls: any): string {
  const lines: string[] = [];

  // Get modifiers (export, abstract, etc.)
  const modifiers = cls
    .getModifiers()
    .map((m: any) => m.getText())
    .join(' ');

  // Start class declaration
  let classDecl = modifiers ? `${modifiers} class` : 'class';
  classDecl += ` ${cls.getName() || 'Anonymous'}`;

  // Type parameters
  const typeParams = cls.getTypeParameters();
  if (typeParams.length > 0) {
    classDecl += `<${typeParams.map((tp: any) => tp.getText()).join(', ')}>`;
  }

  // Extends clause
  const extendsClause = cls.getExtends();
  if (extendsClause) {
    classDecl += ` extends ${extendsClause.getText()}`;
  }

  // Implements clause
  const implementsClauses = cls.getImplements();
  if (implementsClauses.length > 0) {
    classDecl += ` implements ${implementsClauses.map((ic: any) => ic.getText()).join(', ')}`;
  }

  classDecl += ' {';
  lines.push(classDecl);

  // JSDoc comment for the class
  const jsDoc = cls.getJsDocs();
  if (jsDoc.length > 0) {
    lines.splice(0, 0, jsDoc[0].getText());
  }

  // Properties
  const properties = cls.getProperties();
  for (const prop of properties) {
    const propModifiers = prop
      .getModifiers()
      .map((m: any) => m.getText())
      .join(' ');
    const propName = prop.getName();
    const propType = prop.getType().getText();
    const propLine = propModifiers
      ? `  ${propModifiers} ${propName}: ${propType};`
      : `  ${propName}: ${propType};`;
    lines.push(propLine);
  }

  if (properties.length > 0) {
    lines.push('');
  }

  // Methods
  const methods = cls.getMethods();
  for (const method of methods) {
    const methodLines = processMethod(method);
    lines.push(methodLines);
  }

  // Constructor
  const constructors = cls.getConstructors();
  for (const ctor of constructors) {
    const ctorLines = processConstructor(ctor);
    lines.push(ctorLines);
  }

  lines.push('}');

  return lines.join('\n');
}

/**
 * Process a method to keep signature but remove body
 */
function processMethod(method: any): string {
  const lines: string[] = [];

  // JSDoc
  const jsDoc = method.getJsDocs();
  if (jsDoc.length > 0) {
    lines.push('  ' + jsDoc[0].getText().split('\n').join('\n  '));
  }

  const modifiers = method
    .getModifiers()
    .map((m: any) => m.getText())
    .join(' ');

  const name = method.getName();
  const params = method
    .getParameters()
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
  lines.push('    /* trimmed */');
  lines.push('  }');
  lines.push('');

  return lines.join('\n');
}

/**
 * Process a constructor
 */
function processConstructor(ctor: any): string {
  const lines: string[] = [];

  // JSDoc
  const jsDoc = ctor.getJsDocs();
  if (jsDoc.length > 0) {
    lines.push('  ' + jsDoc[0].getText().split('\n').join('\n  '));
  }

  const params = ctor
    .getParameters()
    .map((p: any) => {
      const modifiers = p
        .getModifiers()
        .map((m: any) => m.getText())
        .join(' ');
      const pName = p.getName();
      const pType = p.getType().getText();
      const optional = p.isOptional() ? '?' : '';
      const paramStr = `${pName}${optional}: ${pType}`;
      return modifiers ? `${modifiers} ${paramStr}` : paramStr;
    })
    .join(', ');

  lines.push(`  constructor(${params}) {`);
  lines.push('    /* trimmed */');
  lines.push('  }');
  lines.push('');

  return lines.join('\n');
}

/**
 * Process a function declaration
 */
function processFunction(func: any): string {
  const lines: string[] = [];

  // JSDoc
  const jsDoc = func.getJsDocs();
  if (jsDoc.length > 0) {
    lines.push(jsDoc[0].getText());
  }

  const modifiers = func
    .getModifiers()
    .map((m: any) => m.getText())
    .join(' ');

  const name = func.getName();
  const params = func
    .getParameters()
    .map((p: any) => {
      const pName = p.getName();
      const pType = p.getType().getText();
      const optional = p.isOptional() ? '?' : '';
      return `${pName}${optional}: ${pType}`;
    })
    .join(', ');

  const returnType = func.getReturnType().getText();

  let signature = modifiers ? `${modifiers} function` : 'function';
  signature += ` ${name}(${params}): ${returnType} {`;
  lines.push(signature);
  lines.push('  /* trimmed */');
  lines.push('}');

  return lines.join('\n');
}

/**
 * Process variable statements (const, let, var)
 */
function processVariableStatement(varStatement: any): string {
  const lines: string[] = [];

  // JSDoc
  const jsDoc = varStatement.getJsDocs();
  if (jsDoc.length > 0) {
    lines.push(jsDoc[0].getText());
  }

  const modifiers = varStatement
    .getModifiers()
    .map((m: any) => m.getText())
    .join(' ');

  const declarations = varStatement.getDeclarations();
  const declarationKind = varStatement.getDeclarationKind();

  for (const decl of declarations) {
    const name = decl.getName();
    const type = decl.getType().getText();
    const initializer = decl.getInitializer();

    // For simple values, keep them; for complex ones, stub
    let value = '';
    if (initializer) {
      const initText = initializer.getText();
      // If it's a simple literal or short expression, keep it
      if (initText.length < 50 && !initText.includes('{') && !initText.includes('=>')) {
        value = ` = ${initText}`;
      } else {
        // For complex initializers (objects, functions), stub it
        value = ' = /* trimmed */';
      }
    }

    const line = modifiers
      ? `${modifiers} ${declarationKind} ${name}: ${type}${value};`
      : `${declarationKind} ${name}: ${type}${value};`;
    lines.push(line);
  }

  return lines.join('\n');
}
