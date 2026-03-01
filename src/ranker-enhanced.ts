/**
 * Enhanced file ranking with dependency analysis and semantic scoring
 */

import * as path from 'path';
import * as fs from 'fs';
import { readFileContent } from './scanner';
import { RankedFile } from './types';
import { Project, SourceFile } from 'ts-morph';

export interface EnhancedRankedFile extends RankedFile {
  reasons: string[];
  dependencies?: string[];
  symbolCount?: number;
  complexity?: number;
}

interface FileMetadata {
  imports: string[];
  exports: string[];
  symbolCount: number;
  linesOfCode: number;
}

/**
 * Enhanced relevance scoring with multiple factors
 */
export function calculateEnhancedScore(
  filePath: string,
  fileContent: string | null,
  question: string,
  metadata?: FileMetadata
): { score: number; reasons: string[] } {
  if (!fileContent) {
    return { score: 0, reasons: [] };
  }

  const reasons: string[] = [];
  const questionLower = question.toLowerCase();
  const questionWords = questionLower
    .split(/\s+/)
    .filter(word => word.length > 2);

  if (questionWords.length === 0) {
    return { score: 0.5, reasons: ['No meaningful keywords'] };
  }

  const fileName = path.basename(filePath, path.extname(filePath)).toLowerCase();
  const pathComponents = filePath.toLowerCase().split(path.sep);
  const contentLower = fileContent.toLowerCase();

  let score = 0;
  const weights = {
    filenameExact: 10,
    filenamePartial: 5,
    pathComponent: 3,
    contentFrequency: 2,
    exportMatch: 4,
    symbolDensity: 2,
    fileSize: 1,
  };

  // 1. Filename matching (highest priority)
  for (const word of questionWords) {
    if (fileName === word) {
      score += weights.filenameExact;
      reasons.push(`Exact filename match: "${word}"`);
    } else if (fileName.includes(word)) {
      score += weights.filenamePartial;
      reasons.push(`Filename contains: "${word}"`);
    }
  }

  // 2. Path component matching
  for (const word of questionWords) {
    const matchingComponents = pathComponents.filter(comp => comp.includes(word));
    if (matchingComponents.length > 0) {
      score += weights.pathComponent * matchingComponents.length;
      reasons.push(`Path contains: "${word}" (${matchingComponents.length} times)`);
    }
  }

  // 3. Content frequency analysis
  for (const word of questionWords) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = contentLower.match(regex) || [];
    const frequency = matches.length;
    
    if (frequency > 0) {
      // Logarithmic scaling to prevent over-weighting very common words
      const contentScore = Math.min(Math.log2(frequency + 1) * weights.contentFrequency, 10);
      score += contentScore;
      
      if (frequency > 5) {
        reasons.push(`High frequency of "${word}": ${frequency} occurrences`);
      } else if (frequency > 0) {
        reasons.push(`Contains "${word}": ${frequency} times`);
      }
    }
  }

  // 4. Export matching (if file exports symbols matching question)
  if (metadata?.exports) {
    for (const word of questionWords) {
      const matchingExports = metadata.exports.filter(exp => 
        exp.toLowerCase().includes(word)
      );
      if (matchingExports.length > 0) {
        score += weights.exportMatch * matchingExports.length;
        reasons.push(`Exports symbols matching "${word}": ${matchingExports.join(', ')}`);
      }
    }
  }

  // 5. Symbol density (files with more symbols are potentially more relevant)
  if (metadata?.symbolCount && metadata?.linesOfCode) {
    const density = metadata.symbolCount / (metadata.linesOfCode / 100);
    if (density > 1) {
      score += Math.min(density * weights.symbolDensity, 5);
      reasons.push(`High symbol density: ${density.toFixed(1)} symbols per 100 LOC`);
    }
  }

  // 6. File size penalty (very large or very small files are less likely to be relevant)
  if (metadata?.linesOfCode) {
    const loc = metadata.linesOfCode;
    if (loc > 50 && loc < 500) {
      score += weights.fileSize;
      reasons.push('Optimal file size');
    } else if (loc >= 500) {
      score -= 1;
      reasons.push('Large file - may need refinement');
    }
  }

  // Normalize score to 0-1 range
  const maxPossibleScore = questionWords.length * 
    (weights.filenameExact + weights.pathComponent + 10); // Approximate max
  const normalizedScore = Math.min(score / maxPossibleScore, 1);

  return { score: normalizedScore, reasons };
}

/**
 * Extract file metadata using AST analysis
 */
