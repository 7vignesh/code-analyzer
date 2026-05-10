import { Project, SourceFile } from 'ts-morph';
import * as path from 'path';
import { LanguageAdapter, Symbol } from './LanguageAdapter';

export class TypeScriptAdapter implements LanguageAdapter {
  name = 'typescript';
  extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

  canHandle(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.extensions.includes(ext);
  }

  generateSkeleton(content: string, filePath: string): string {
    try {
      const sourceFile = this.createSourceFile(content, filePath);
      return this.generateSkeletonFromSourceFile(sourceFile);
    } catch (error) {
      return `/* Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'} */`;
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

  private generateSkeletonFromSourceFile(sourceFile: SourceFile): string {
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
      lines.push(this.processClass(cls));
      lines.push('');
    }

    const interfaces = sourceFile.getInterfaces();
    for (const iface of interfaces) {
      lines.push(iface.getText());
      lines.push('');
    }

    const typeAliases = sourceFile.getTypeAliases();
    for (const typeAlias of typeAliases) {
      lines.push(typeAlias.getText());
      lines.push('');
    }

    const enums = sourceFile.getEnums();
    for (const enumDecl of enums) {
      lines.push(enumDecl.getText());
      lines.push('');
    }

    const functions = sourceFile.getFunctions();
    for (const func of functions) {
      lines.push(this.processFunction(func));
      lines.push('');
    }

    const variables = sourceFile.getVariableStatements();
    for (const varStatement of variables) {
      lines.push(this.processVariableStatement(varStatement));
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

  private processClass(cls: any): string {
    const lines: string[] = [];

    const modifiers = cls.getModifiers().map((m: any) => m.getText()).join(' ');
    let classDecl = modifiers ? `${modifiers} class` : 'class';
    classDecl += ` ${cls.getName() || 'Anonymous'}`;

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

    const jsDoc = cls.getJsDocs();
    if (jsDoc.length > 0) {
      lines.splice(0, 0, jsDoc[0].getText());
    }

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
      lines.push(this.processMethod(method));
    }

    const constructors = cls.getConstructors();
    for (const ctor of constructors) {
      lines.push(this.processConstructor(ctor));
    }

    lines.push('}');
    return lines.join('\n');
  }

  private processMethod(method: any): string {
    const lines: string[] = [];
    const jsDoc = method.getJsDocs();
    if (jsDoc.length > 0) {
      lines.push('  ' + jsDoc[0].getText().split('\n').join('\n  '));
    }

    const modifiers = method.getModifiers().map((m: any) => m.getText()).join(' ');
    const name = method.getName();
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

  private processConstructor(ctor: any): string {
    const lines: string[] = [];

    const jsDoc = ctor.getJsDocs();
    if (jsDoc.length > 0) {
      lines.push('  ' + jsDoc[0].getText().split('\n').join('\n  '));
    }

    const params = ctor.getParameters().map((p: any) => {
      const modifiers = p.getModifiers().map((m: any) => m.getText()).join(' ');
      const pName = p.getName();
      const pType = p.getType().getText();
      const optional = p.isOptional() ? '?' : '';
      const paramStr = `${pName}${optional}: ${pType}`;
      return modifiers ? `${modifiers} ${paramStr}` : paramStr;
    }).join(', ');

    lines.push(`  constructor(${params}) {`);
    lines.push('    /* trimmed */');
    lines.push('  }');
    lines.push('');
    return lines.join('\n');
  }

  private processFunction(func: any): string {
    const lines: string[] = [];
    const jsDoc = func.getJsDocs();
    if (jsDoc.length > 0) {
      lines.push(jsDoc[0].getText());
    }

    const modifiers = func.getModifiers().map((m: any) => m.getText()).join(' ');
    const name = func.getName();
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

  private processVariableStatement(varStatement: any): string {
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
