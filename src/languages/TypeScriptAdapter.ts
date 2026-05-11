import { Project, SourceFile } from 'ts-morph';
import * as path from 'path';
import type { SymbolLineRange } from '../types';
import { LanguageAdapter, SkeletonResult, Symbol } from './LanguageAdapter';

export class TypeScriptAdapter implements LanguageAdapter {
  name = 'typescript';
  extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

  canHandle(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.extensions.includes(ext);
  }

  generateSkeleton(content: string, filePath: string, rootDir?: string): SkeletonResult {
    try {
      const sourceFile = this.createSourceFile(content, filePath);
      const lineRanges: SymbolLineRange[] = [];
      const skeleton = this.generateSkeletonFromSourceFile(
        sourceFile,
        filePath,
        rootDir,
        lineRanges,
      );
      return { skeleton, lineRanges };
    } catch (error) {
      return {
        skeleton: `/* Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'} */`,
        lineRanges: [],
      };
    }
  }

  extractSymbols(content: string): Symbol[] {
    try {
      const sourceFile = this.createSourceFile(content, 'memory.ts');
      const symbols: Symbol[] = [];

      for (const cls of sourceFile.getClasses()) {
        symbols.push({
          name: cls.getName() || 'Anonymous',
          kind: 'class',
          line: cls.getStartLineNumber(),
        });
      }

      for (const func of sourceFile.getFunctions()) {
        symbols.push({
          name: func.getName() || 'anonymous',
          kind: 'function',
          line: func.getStartLineNumber(),
        });
      }

      for (const iface of sourceFile.getInterfaces()) {
        symbols.push({
          name: iface.getName(),
          kind: 'interface',
          line: iface.getStartLineNumber(),
        });
      }

      for (const typeAlias of sourceFile.getTypeAliases()) {
        symbols.push({
          name: typeAlias.getName(),
          kind: 'type',
          line: typeAlias.getStartLineNumber(),
        });
      }

      for (const varStmt of sourceFile.getVariableStatements()) {
        for (const decl of varStmt.getDeclarations()) {
          symbols.push({
            name: decl.getName(),
            kind: 'variable',
            line: decl.getStartLineNumber(),
          });
        }
      }

      const exported = new Set<string>();
      sourceFile.getExportedDeclarations().forEach((_, name) => exported.add(name));
      for (const name of exported) {
        symbols.push({ name, kind: 'export', line: 1 });
      }

      return symbols;
    } catch {
      return [];
    }
  }

  extractImports(content: string): string[] {
    try {
      const sourceFile = this.createSourceFile(content, 'memory.ts');
      return sourceFile.getImportDeclarations().map((imp) => imp.getModuleSpecifierValue());
    } catch {
      return [];
    }
  }

  private createSourceFile(content: string, filePath: string): SourceFile {
    const project = new Project({
      useInMemoryFileSystem: true,
      skipAddingFilesFromTsConfig: true,
      compilerOptions: {
        allowJs: true,
        checkJs: false,
      },
    });
    return project.createSourceFile(filePath, content, { overwrite: true });
  }

  private relPathForComment(filePath: string, rootDir: string | undefined): string {
    if (rootDir) {
      const rel = path.relative(rootDir, path.resolve(filePath)).split(path.sep).join('/');
      return rel || path.basename(filePath);
    }
    return path.basename(filePath);
  }

  private annotatedLine(
    filePath: string,
    rootDir: string | undefined,
    start: number,
    end: number,
    indentSpaces: number,
  ): string {
    const rel = this.relPathForComment(filePath, rootDir);
    const span = start === end ? `${rel}:${start}` : `${rel}:${start}-${end}`;
    return `${' '.repeat(indentSpaces)}// ${span}`;
  }

  private recordRange(
    lineRanges: SymbolLineRange[],
    symbol: string,
    start: number,
    end: number,
  ): void {
    lineRanges.push({ symbol, start, end });
  }

