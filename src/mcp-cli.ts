#!/usr/bin/env node

import { startMcpServer } from './mcp-server';

void startMcpServer().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
