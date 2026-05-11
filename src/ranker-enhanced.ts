/**
 * Enhanced file ranking with dependency analysis and semantic scoring
 */

import * as path from 'path';
import { readFileContent } from './scanner';
import { RankedFile } from './types';
import { getAdapter } from './languages/registry';
import { buildWhyString } from './why';

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

interface HybridScoreBreakdown {
  lexical: number;
  enhanced: number;
  structural: number;
  dependency: number;
  rerank: number;
}

interface PreRankRecord {
  file: EnhancedRankedFile;
  metadata: FileMetadata | null;
  content: string;
  baseScore: number;
  lexicalScore: number;
  structuralScore: number;
  keywordsMatched: string[];
  moduleMatch: boolean;
  directImportByPeer: boolean;
  normalizedDepScore: number;
}

function splitIdentifierTokens(input: string): string[] {
  return input
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .map(token => token.toLowerCase())
    .filter(token => token.length > 2);
}

function expandQueryTerms(question: string): string[] {
  const baseTerms = splitIdentifierTokens(question);
  const expansions: Record<string, string[]> = {
    auth: ['authentication', 'authorize', 'permission', 'access'],
    authentication: ['auth', 'login', 'permission', 'session'],
    permission: ['authorization', 'role', 'policy', 'access'],
    message: ['messages', 'chat', 'room', 'send'],
    upload: ['file', 'media', 'attachment', 'storage'],
    endpoint: ['route', 'api', 'controller', 'handler'],
    encryption: ['crypto', 'key', 'cipher', 'secure'],
  };

  const out = new Set<string>(baseTerms);
  for (const term of baseTerms) {
    const aliases = expansions[term];
    if (!aliases) continue;
    for (const alias of aliases) {
      out.add(alias);
    }
  }
  return Array.from(out);
}

function normalizeToUnit(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) {
    return values.map(() => 0.5);
  }
  return values.map(value => (value - min) / (max - min));
}

function calculateLexicalScore(filePath: string, fileContent: string, terms: string[]): number {
  if (terms.length === 0) return 0.5;

  const pathTokens = splitIdentifierTokens(filePath);
  const contentTokens = splitIdentifierTokens(fileContent);

  let raw = 0;
  for (const term of terms) {
    const pathMatches = pathTokens.filter(token => token.includes(term)).length;
    const contentMatches = contentTokens.filter(token => token === term).length;

    if (pathMatches > 0) {
      raw += Math.min(pathMatches * 2, 6);
    }

    if (contentMatches > 0) {
      raw += Math.min(Math.sqrt(contentMatches), 4);
    }
  }

  return Math.min(raw / (terms.length * 5), 1);
}

function calculateStructuralScore(
  filePath: string,
  question: string,
  metadata: FileMetadata | null,
  terms: string[]
): number {
  if (!metadata) return 0;

  let score = 0;
  const q = question.toLowerCase();

  const exportHits = metadata.exports.filter(exp =>
    terms.some(term => exp.toLowerCase().includes(term))
  ).length;
  score += Math.min(exportHits * 0.2, 0.5);

  const importHits = metadata.imports.filter(imp =>
    terms.some(term => imp.toLowerCase().includes(term))
  ).length;
  score += Math.min(importHits * 0.05, 0.2);

  const density = metadata.linesOfCode > 0
    ? metadata.symbolCount / Math.max(metadata.linesOfCode / 100, 1)
    : 0;
  score += Math.min(density * 0.05, 0.2);

  if ((q.includes('where') || q.includes('entry') || q.includes('flow')) && filePath.includes('index')) {
    score += 0.1;
  }
  if ((q.includes('permission') || q.includes('auth')) && filePath.includes('auth')) {
    score += 0.15;
  }
  if ((q.includes('message') || q.includes('send')) && (filePath.includes('message') || filePath.includes('room'))) {
    score += 0.15;
  }

  return Math.min(score, 1);
}