  private generateSkeletonFromSourceFile(
    sourceFile: SourceFile,
    filePath: string,
    rootDir: string | undefined,
    lineRanges: SymbolLineRange[],
  ): string {
    const lines: string[] = [];
    lines.push(`/* Skeleton of ${path.basename(sourceFile.getFilePath())} */\n`);

    const imports = sourceFile.getImportDeclarations();
    for (const imp of imports) {
      lines.push(imp.getText());
    }

    if (imports.length > 0) {
      lines.push('');
    }

    const exportDeclarations = sourceFile.getExportDeclarations();
    const exportAssignments = sourceFile.getExportAssignments();

    const classes = sourceFile.getClasses();
    for (const cls of classes) {
      lines.push(this.processClass(cls, filePath, rootDir, lineRanges));
      lines.push('');
    }

    const interfaces = sourceFile.getInterfaces();
    for (const iface of interfaces) {
      const nm = iface.getName();
      const s = iface.getStartLineNumber();
      const e = iface.getEndLineNumber();
      this.recordRange(lineRanges, `interface ${nm}`, s, e);
      lines.push(this.annotatedLine(filePath, rootDir, s, e, 0));
      lines.push(iface.getText());
      lines.push('');
    }

    const typeAliases = sourceFile.getTypeAliases();
    for (const typeAlias of typeAliases) {
      const nm = typeAlias.getName();
      const s = typeAlias.getStartLineNumber();
      const e = typeAlias.getEndLineNumber();
      this.recordRange(lineRanges, `type ${nm}`, s, e);
      lines.push(this.annotatedLine(filePath, rootDir, s, e, 0));
      lines.push(typeAlias.getText());
      lines.push('');
    }

    const enums = sourceFile.getEnums();
    for (const enumDecl of enums) {
      const nm = enumDecl.getName();
      const s = enumDecl.getStartLineNumber();
      const e = enumDecl.getEndLineNumber();
      this.recordRange(lineRanges, `enum ${nm}`, s, e);
      lines.push(this.annotatedLine(filePath, rootDir, s, e, 0));
      lines.push(enumDecl.getText());
      lines.push('');
    }

    const functions = sourceFile.getFunctions();
    for (const func of functions) {
      lines.push(this.processFunction(func, filePath, rootDir, lineRanges));
      lines.push('');
    }

    const variables = sourceFile.getVariableStatements();
    for (const varStatement of variables) {
      lines.push(this.processVariableStatement(varStatement, filePath, rootDir, lineRanges));
      lines.push('');
    }

    for (const exportDecl of exportDeclarations) {
      lines.push(exportDecl.getText());
    }

    for (const exportAssign of exportAssignments) {
      lines.push(exportAssign.getText());
    }

    return lines.join('\n').trim();
  }

  private processClass(
    cls: any,
    filePath: string,
    rootDir: string | undefined,
    lineRanges: SymbolLineRange[],
  ): string {
    const lines: string[] = [];
    const className = cls.getName() || 'Anonymous';
    const classStart = cls.getStartLineNumber();
    const classEnd = cls.getEndLineNumber();
    this.recordRange(lineRanges, `class ${className}`, classStart, classEnd);

    const jsDoc = cls.getJsDocs();
    if (jsDoc.length > 0) {
      lines.push(jsDoc[0].getText());
    }

    lines.push(this.annotatedLine(filePath, rootDir, classStart, classEnd, 0));

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

    if (properties.length > 0) {
      lines.push('');
    }

    const methods = cls.getMethods();
    for (const method of methods) {
      lines.push(this.processMethod(method, filePath, rootDir, lineRanges, className));
    }

    const constructors = cls.getConstructors();
    for (const ctor of constructors) {
      lines.push(this.processConstructor(ctor, filePath, rootDir, lineRanges, className));
    }

    lines.push('}');
    return lines.join('\n');
  }

  private processMethod(
    method: any,
    filePath: string,
    rootDir: string | undefined,
    lineRanges: SymbolLineRange[],
    className: string,
  ): string {
    const lines: string[] = [];
    const name = method.getName();
    const ms = method.getStartLineNumber();
    const me = method.getEndLineNumber();
    this.recordRange(lineRanges, `${className}.${name}`, ms, me);

    const jsDoc = method.getJsDocs();
    if (jsDoc.length > 0) {
      lines.push('  ' + jsDoc[0].getText().split('\n').join('\n  '));
    }

    lines.push(this.annotatedLine(filePath, rootDir, ms, me, 2));

    const modifiers = method.getModifiers().map((m: any) => m.getText()).join(' ');
    const params = method.getParameters().map((p: any) => {
      const pName = p.getName();
      const pType = p.getType().getText();
      const optional = p.isOptional() ? '?' : '';
      return `${pName}${optional}: ${pType}`;
    }).join(', ');

    const returnType = method.getReturnType().getText();

    let signature = modifiers ? `  ${modifiers} ${name}` : `  ${name}`;
    signature += `(${params}): ${returnType} {`;
    lines.push(signature);
    lines.push('    /* trimmed */');
    lines.push('  }');
    lines.push('');

    return lines.join('\n');
  }

