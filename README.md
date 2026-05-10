# Skannr

A CLI tool and MCP server that helps AI agents understand **any codebase**.
It scans files, generates compressed structural "skeletons", and ranks results
using hybrid retrieval — reducing token usage by ~96% vs full file scans.

## How It Works

1. You point it at any repo with `--root /path/to/repo`
2. It auto-detects the language (TypeScript, JavaScript, Python, or generic fallback)
3. It auto-discovers your project's modules from the folder structure
4. For your question, it ranks the most relevant files using lexical + structural + dependency-graph analysis
5. It strips function bodies from files (keeping types, signatures, imports)
6. Returns compact skeletons an AI can reason over without blowing the context window

## Install

```bash
npm install -g skannr
```

## Usage

### CLI

```bash
# Basic
skannr --question "how does authentication work?" --root /path/to/any/repo

# Limit results
skannr --question "database connection setup" --root . --limit 5

# Focus on specific modules (auto-discovered if not specified)
skannr --question "permission checks" --root . --modules auth,middleware

# Force language
skannr --question "class structure" --root /path/to/python/project --lang python

# Interactive agent mode
skannr-agent --root /path/to/repo

# Cache management
skannr --cache-stats
skannr --cache-clear
skannr --question "..." --skip-cache
```

### MCP Server (use with Gemini CLI, Claude Code, Cursor, etc.)

```json
{
  "mcpServers": {
    "skannr": {
      "command": "npx",
      "args": ["skannr"]
    }
  }
}
```

### Config File (optional)

Drop a `code-analyzer.config.json` in your repo root:

```json
{
  "modules": {
    "auth": ["src/auth", "lib/auth"],
    "api": ["src/api", "src/routes"]
  },
  "exclude": ["**/generated/**", "**/migrations/**"],
  "extensions": [".ts", ".js"],
  "defaultLimit": 10
}
```

## Supported Languages

| Language | Skeleton Support |
|---|---|
| TypeScript / TSX | Full AST (ts-morph) |
| JavaScript / JSX | Full AST (ts-morph) |
| Python | Regex-based (signatures + types) |
| Others | First 50 lines (generic fallback) |

## Performance

Benchmarked on large TypeScript monorepo:

| Metric | Result |
|---|---|
| Token Reduction vs Full Scan | ~96.5% |
| Token Reduction vs Top-N | ~78.2% |
| Avg keyword coverage | ~75% |
| Directory diversity (top-5) | ~80% |
| Average execution time | ~1.2s |

## Interactive Agent Commands

```
/help              Show all commands
/files             List retrieved files
/symbols <query>   Search for symbols
/symbol <id>       Get full implementation
/deps <file>       Show imports for a file
/refresh           Re-analyze with new context
/stats             Show mapping statistics
/exit              Quit
```