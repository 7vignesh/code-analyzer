# Rocket.Chat Code Analyzer

This tool helps AI agents understand the Rocket.Chat codebase. It scans TypeScript files and creates compressed "skeletons" (summaries) of the code. This allows you to analyze large parts of the application without using too many tokens.

## Features

*   **Smart Scanning**: Finds relevant files based on your question.
*   **Skeleton Generation**: Removes function bodies to save space, keeping only structure and types.
*   **Module Scoping**: Can focus on specific Rocket.Chat modules to reduce noise.

## Test & Benchmark Results

### Tests
*   **Status**: ✅ Passing (Core scanner, Scope enforcement, Benchmarks)

### Benchmarks
Tested on Rocket.Chat (`apps/meteor`) with real-world queries (Messaging, Auth, E2E):

| Metric | Result |
|--------|--------|
| **Token Reduction (vs Full Scan)** | **~96.5%** |
| **Token Reduction (vs Top-N)** | **~78.2%** |
| **Average Execution Time** | **~1.2s** |

## Usage

### Option 1: CLI (Direct Usage)

You can run the tool using `npm run cli`.

#### Basic Example

```bash
npm run cli -- --question "how are messages sent?"
```

#### Using Modules (Recommended)

To get better results, tell the tool which part of Rocket.Chat to look at:

```bash
npm run cli -- --question "permission checks" --modules authorization
```

**Available Modules:**
*   `lib-server-functions`
*   `authorization`
*   `e2e`
*   `file-upload`

#### All Options

*   `--question`: (Required) The question you want to answer.
*   `--root`: The folder to scan (default: current folder).
*   `--limit`: How many files to return (default: 10).
*   `--modules`: Comma-separated list of modules to filter by.
*   `--with-mapping`: Creates a map of symbols to find definitions later.

### Option 2: Gemini CLI Integration (MCP Server)

Use this tool as an MCP (Model Context Protocol) server with Gemini CLI for AI-powered code analysis and benchmarking.

#### Setup

1. **Build the extension:**
   ```bash
   npm run build
   cd gemini-extension && npm install && npm run build
   ```

2. **Configure Gemini CLI:**
   
   Create or update `~/.gemini/config.json`:
   ```json
   {
     "mcpServers": {
       "rc-code-analyzer": {
         "command": "node",
         "args": ["/path/to/code-analyzer/gemini-extension/dist/server.js"]
       }
     }
   }
   ```

3. **Run Gemini CLI:**
   ```bash
   cd /path/to/code-analyzer
   gemini
   ```

#### Example Queries with Gemini CLI

```
How are messages sent in Rocket.Chat?
How does user authentication work?
How are permissions checked?
What is the E2E encryption flow?
```

Gemini CLI will automatically use the `scan_codebase` tool to analyze relevant files and provide insights with token savings metrics.

#### Benefits

- **AI-Powered Analysis**: Gemini CLI provides context-aware insights and suggestions.
- **Token Efficiency**: Skeletons reduce token usage by ~96.5% vs full scans.
- **Easy Integration**: Works seamlessly with Gemini CLI's MCP protocol.
- **Benchmarking**: Track token stats and performance across queries.


### Install

```bash
npm install
npm run build
```

For Gemini CLI integration:
```bash
cd gemini-extension
npm install
npm run build
```

### Testing

#### Run Tests

```bash
npm test
```

#### Test MCP Server (Optional)

To verify the Gemini CLI extension works correctly:

```bash
npm run build && node test-gemini-server.mjs
```

This tests tool discovery and the `scan_codebase` tool without requiring Gemini CLI.