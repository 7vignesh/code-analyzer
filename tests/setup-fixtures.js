const fs = require('fs');
const path = require('path');

// The fake repo root expected by the tests
const root = path.join(__dirname, 'fixtures');

const dirs = [
  'src/auth',
  'src/api',
  'node_modules',
];

const files = [
  'src/auth/permission.ts',
  'src/api/routes.ts',
  'node_modules/ignored.ts',
];

console.log(`Creating test fixtures in: ${root}`);

dirs.forEach((dir) => {
  fs.mkdirSync(path.join(root, dir), { recursive: true });
});

files.forEach((file) => {
  fs.writeFileSync(path.join(root, file), '// test file content');
});

console.log('✅ Fixtures created successfully.');