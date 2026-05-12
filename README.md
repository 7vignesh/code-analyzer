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

# Output: human (default), markdown, or json
skannr --question "..." --root . --format markdown
skannr --question "..." --root . --format json

# Repository health report (JSON on stdout)
skannr --report --root .

# Re-run analysis when files change (debounced; uses fresh analysis each pass)
skannr --question "..." --root . --watch
```

### Watch mode (`--watch`)

Use `--watch` when you want Skannr to stay running and **re-analyze after relevant file changes** (large repos you edit often). Changes under common build/vendor dirs are ignored (`node_modules`, `.git`, `dist`, etc.). Press **Ctrl+C** to stop.

Each run bypasses the analysis cache so results reflect the tree as it is now.

### Anonymous telemetry (opt-in)

Telemetry is **off unless you enable it** (or accept deferred opt-in — see below). It sends **only which CLI flags were used** — never your question text, file paths, or code.

- Enable: `skannr --telemetry-on`
- Disable: `skannr --telemetry-off`

Settings are stored under `~/.skannr/config.json`. The first time you run an analyze command with no config yet, Skannr may show a short notice; you can opt in or out anytime with the flags above.

If you take no action, telemetry may turn on automatically **after 7 days** from that notice unless you explicitly disabled it with `--telemetry-off`.

## MCP Server

`skannr` ships with a built-in MCP server. One-time setup per AI tool:

### Cursor

`~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "skannr": {
      "command": "npx",
      "args": ["-y", "skannr", "--mcp"]
    }
  }
}
```

### Claude Desktop / Claude Code

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "skannr": {
      "command": "npx",
      "args": ["-y", "skannr", "--mcp"]
    }
  }
}
```

### Gemini CLI

`~/.gemini/config.json`:

```json
{
  "mcpServers": {
    "skannr": {
      "command": "npx",
      "args": ["-y", "skannr", "--mcp"]
    }
  }
}
```

Alternatively run the dedicated binary: `skannr-mcp` (same stdio server).

## Config File (optional)

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