function calculateCrossRerankScore(filePath: string, content: string, question: string, terms: string[]): number {
  const q = question.toLowerCase();
  const contentLower = content.toLowerCase();
  const pathLower = filePath.toLowerCase();

  let score = 0;
  for (const term of terms) {
    if (pathLower.includes(term)) {
      score += 0.1;
    }
    const termRegex = new RegExp(`\\b${term}\\b`, 'g');
    const occurrences = (contentLower.match(termRegex) || []).length;
    if (occurrences > 0) {
      score += Math.min(occurrences * 0.03, 0.2);
    }
  }

  // Phrase and intent matches get a strong rerank boost.
  if (contentLower.includes(q) || pathLower.includes(q)) {
    score += 0.25;
  }

  const hasVerbIntent = /(how|where|why|send|check|validate|authorize|upload)/.test(q);
  if (hasVerbIntent && /(function|class|return|export)/.test(contentLower)) {
    score += 0.1;
  }

  return Math.min(score, 1);
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
    const adapter = getAdapter(filePath);
    const symbols = adapter.extractSymbols(content);
    const imports = adapter.extractImports(content);
    const exports = symbols.filter((symbol) => symbol.kind === 'export').map((symbol) => symbol.name);
    const symbolCount = symbols.filter((symbol) => symbol.kind !== 'export').length;
    const linesOfCode = content.split('\n').length;

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
      const importRegex = /(?:import\s+(?:{[^}]*}|[^;]+)\s+from\s+['"]([^'"]+)['"]|from\s+([A-Za-z0-9_./-]+)\s+import|import\s+([A-Za-z0-9_.,\s]+))/g;
      let match;

      while ((match = importRegex.exec(content)) !== null) {
        const importPath = (match[1] || match[2] || match[3]?.split(',')[0]?.trim() || '').trim();
        if (!importPath) {
          continue;
        }
        
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
  const expandedTerms = expandQueryTerms(question);
  const records: PreRankRecord[] = [];

  // First pass: collect raw component scores.
  for (const filePath of filePaths) {
    const content = readFileContent(filePath) || '';
    const metadata = extractFileMetadata(filePath);
    const enhancedScore = calculateEnhancedScore(filePath, content, question, metadata || undefined);
    const lexicalScore = calculateLexicalScore(filePath, content, expandedTerms);
    const structuralScore = calculateStructuralScore(filePath, question, metadata, expandedTerms);
    const reasons = [...enhancedScore.reasons];

    const baseScore = (
      lexicalScore * 0.5 +
      enhancedScore.score * 0.3 +
      structuralScore * 0.2
    );

    const relForModule = path.relative(resolvedRoot, filePath).toLowerCase();
    const pathParts = relForModule.split(/[/\\]/);
    const keywordsMatched = expandedTerms.filter(
      (term) =>
        filePath.toLowerCase().includes(term) || content.toLowerCase().includes(term),
    );
    const seenKw = new Set<string>();
    const uniqueKeywords: string[] = [];
    for (const k of keywordsMatched) {
      if (!seenKw.has(k)) {
        seenKw.add(k);
        uniqueKeywords.push(k);
      }
    }

    const moduleMatch = expandedTerms.some((term) =>
      pathParts.some(
        (segment) =>
          segment === term ||
          segment.startsWith(`${term}.`) ||
          segment.includes(term),
      ),
    );

    records.push({
      file: {
        path: filePath,
        score: 0,
        reasons,
        symbolCount: metadata?.symbolCount,
        dependencies: metadata?.imports,
        why: '',
      },
      metadata,
      content,
      baseScore,
      lexicalScore,
      structuralScore,
      keywordsMatched: uniqueKeywords,
      moduleMatch,
      directImportByPeer: false,
      normalizedDepScore: 0,
    });
  }

  if (records.length === 0) {
    return [];
  }

  // Second pass: dependency-aware score contribution.
  const dependencyMap = analyzeDependencyGraph(filePaths, resolvedRoot);
  const dependencyScores: number[] = [];

  for (const record of records) {
    const relativePath = path.relative(resolvedRoot, record.file.path);
    let dependencyBoost = 0;
    let directImportByPeer = false;

    for (const otherRecord of records) {
      if (otherRecord.file.path === record.file.path) continue;
      const otherRelPath = path.relative(resolvedRoot, otherRecord.file.path);
      const otherDeps = dependencyMap.get(otherRelPath) || [];
      if (otherDeps.some(dep => dep.includes(path.parse(relativePath).name))) {
        dependencyBoost += Math.max(otherRecord.baseScore, 0) * 0.15;
        directImportByPeer = true;
      }
    }

    record.directImportByPeer = directImportByPeer;
    dependencyScores.push(dependencyBoost);
  }

  const normalizedDependencyScores = normalizeToUnit(dependencyScores);

  // Third pass: normalize and combine hybrid components.
  const normalizedBaseScores = normalizeToUnit(records.map(record => record.baseScore));
  records.forEach((record, index) => {
    const combined = normalizedBaseScores[index] * 0.85 + normalizedDependencyScores[index] * 0.15;
    record.file.score = combined;
    record.normalizedDepScore = normalizedDependencyScores[index];

    if (normalizedDependencyScores[index] > 0.2) {
      record.file.reasons.push(`Dependency centrality boost: ${(normalizedDependencyScores[index] * 100).toFixed(0)}%`);
    }
  });

  // Fourth pass: cross-rerank on top candidates.
  records.sort((a, b) => b.file.score - a.file.score || a.file.path.localeCompare(b.file.path));
  const rerankWindow = Math.min(records.length, Math.max(limit * 4, 20));
  const topRecords = records.slice(0, rerankWindow);
  for (const record of topRecords) {
    const rerank = calculateCrossRerankScore(record.file.path, record.content, question, expandedTerms);
    record.file.score = Math.min(record.file.score * 0.75 + rerank * 0.25, 1);
    if (rerank > 0.2) {
      record.file.reasons.push(`Cross-rerank relevance: ${(rerank * 100).toFixed(0)}%`);
    }
  }

  // Sort by score descending
  records.sort((a, b) => {
    if (b.file.score !== a.file.score) {
      return b.file.score - a.file.score;
    }
    return a.file.path.localeCompare(b.file.path);
  });

  const top = records.slice(0, limit);
  for (const record of top) {
    record.file.why = buildWhyString({
      lexicalScore: record.lexicalScore,
      structuralScore: record.structuralScore,
      depScore: record.normalizedDepScore,
      keywordsMatched: record.keywordsMatched,
      isDirectImport: record.directImportByPeer,
      moduleMatch: record.moduleMatch,
    });
  }

  return top.map((record) => record.file);
}
