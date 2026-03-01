# Quick Start Guide

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

## Running the CLI

After building, you can use the CLI in several ways:

### 1. Using npm script
```bash
npm start -- --question "authentication logic"
```

### 2. Using the built binary directly
```bash
node dist/cli.js --question "authentication logic"
```

### 3. Installing globally (optional)
```bash
npm link
rc-skel --question "authentication logic"
```

## Example Commands

```bash
# Analyze current directory
rc-skel --question "database models"

# Analyze specific directory
rc-skel --root ../my-project --question "API endpoints"

# Limit to top 5 files
rc-skel --question "error handling" --limit 5

# Complex question
rc-skel --question "user authentication and session management" --limit 10
```

## Using as a Library

Create a file `example.ts`:

```typescript
import { analyzeProject } from './src/index';

async function main() {
  const result = await analyzeProject({
    root: '.',
    question: 'authentication logic',
    limit: 5
  });

  console.log(JSON.stringify(result, null, 2));
  
  // Access individual files
  for (const file of result.files) {
    console.log(`\n${file.path} (score: ${file.score})`);
    console.log(`Reduced from ${file.originalTokenCount} to ${file.skeletonTokenCount} tokens`);
  }
}

main();
```

Then run:
```bash
npm run build
node dist/example.js
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage
```

## Development Workflow

```bash
# 1. Make changes to src/ files
# 2. Build
npm run build

# 3. Test
npm test

# 4. Lint
npm run lint

# 5. Try the CLI
npm start -- --question "your question"
```

## Troubleshooting

### "Cannot find module"
Make sure you've run `npm run build` before trying to use the CLI.

### "No TypeScript files found"
- Check that you're running the command in a directory with `.ts` or `.tsx` files
- Use `--root` to specify a different directory
- Make sure the directory isn't in the ignored list (node_modules, dist, etc.)

### Tests failing
- Ensure all dependencies are installed: `npm install`
- Clear any cached builds: `rm -rf dist/`
- Rebuild: `npm run build`

## Next Steps

1. Try analyzing your own TypeScript projects
2. Experiment with different questions to see how ranking works
3. Use the library in your own tools
4. Integrate with LLM CLI tools like `gemini-cli` for optimized context

## Example Output

See `example-output.json` for a sample of what the tool produces.
