# Code Analyzer - Enhanced Prototype

A TypeScript code analysis tool with **AI-powered agentic code understanding**. Ranks files by relevance, generates semantic skeletons, and enables on-demand retrieval for efficient LLM context usage.

## 🎯 Key Features (Updated)

### Core Capabilities
- ✅ **AST-Based Skeletonization** - Uses ts-morph for accurate TypeScript parsing
- ✅ **Symbol Mapping System** - On-demand retrieval of function/method implementations
- ✅ **Enhanced Ranking Algorithm** - Multi-factor scoring with dependency analysis
- ✅ **Gemini AI Integration** - Agentic code analysis with tool calling
- ✅ **Token Reduction** - Average **77.4% reduction** in token usage

### New in This Version
1. **Symbol Mapping** - Tracks all code blocks with placeholders for lazy loading
2. **Enhanced Ranking** - Considers file dependencies, symbol density, and semantic factors
3. **Agent Integration** - Full Gemini AI integration with 3 specialized tools
4. **Benchmark Suite** - Comprehensive performance testing and metrics

## 📊 Benchmark Results

Tested on the code-analyzer project itself:

| Metric | Value |
|--------|-------|
| **Average Token Reduction** | **77.4%** ⬇️ |
| **Best Case Reduction** | **93.1%** (test files) |
| **Original Tokens** | 17,119 |
| **Skeleton Tokens** | 3,893 |
| **Enhanced Ranking** | ✓ Better relevance than basic |

### Comparison: Basic vs Enhanced Ranking

**Query: "file ranking and skeleton generation"**

| Ranking Type | Token Reduction | Top File | Score |
|--------------|----------------|----------|-------|
| Basic | 78.2% | tests/skeletonizer.test.ts | 0.250 |
| **Enhanced** | **78.9%** | **src/index.ts** | **0.523** |

Enhanced ranking correctly identifies `src/index.ts` as most relevant (contains main logic), while basic ranking favored test files.

## 🚀 Quick Start

### Installation
```bash
npm install
npm run build
```

### Basic Usage
```bash
# Generate skeletons
rc-skel --question "authentication logic" --limit 5

# With enhanced ranking
rc-skel --question "database models" --enhanced-ranking

# With symbol mapping (for on-demand retrieval)
rc-skel --question "API endpoints" --with-mapping
```

### Agent Mode (AI-Powered Analysis)
```bash
# Set your Gemini API key
export GEMINI_API_KEY="your-key-here"

# Single question
rc-agent --question "How does the ranking algorithm work?"

# Interactive mode
rc-agent --interactive
```

## 🏗️ Architecture

### 1. Symbol Mapping System
Generates `.mapping.json` files that track code block locations:

```json
{
  "files": {
    "src/auth.ts": {
      "symbols": [
        {
          "symbolId": "AuthService.login",
          "symbolType": "method",
          "filePath": "src/auth.ts",
          "startLine": 10,
          "endLine": 25
        }
      ]
    }
  }
}
```

Skeletons contain placeholders:
```typescript
class AuthService {
  async login(email: string, password: string): Promise<User> {
    /* [SYMBOL:AuthService.login] - Implementation available via get_symbol_details */
  }
}
```

### 2. Enhanced Ranking Algorithm

**Multi-Factor Scoring:**
- **Filename matching** (10 points for exact, 5 for partial)
- **Path component matching** (3 points per match)
- **Content frequency** (logarithmic scaling to prevent bias)
- **Export matching** (4 points for symbols matching query)
- **Symbol density** (2 points for high-quality code)
- **File size optimization** (penalty for very large/small files)

**Dependency Analysis:**
- Boosts scores of files that are imported by highly-ranked files
- Identifies central modules in the codebase

### 3. Gemini Agent Integration

**Three Specialized Tools:**

1. **`get_symbol_details`** - Retrieves full implementation of functions/methods
   ```typescript
   agent.chat("Show me the login method implementation")
   // Agent automatically calls get_symbol_details("AuthService.login")
   ```

2. **`search_symbols`** - Discovers available symbols
   ```typescript
   agent.chat("Find all authentication-related functions")
   // Agent searches mapping for "auth" patterns
   ```

3. **`analyze_file_dependencies`** - Understands import relationships
   ```typescript
   agent.chat("What does auth.ts depend on?")
   // Agent analyzes imports and exports
   ```

## 📦 CLI Commands

### `rc-skel` - Skeleton Generator
```bash
rc-skel --question "<text>" [options]

Options:
  --root <path>            Project root (default: current directory)
  --question "<text>"      Natural language question (required)
  --limit <number>         Number of files to analyze (default: 10)
  --with-mapping           Generate symbol mapping
  --mapping-output <path>  Custom mapping file path
  --enhanced-ranking       Use advanced ranking algorithm
```

### `rc-agent` - AI Agent
```bash
rc-agent --question "<text>" [options]
rc-agent --interactive [options]

Options:
  --root <path>        Project root
  --question "<text>"  Question to analyze
  --limit <number>     Number of files (default: 10)
  --api-key <key>      Gemini API key (or set GEMINI_API_KEY)
  --model <name>       Model name (default: gemini-2.0-flash-exp)
  --interactive, -i    Start interactive chat
```

