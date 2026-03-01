/**
 * Simple tokenizer for counting approximate tokens in code
 */

/**
 * Count approximate tokens in a string by splitting on whitespace and punctuation
 * This is a simple heuristic for estimating token count
 */
export function countTokens(text: string): number {
  if (!text || text.trim().length === 0) {
    return 0;
  }

  // Split on whitespace, punctuation, and common code delimiters
  const tokens = text
    .split(/[\s\n\r\t.,;:!?(){}[\]<>'"/\\|`~@#$%^&*+=-]+/)
    .filter(token => token.length > 0);

  return tokens.length;
}
