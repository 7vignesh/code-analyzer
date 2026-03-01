/**
 * Tests for file ranking functionality
 */

import { calculateRelevanceScore, rankFiles } from '../src/ranker';

describe('calculateRelevanceScore', () => {
  it('should return 0 for null content', () => {
    const score = calculateRelevanceScore('/path/to/file.ts', null, 'test question');
    expect(score).toBe(0);
  });

  it('should return higher score for filename matches', () => {
    const filePath = '/src/authentication/auth-service.ts';
    const content = 'export class Service {}';
    const score = calculateRelevanceScore(filePath, content, 'authentication');
    expect(score).toBeGreaterThanOrEqual(0.3);
  });

  it('should return higher score for content matches', () => {
    const filePath = '/src/service.ts';
    const content = `
      export class AuthService {
        async login() { }
        async logout() { }
        authenticate() { }
      }
    `;
    const score = calculateRelevanceScore(filePath, content, 'authentication login');
    expect(score).toBeGreaterThan(0);
  });

  it('should return neutral score for empty question', () => {
    const score = calculateRelevanceScore('/path/to/file.ts', 'content', '');
    expect(score).toBe(0.5);
  });

  it('should handle multiple word questions', () => {
    const filePath = '/src/user/profile.ts';
    const content = 'export class UserProfile {}';
    const score = calculateRelevanceScore(filePath, content, 'user profile settings');
    expect(score).toBeGreaterThan(0);
  });
});

describe('rankFiles', () => {
  it('should return empty array for no files', () => {
    const ranked = rankFiles([], 'test question', 10);
    expect(ranked).toEqual([]);
  });

  it('should limit results to requested number', () => {
    // Create mock files - note: rankFiles reads from filesystem
    // For a real test, we'd need actual files, but this tests the logic
    const files = [
      '/test/auth.ts',
      '/test/user.ts',
      '/test/service.ts',
    ];

    // Mock would be needed here for a full test
    // This is a placeholder to show the structure
    const ranked = rankFiles(files, 'test', 2);
    expect(ranked.length).toBeLessThanOrEqual(2);
  });

  it('should sort by score descending', () => {
    const files = ['/test/file1.ts', '/test/file2.ts'];
    const ranked = rankFiles(files, 'test', 10);

    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });
});
