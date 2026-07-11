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

## Blast Radius

Analyze the downstream impact and risk of a code change. Given a git diff,
blast-radius identifies which files are affected, how central they are in the
dependency graph, and whether they have test coverage.

**Limitation (v1):** Traversal is computed at file granularity — "file A
imports file B" — not at function-call level. Function-level resolution is
planned for a future version.

### CLI

```bash
# Analyze working tree changes vs HEAD (default)
skannr blast-radius --root .

# Analyze a specific diff file, 3 hops deep
skannr blast-radius --root . --diff changes.patch --hops 3

# JSON output for CI pipelines
skannr blast-radius --root . --json
```

Sample terminal output:

```
  Blast Radius Analysis (2-hop traversal)
  ──────────────────────────────────────────────────

  Risk Score: 5.8/10
  Risk 5.8/10 (moderate): 1 file(s) changed, 4 downstream affected, 3 untested.

  Changed files:
    src/auth/session.ts

  Changed symbols:
    function validateToken (src/auth/session.ts)

  Hop 1 (2 files):
    src/middleware/auth-guard.ts  centrality=0.85 [NO TEST]
    src/api/login.ts              centrality=0.60

  Hop 2 (2 files):
    src/routes/index.ts           centrality=0.45 [NO TEST]
    src/api/admin.ts              centrality=0.30 [NO TEST]

  Formula inputs:
    affected_count (normalized): 0.080
    avg_centrality:              0.550
    untested_ratio:              0.750
    hop_spread (normalized):     1.000
```

### MCP

The `blast_radius` tool is exposed via the same MCP server (`skannr --mcp`).

Input schema:

```json
{
  "root": "/path/to/repo",
  "diff": "<optional unified diff content>",
  "hops": 2
}
```

If `diff` is omitted, the tool runs `git diff HEAD` in the given root.
The output is the same JSON structure as `skannr blast-radius --json`.

### Risk Score Formula

```
risk = 2.5 × normalizedAffectedCount
     + 2.5 × avgCentrality
     + 3.5 × untestedRatio
     + 1.5 × normalizedMaxHopSpread
```

| Input | Range | Meaning |
|-------|-------|---------|
| normalizedAffectedCount | 0–1 | Affected files / total project files |
| avgCentrality | 0–1 | Mean in-degree centrality of affected files |
| untestedRatio | 0–1 | Fraction of affected files with no test file |
| normalizedMaxHopSpread | 0–1 | Deepest hop reached / max configured hops |