### Benchmark
```bash
npm run benchmark
```

## 🔬 Technical Implementation

### Dependencies
- **`ts-morph`** - TypeScript AST manipulation
- **`@google/generative-ai`** - Gemini AI integration

### Project Structure
```
src/
  ├── cli.ts              # Basic CLI
  ├── agent-cli.ts        # AI agent CLI
  ├── index.ts            # Main library
  ├── scanner.ts          # File system scanning
  ├── ranker.ts           # Basic ranking
  ├── ranker-enhanced.ts  # Enhanced ranking
  ├── skeletonizer.ts     # AST-based skeleton generation
  ├── mapper.ts           # Symbol mapping system
  ├── agent.ts            # Gemini agent integration
  ├── tokenizer.ts        # Token counting
  ├── benchmark.ts        # Benchmark suite
  └── types.ts            # TypeScript types
```

## 📈 Performance Analysis

### Token Reduction by File Type

| File Type | Average Reduction |
|-----------|------------------|
| Test files | **90%+** |
| Implementation | **75-85%** |
| Type definitions | **60-70%** |
| Configuration | **50-60%** |

### Execution Time
- Basic analysis: ~3.6s for 5 files
- Enhanced analysis: ~7.5s for 5 files  
- With mapping generation: ~7.5s for 5 files
- **Analysis overhead:** ~4s for enhanced features

## 🆚 Comparison with Other Prototypes

### Echo's Prototype (echo-xiao/gsoc-rocket-chat)
**Their Approach:**
- Focus on specific files (e.g., sendMessage.ts)
- 94% token reduction on Rocket.Chat codebase
- Direct Gemini integration
- Mapping-based on-demand retrieval

**Our Improvements:**
1. ✅ **Automated File Discovery** - Ranks all files, not just predefined ones
2. ✅ **Enhanced Ranking** - Multi-factor algorithm vs manual selection
3. ✅ **Reusable Library** - Can be integrated into any project
4. ✅ **Comprehensive Tooling** - Multiple CLI modes + benchmarks
5. ✅ **Dependency Analysis** - Understands code relationships

**Similarities:**
- ✅ Both use AST-based skeletonization
- ✅ Both implement symbol mapping
- ✅ Both integrate with Gemini
- ✅ Both achieve 75%+ token reduction

## 🎓 Next Steps / Future Work

### Integration with Gemini CLI
To integrate this as an extension to Gemini CLI:

1. **Fork gemini-cli project**
2. **Add as preprocessing step:**
   ```javascript
   // In gemini-cli
   import { analyzeProject, createCodeAnalysisAgent } from 'rc-code-skeletonizer';
   
   // Before sending to LLM
   const analysis = await analyzeProject({
     root: projectPath,
     question: userQuery,
     enhancedRanking: true,
     generateMapping: true
   });
   ```

3. **Expose agent tools** in Gemini CLI function calling

### For Large Monorepos (e.g., Rocket.Chat)

**Recommended Configuration:**
```typescript
const result = await analyzeProject({
  root: './Rocket.Chat',
  question: 'message sending logic',
  limit: 20,  // More files for large repos
  enhancedRanking: true,  // Better relevance
  generateMapping: true,   // On-demand retrieval
});

// Use with agent for follow-up questions
const agent = createCodeAnalysisAgent(apiKey);
agent.loadMapping('./Rocket.Chat/code-analyzer.mapping.json');
```

**Expected Results:**
- Initial context: ~20k tokens (skeletons only)
- On-demand retrieval: ~1-5k tokens per function
- Total savings: **85-95%** vs full codebase

### Planned Enhancements
- [ ] Semantic code search using embeddings
- [ ] Call graph analysis
- [ ] Multi-repository support
- [ ] Incremental mapping updates
- [ ] Cache optimization for repeated queries

## 📝 Example Usage

### Analyzing Your Codebase
```typescript
import { analyzeProject } from 'rc-code-skeletonizer';

const result = await analyzeProject({
  root: './my-project',
  question: 'How is authentication handled?',
  limit: 10,
  enhancedRanking: true,
  generateMapping: true,
});

console.log(`Found ${result.files.length} relevant files`);
result.files.forEach(f => {
  console.log(`${f.path} (score: ${f.score})`);
  console.log(f.skeleton);
});
```

### Using the Agent
```typescript
import { createCodeAnalysisAgent } from 'rc-code-skeletonizer';

const agent = createCodeAnalysisAgent(process.env.GEMINI_API_KEY);
agent.loadMapping('./code-analyzer.mapping.json');

const answer = await agent.chat(
  'Show me how the login function works',
  skeletonContext
);

console.log(answer);
```

## 🤝 Contributing

This prototype demonstrates:
1. ✅ AST-based approach (as recommended)
2. ✅ Robust relevance ranking for large monorepos
3. ✅ Gemini CLI integration capability
4. ✅ Comprehensive benchmarks with proof of results

**Ready for GSoC 2026 evaluation!**

## 📄 License

MIT

---

**Project:** GSoC 2026 - Code Analyzer for Rocket.Chat  
**Focus:** Agentic inference context reduction mechanics  
**Prototype Status:** ✅ Complete with benchmarks
