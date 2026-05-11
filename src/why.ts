/**
 * Human-readable explanations for why a file ranked as it did.
 */

export interface WhySignals {
  lexicalScore: number;
  structuralScore: number;
  depScore: number;
  keywordsMatched: string[];
  isDirectImport: boolean;
  moduleMatch: boolean;
}

export function buildWhyString(signals: WhySignals): string {
  const reasons: string[] = [];

  if (signals.keywordsMatched.length > 0) {
    reasons.push(
      `keyword match: ${signals.keywordsMatched.slice(0, 3).join(', ')}`,
    );
  }
  if (signals.isDirectImport) {
    reasons.push('directly imported by a matched file');
  }
  if (signals.depScore > 0.5) {
    reasons.push('high import-graph centrality');
  }
  if (signals.structuralScore > 0.5) {
    reasons.push('dense exports/symbols');
  }
  if (signals.moduleMatch) {
    reasons.push('module name matches query');
  }
  if (reasons.length === 0) {
    reasons.push('cross-rerank phrase match');
  }

  return reasons.join(' · ');
}

export function questionTerms(question: string, minLen = 2): string[] {
  return question
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > minLen);
}

export function collectKeywordMatches(
  filePath: string,
  content: string | null,
  terms: string[],
): string[] {
  if (!content || terms.length === 0) {
    return [];
  }
  const pathLower = filePath.toLowerCase();
  const contentLower = content.toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const term of terms) {
    if (pathLower.includes(term) || contentLower.includes(term)) {
      if (!seen.has(term)) {
        seen.add(term);
        out.push(term);
      }
    }
  }
  return out;
}

export function pathModuleMatchesQuery(
  filePath: string,
  terms: string[],
): boolean {
  if (terms.length === 0) {
    return false;
  }
  const parts = filePath.toLowerCase().split(/[/\\]/);
  return terms.some(
    (term) =>
      parts.some(
        (segment) =>
          segment === term ||
          segment.startsWith(`${term}.`) ||
          segment.includes(term),
      ),
  );
}
