/**
 * File ranking based on relevance to a question
 */

import * as path from 'path';
import { readFileContent } from './scanner';
import { RankedFile } from './types';
import {
  buildWhyString,
  collectKeywordMatches,
  pathModuleMatchesQuery,
  questionTerms,
} from './why';

/**
 * Simple keyword-based relevance scoring
 * Returns a score between 0 and 1
 */
export function calculateRelevanceScore(
  filePath: string,
  fileContent: string | null,
  question: string
): number {
  if (!fileContent) {
    return 0;
  }

  const questionLower = question.toLowerCase();
  const questionWords = questionLower
    .split(/\s+/)
    .filter(word => word.length > 2); // Ignore very short words

  if (questionWords.length === 0) {
    return 0.5; // Neutral score if no meaningful words
  }

  // Extract filename and path components
  const fileName = path.basename(filePath, path.extname(filePath)).toLowerCase();
  const pathComponents = filePath.toLowerCase().split(path.sep);
  const contentLower = fileContent.toLowerCase();

  let score = 0;
  let maxScore = 0;

  for (const word of questionWords) {
    maxScore += 10; // Max points per word

    // Filename match (highest weight)
    if (fileName.includes(word)) {
      score += 5;
    }

    // Path component match (medium weight)
    if (pathComponents.some(component => component.includes(word))) {
      score += 3;
    }

    // Content match (lower weight, but counted)
    const contentMatches = (contentLower.match(new RegExp(word, 'g')) || []).length;
    // Cap content matches contribution
    score += Math.min(contentMatches * 0.1, 2);
  }

  // Normalize to 0-1 range
  return maxScore > 0 ? Math.min(score / maxScore, 1) : 0;
}

/**
 * Rank files by relevance to the question
 */
export function rankFiles(
  filePaths: string[],
  question: string,
  limit: number = 10
): RankedFile[] {
  const rankedFiles: RankedFile[] = [];

  const terms = questionTerms(question);

  for (const filePath of filePaths) {
    const content = readFileContent(filePath);
    const score = calculateRelevanceScore(filePath, content, question);
    const keywordsMatched = collectKeywordMatches(filePath, content, terms);
    const moduleMatch = pathModuleMatchesQuery(filePath, terms);

    rankedFiles.push({
      path: filePath,
      score,
      why: buildWhyString({
        lexicalScore: score,
        structuralScore: 0,
        depScore: 0,
        keywordsMatched,
        isDirectImport: false,
        moduleMatch,
      }),
    });
  }

  // Sort by score descending, then by path alphabetically
  rankedFiles.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.path.localeCompare(b.path);
  });

  // Return top N files
  return rankedFiles.slice(0, limit);
}
