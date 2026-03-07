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

You can run the tool using `npm run cli`.

### Basic Example

```bash
npm run cli -- --question "how are messages sent?"
```

### Using Modules (Recommended)

To get better results, tell the tool which part of Rocket.Chat to look at:

```bash
npm run cli -- --question "permission checks" --modules authorization
```

**Available Modules:**
*   `lib-server-functions`
*   `authorization`
*   `e2e`
*   `file-upload`

### All Options

*   `--question`: (Required) The question you want to answer.
*   `--root`: The folder to scan (default: current folder).
*   `--limit`: How many files to return (default: 10).
*   `--modules`: Comma-separated list of modules to filter by.
*   `--with-mapping`: Creates a map of symbols to find definitions later.


### Install

```bash
npm install
npm run build
```

### Run Tests

```bash
npm test
```