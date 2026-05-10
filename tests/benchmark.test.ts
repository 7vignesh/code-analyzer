import { benchmarkProject } from '../src/benchmark';
import * as path from 'path';

describe('Benchmark Tests', () => {
  it('BENCHMARK_SCENARIOS module keys are strings', () => {
    const { BENCHMARK_SCENARIOS } = require('../src/benchmark');
    BENCHMARK_SCENARIOS.forEach((scenario: { moduleKey: string }) => {
      expect(typeof scenario.moduleKey).toBe('string');
      expect(scenario.moduleKey.length).toBeGreaterThan(0);
    });
  });

  it('Scenario path resolution is deterministic and scoped', async () => {
    const fixtureRoot = path.join(__dirname, 'fixtures');
    const moduleKey = 'src';

    const benchmarkResult = await benchmarkProject(fixtureRoot, moduleKey, 'Test Project', 'authentication flow');

    const expectedPath = path.join(fixtureRoot, 'src');
    expect(benchmarkResult.projectRoot).toBe(expectedPath);

    expect(benchmarkResult.top1KeywordCoverage).toBeGreaterThanOrEqual(0);
    expect(benchmarkResult.top1KeywordCoverage).toBeLessThanOrEqual(1);
    expect(benchmarkResult.avgTopKKeywordCoverage).toBeGreaterThanOrEqual(0);
    expect(benchmarkResult.avgTopKKeywordCoverage).toBeLessThanOrEqual(1);
    expect(benchmarkResult.pathIntentMatchRate).toBeGreaterThanOrEqual(0);
    expect(benchmarkResult.pathIntentMatchRate).toBeLessThanOrEqual(1);
    expect(benchmarkResult.directoryDiversity).toBeGreaterThanOrEqual(0);
    expect(benchmarkResult.directoryDiversity).toBeLessThanOrEqual(1);
  });
});