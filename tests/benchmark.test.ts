import { ROCKET_CHAT_SCOPE_CONFIG } from '../src/rocket-chat-scope';
import { benchmarkProject } from '../src/benchmark';
import * as path from 'path';

describe('Benchmark Tests', () => {
  it('BENCHMARK_SCENARIOS module keys exist in scope config', () => {
    // Assuming BENCHMARK_SCENARIOS is defined in benchmark.ts
    const { BENCHMARK_SCENARIOS } = require('../src/benchmark');

    BENCHMARK_SCENARIOS.forEach((scenario: { moduleKey: string }) => {
      const moduleKeyExists = ROCKET_CHAT_SCOPE_CONFIG.modules.some(
        (module) => module.key === scenario.moduleKey
      );
      expect(moduleKeyExists).toBe(true);
    });
  });

  it('Scenario path resolution is deterministic and scoped', async () => {
    const rcMeteorRoot = path.join(__dirname, 'fixtures/rocket-chat-test-repo/apps/meteor');
    const moduleKey = 'lib-server-functions';

    // Execute benchmark project with a specific module key
    const benchmarkResult = await benchmarkProject(rcMeteorRoot, moduleKey, 'Test Project', 'send message');

    // Verify that the project root matches the expected module path
    const expectedPath = path.join(rcMeteorRoot, 'app/lib/server/functions');
    expect(benchmarkResult.projectRoot).toBe(expectedPath);
  });
});