export function extractFileMetadata(filePath: string): FileMetadata | null {
  try {
    const content = readFileContent(filePath);
    if (!content) return null;

    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      compilerOptions: {
        allowJs: true,
        checkJs: false,
      },
    });

    const sourceFile = project.addSourceFileAtPath(filePath);

    // Extract imports
    const imports = sourceFile.getImportDeclarations()
      .map(imp => imp.getModuleSpecifierValue());

    // Extract exports
    const exports: string[] = [];
    
    // Named exports
    sourceFile.getExportDeclarations().forEach(exp => {
      exp.getNamedExports().forEach(named => {
        exports.push(named.getName());
      });
    });

    // Exported functions
    sourceFile.getFunctions().forEach(func => {
      if (func.isExported()) {
        exports.push(func.getName() || 'anonymous');
      }
    });

    // Exported classes
    sourceFile.getClasses().forEach(cls => {
      if (cls.isExported()) {
        exports.push(cls.getName() || 'anonymous');
      }
    });

    // Exported variables
    sourceFile.getVariableStatements().forEach(varStmt => {
      if (varStmt.isExported()) {
        varStmt.getDeclarations().forEach(decl => {
          exports.push(decl.getName());
        });
      }
    });

    // Count symbols
    const symbolCount = 
      sourceFile.getFunctions().length +
      sourceFile.getClasses().length +
      sourceFile.getInterfaces().length +
      sourceFile.getTypeAliases().length +
      sourceFile.getEnums().length;

    // Lines of code
    const linesOfCode = sourceFile.getEndLineNumber();

    return {
      imports,
      exports,
      symbolCount,
      linesOfCode,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Analyze file dependencies to boost scores of dependent files
 */
export function analyzeDependencyGraph(
  filePaths: string[],
  rootPath: string
): Map<string, string[]> {
  const dependencyMap = new Map<string, string[]>();

  for (const filePath of filePaths) {
    try {
      const content = readFileContent(filePath);
      if (!content) continue;

      const dependencies: string[] = [];
      const importRegex = /import\s+(?:{[^}]*}|[^;]+)\s+from\s+['"]([^'"]+)['"]/g;
      let match;

      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        
        // Resolve relative imports
        if (importPath.startsWith('.')) {
          const resolvedPath = path.resolve(path.dirname(filePath), importPath);
          const relativePath = path.relative(rootPath, resolvedPath);
          dependencies.push(relativePath);
        } else {
          dependencies.push(importPath);
        }
      }

      const key = path.relative(rootPath, filePath);
      dependencyMap.set(key, dependencies);
    } catch (error) {
      continue;
    }
  }

  return dependencyMap;
}

/**
 * Enhanced ranking with dependency analysis
 */
export function rankFilesEnhanced(
  filePaths: string[],
  question: string,
  limit: number = 10,
  rootPath?: string
): EnhancedRankedFile[] {
  const resolvedRoot = rootPath || process.cwd();
  const rankedFiles: EnhancedRankedFile[] = [];

  // First pass: Calculate base scores with metadata
  for (const filePath of filePaths) {
    const content = readFileContent(filePath);
    const metadata = extractFileMetadata(filePath);
    const { score, reasons } = calculateEnhancedScore(filePath, content, question, metadata || undefined);

    rankedFiles.push({
      path: filePath,
      score,
      reasons,
      symbolCount: metadata?.symbolCount,
      dependencies: metadata?.imports,
    });
  }

  // Second pass: Boost scores based on dependencies
  const dependencyMap = analyzeDependencyGraph(filePaths, resolvedRoot);
  
  for (const file of rankedFiles) {
    const relativePath = path.relative(resolvedRoot, file.path);
    const deps = dependencyMap.get(relativePath) || [];
    
    // Boost score if this file is imported by highly-ranked files
    let dependencyBoost = 0;
    for (const otherFile of rankedFiles) {
      const otherRelPath = path.relative(resolvedRoot, otherFile.path);
      const otherDeps = dependencyMap.get(otherRelPath) || [];
      
      if (otherDeps.some(dep => dep.includes(path.basename(relativePath, '.ts')))) {
        dependencyBoost += otherFile.score * 0.1;
      }
    }

    if (dependencyBoost > 0) {
      file.score += dependencyBoost;
      file.reasons.push(`Imported by ${Math.round(dependencyBoost * 100)} highly relevant files`);
    }
  }

  // Sort by score descending
  rankedFiles.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.path.localeCompare(b.path);
  });

  return rankedFiles.slice(0, limit);
}
