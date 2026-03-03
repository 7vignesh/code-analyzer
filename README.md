# rc-code-skeletonizer

**An AI-powered TypeScript code analysis tool** that ranks files by relevance and generates semantic skeletons with on-demand symbol retrieval for efficient LLM context usage.

## 🌟 What's New (v0.2.0)

- ✨ **Symbol Mapping System** - On-demand retrieval of function implementations
- 🧠 **Enhanced Ranking** - Multi-factor scoring with dependency analysis  
- 🤖 **Gemini AI Integration** - Agentic code analysis with 3 specialized tools
- 📊 **Benchmark Suite** - Tested on Rocket.Chat monorepo: **avg 81.5% token reduction**, **~99.5% vs full-scan**

## Features

- 🔍 **Smart File Ranking**: Advanced multi-factor relevance scoring
- 📝 **Semantic Skeletons**: Extracts structure without implementation details
- 🧩 **Symbol Mapping**: Enables lazy loading of specific code blocks
- 🎯 **Token Reduction**: **81.5% avg** (vs module scan) / **99.5%** vs naive full-scan on Rocket.Chat
- 🤖 **AI Agent Mode**: Interactive code analysis with Gemini
- 📦 **Library + CLI**: Use standalone or integrate into your workflow
- ⚡ **Fast & Accurate**: AST-based analysis with ts-morph

## Installation

```bash
npm install
npm run build
```

## 📊 Benchmark Results (Rocket.Chat Monorepo)

Run directly on the **Rocket.Chat `apps/meteor`** codebase — same repo as other GSoC contributors:

| Query | Module | Files scanned | Full-scan tokens | Skeleton tokens | Reduction |
|-------|--------|:---:|---:|---:|:---:|
| send message to room | lib/server/functions | 63 | 15,861 | **1,599** | **89.9% ⬇️** |
| user permissions & access | authorization | 22 | 4,886 | **719** | **85.3% ⬇️** |
| E2E encryption keys | e2e | 21 | 8,795 | **2,116** | **75.9% ⬇️** |
| file upload & media | file-upload | 21 | 7,276 | **1,832** | **74.8% ⬇️** |

**Key facts:**
- `sendMessage.ts` ranked **#1 (score 0.828)** for the send-message query
- Full `app/` naive baseline: **1,105 files → ~298,770 tokens** (matches Echo's 299,820)
- Our tool per-query: **~1,567 skeleton tokens = ~99.5% reduction vs full scan**

```bash
npm run benchmark   # reproduce these numbers
```

See [IMPLEMENTATION.md](IMPLEMENTATION.md) for methodology and full data.

## Usage

### CLI

**Basic Skeleton Generation:**
```bash
# Basic usage
rc-skel --question "authentication logic"

# With enhanced ranking
rc-skel --question "database models" --enhanced-ranking

# With symbol mapping (on-demand retrieval)
rc-skel --question "API endpoints" --with-mapping

# Specify project root and limit
rc-skel --root ./my-project --question "database models" --limit 5

# Get help
rc-skel --help
```

**AI Agent Mode:**
```bash
# Set API key
export GEMINI_API_KEY="your-key-here"

# Single question
rc-agent --question "How does authentication work?"

# Interactive chat mode
rc-agent --interactive

# Get help
rc-agent --help
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