  private processConstructor(
    ctor: any,
    filePath: string,
    rootDir: string | undefined,
    lineRanges: SymbolLineRange[],
    className: string,
  ): string {
    const lines: string[] = [];
    const cs = ctor.getStartLineNumber();
    const ce = ctor.getEndLineNumber();
    this.recordRange(lineRanges, `${className}.constructor`, cs, ce);

    const jsDoc = ctor.getJsDocs();
    if (jsDoc.length > 0) {
      lines.push('  ' + jsDoc[0].getText().split('\n').join('\n  '));
    }

    lines.push(this.annotatedLine(filePath, rootDir, cs, ce, 2));

    const params = ctor.getParameters().map((p: any) => {
      const pModifiers = p.getModifiers().map((m: any) => m.getText()).join(' ');
      const pName = p.getName();
      const pType = p.getType().getText();
      const optional = p.isOptional() ? '?' : '';
      const paramStr = `${pName}${optional}: ${pType}`;
      return pModifiers ? `${pModifiers} ${paramStr}` : paramStr;
    }).join(', ');

    lines.push(`  constructor(${params}) {`);
    lines.push('    /* trimmed */');
    lines.push('  }');
    lines.push('');
    return lines.join('\n');
  }

  private processFunction(
    func: any,
    filePath: string,
    rootDir: string | undefined,
    lineRanges: SymbolLineRange[],
  ): string {
    const lines: string[] = [];
    const name = func.getName() || 'anonymous';
    const fs = func.getStartLineNumber();
    const fe = func.getEndLineNumber();
    this.recordRange(lineRanges, `function ${name}`, fs, fe);

    const jsDoc = func.getJsDocs();
    if (jsDoc.length > 0) {
      lines.push(jsDoc[0].getText());
    }

    lines.push(this.annotatedLine(filePath, rootDir, fs, fe, 0));

    const modifiers = func.getModifiers().map((m: any) => m.getText()).join(' ');
    const params = func.getParameters().map((p: any) => {
      const pName = p.getName();
      const pType = p.getType().getText();
      const optional = p.isOptional() ? '?' : '';
      return `${pName}${optional}: ${pType}`;
    }).join(', ');

    const returnType = func.getReturnType().getText();

    let signature = modifiers ? `${modifiers} function` : 'function';
    signature += ` ${name}(${params}): ${returnType} {`;
    lines.push(signature);
    lines.push('  /* trimmed */');
    lines.push('}');

    return lines.join('\n');
  }

  private processVariableStatement(
    varStatement: any,
    filePath: string,
    rootDir: string | undefined,
    lineRanges: SymbolLineRange[],
  ): string {
    const lines: string[] = [];
    const jsDoc = varStatement.getJsDocs();
    if (jsDoc.length > 0) {
      lines.push(jsDoc[0].getText());
    }

    const modifiers = varStatement.getModifiers().map((m: any) => m.getText()).join(' ');
    const declarations = varStatement.getDeclarations();
    const declarationKind = varStatement.getDeclarationKind();

    for (const decl of declarations) {
      const name = decl.getName();
      const ds = decl.getStartLineNumber();
      const de = decl.getEndLineNumber();
      this.recordRange(lineRanges, `${declarationKind} ${name}`, ds, de);
      lines.push(this.annotatedLine(filePath, rootDir, ds, de, 0));

      const type = decl.getType().getText();
      const initializer = decl.getInitializer();

      let value = '';
      if (initializer) {
        const initText = initializer.getText();
        if (initText.length < 50 && !initText.includes('{') && !initText.includes('=>')) {
          value = ` = ${initText}`;
        } else {
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
}
