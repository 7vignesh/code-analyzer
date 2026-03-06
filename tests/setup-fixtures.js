const fs = require('fs');
const path = require('path');

// The fake repo root expected by the tests
const root = path.join(__dirname, 'fixtures', 'rocket-chat-test-repo');

const dirs = [
  // Valid Rocket.Chat structure
  'apps/meteor/.meteor',
  'apps/meteor/app/lib/server/functions',
  'apps/meteor/app/authorization',
  // Invalid folder for testing exclusions
  'apps/meteor/non-allowed-folder',
];

const files = [
  'apps/meteor/app/lib/server/functions/test.ts',
  'apps/meteor/app/authorization/permission.ts',
  'apps/meteor/non-allowed-folder/ignored.ts',
];

console.log(`Creating test fixtures in: ${root}`);

dirs.forEach((dir) => {
  fs.mkdirSync(path.join(root, dir), { recursive: true });
});

files.forEach((file) => {
  fs.writeFileSync(path.join(root, file), '// test file content');
});

console.log('✅ Fixtures created successfully.');