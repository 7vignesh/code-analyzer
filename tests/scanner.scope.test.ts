import * as path from 'path';
import { scanRocketChatFiles } from '../src/scanner';
import { ROCKET_CHAT_SCOPE_CONFIG } from '../src/rocket-chat-scope';

const rootDir = path.join(__dirname, 'fixtures/rocket-chat-test-repo');

describe('scanRocketChatFiles', () => {
  it('should include only allowed module files', () => {
    const files = scanRocketChatFiles(rootDir);
    expect(files.length).toBeGreaterThan(0);

    const allowedModulePaths = ROCKET_CHAT_SCOPE_CONFIG.modules.map(
      (m) => path.join(rootDir, 'apps/meteor', m.relativePath)
    );

    files.forEach((file) => {
      let isAllowed = false;
      allowedModulePaths.forEach(allowedPath => {
        if (file.startsWith(allowedPath)) {
          isAllowed = true;
        }
      });
      expect(isAllowed).toBe(true);
    });
  });

  it('should handle moduleKeys filter correctly', () => {
    const moduleKeys = ['lib-server-functions'];
    const files = scanRocketChatFiles(rootDir, moduleKeys);

    expect(files.length).toBeGreaterThan(0);

    files.forEach((file) => {
      expect(file.startsWith(path.join(rootDir, 'apps/meteor/app/lib/server/functions'))).toBe(true);
    });
  });

  it('should return empty array on invalid root if no files are found', () => {
    const invalidRoot = path.join(__dirname, 'fixtures'); // This directory doesn't contain a valid Rocket.Chat project
    const files = scanRocketChatFiles(invalidRoot);
    expect(files).toEqual([]);
  });

  it('should exclude files from non-allowed folders', () => {
    // Assuming you have a non-allowed folder under apps/meteor in your test repo
    const files = scanRocketChatFiles(rootDir);
    const excludedDir = path.join(rootDir, 'apps/meteor/non-allowed-folder');

    files.forEach((file) => {
      expect(file.startsWith(excludedDir)).toBe(false);
    });
  });
});