# rc-code-skeletonizer

A TypeScript code analysis tool that ranks files by relevance to a natural language question and generates semantic skeletons (type signatures without implementations).

## Features

- 🔍 **Smart File Ranking**: Ranks TypeScript files based on relevance to your question
- 📝 **Semantic Skeletons**: Extracts structure (classes, interfaces, function signatures) without implementation details
- 🎯 **Token Counting**: Compares original vs skeleton token counts to show compression
- 📦 **Library + CLI**: Use as a command-line tool or integrate into your own code
- ⚡ **Fast & Simple**: Uses keyword-based ranking (no external API calls)

## Installation

```bash
npm install
npm run build
```

## Usage

### CLI

```bash
# Basic usage
rc-skel --question "authentication logic"

# Specify project root and limit
rc-skel --root ./my-project --question "database models" --limit 5

# Get help
rc-skel --help
```

### Library

```typescript
import { analyzeProject } from 'rc-code-skeletonizer';

const result = await analyzeProject({
  root: './my-project',
  question: 'authentication and user management',
  limit: 10
});

console.log(JSON.stringify(result, null, 2));
```

### Advanced Usage

```typescript
import { 
  scanTypeScriptFiles, 
  rankFiles, 
  buildSkeletonForFile 
} from 'rc-code-skeletonizer';

// Scan for TypeScript files
const files = scanTypeScriptFiles('./src');

// Rank by relevance
const ranked = rankFiles(files, 'payment processing', 5);

// Generate skeleton for a specific file
const skeleton = buildSkeletonForFile('./src/payment.ts');
```

## Output Format

The tool outputs JSON with the following structure:

```json
{
  "question": "authentication logic",
  "root": "/home/user/my-project",
  "limit": 10,
  "files": [
    {
      "path": "src/auth/AuthService.ts",
      "score": 0.87,
      "skeleton": "/* Skeleton of AuthService.ts */\n\nimport { User } from '../models/User';\n\nexport class AuthService {\n  async login(email: string, password: string): Promise<User> {\n    /* trimmed */\n  }\n\n  async logout(userId: string): Promise<void> {\n    /* trimmed */\n  }\n}",
      "originalTokenCount": 1234,
      "skeletonTokenCount": 210
    }
  ]
}
```

## What is a "Skeleton"?

A skeleton includes:

- ✅ Import/export statements
- ✅ Class, interface, and type declarations
- ✅ Function/method signatures (names, parameters, return types)
- ✅ JSDoc comments
- ✅ Property declarations

But removes:

- ❌ Function/method bodies
- ❌ Complex initializers
- ❌ Implementation details

This gives you a high-level overview of the code structure without the noise of implementation.

## Ranking Algorithm

The ranking uses a simple keyword-based scoring system:

1. **Filename match** (highest weight): Question words found in the filename
2. **Path component match** (medium weight): Question words in directory names
3. **Content match** (lower weight): Question words in file content

Scores are normalized to 0-1 range and files are sorted by relevance.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint

# Run CLI in development
npm start -- --question "your question here"
```

## Project Structure

```
rc-code-skeletonizer/
├── src/
│   ├── index.ts         # Library exports
│   ├── cli.ts           # CLI entry point
│   ├── types.ts         # Type definitions
│   ├── scanner.ts       # File scanning
│   ├── ranker.ts        # Relevance ranking
│   ├── skeletonizer.ts  # Skeleton generation
│   └── tokenizer.ts     # Token counting
├── tests/
│   ├── ranker.test.ts
│   └── skeletonizer.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Use Cases

### 1. Code Review Preparation
Quickly understand which files are relevant to a feature or bug fix.

### 2. Documentation Generation
Extract API signatures for documentation without implementation noise.

### 3. LLM Context Optimization
Generate compact code summaries to fit more context into LLM prompts (like with `gemini-cli`).

### 4. Codebase Exploration
Explore unfamiliar codebases by asking questions and seeing relevant structure.

## Future Enhancements

- [ ] Semantic search using embeddings
- [ ] AST-based similarity scoring
- [ ] Support for JavaScript files
- [ ] Configuration file support
- [ ] Cache for faster repeated queries
- [ ] Integration with popular LLM CLIs

## License

MIT

## Contributing

Contributions welcome! Please feel free to submit a Pull Request.
