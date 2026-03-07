# Project Summary: Rocket.Chat Code Analyzer

## Overview
A specialized tool designed to help AI agents understand the Rocket.Chat codebase without exceeding context window limits. It intelligently scans, ranks, and compresses TypeScript files into "skeletons", allowing for efficient analysis of the large monorepo.

## Key Features

### 1. Rocket.Chat Optimization
*   **Context-Aware**: Specifically tuned for the `apps/meteor` structure.
*   **Module Scoping**: Can focus on specific domains like `authorization` or `file-upload` to reduce noise.
*   **Smart Filtering**: Automatically ignores build artifacts, tests (unless requested), and irrelevant directories.

### 2. Performance
*   **Token Reduction**: Achieves **~96.5%** reduction compared to reading full modules.
*   **Speed**: Analyzes and ranks files in **~1.2 seconds**.
*   **Accuracy**: Uses enhanced ranking to find the most relevant files for a query.

## Benchmark Results

Tested against the Rocket.Chat `apps/meteor` codebase:

| Scenario | Query | Token Reduction |
|----------|-------|-----------------|
| **Messaging** | "send message to room" | 97.3% |
| **Auth** | "user permissions" | 96.1% |
| **E2E** | "encryption keys" | 95.8% |
| **Uploads** | "file upload handling" | 96.8% |

## Usage

The tool is available as a CLI:

```bash
# Analyze specific module
npm run cli -- --question "permissions" --modules authorization

# Run benchmarks
npm run benchmark
```

## Conclusion
This tool effectively solves the "context window problem" for Rocket.Chat development, allowing AI agents to provide accurate, code-grounded answers efficiently by focusing only on the relevant structural information.