/**
 * MCP stdio server: exposes scan_codebase for Cursor, Claude, Gemini, etc.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { analyzeProject } from './index';

const MCP_VERSION = '0.1.1';

function normalizeModuleKeys(modules: unknown): string[] | undefined {
  if (modules == null || modules === '') {
    return undefined;
  }
  if (Array.isArray(modules)) {
    return modules.map(String).map((m) => m.trim()).filter(Boolean);
  }
  if (typeof modules === 'string') {
    return modules.split(',').map((m) => m.trim()).filter(Boolean);
  }
  return undefined;
}

export async function startMcpServer(): Promise<void> {
  const server = new Server(
    { name: 'skannr', version: MCP_VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'scan_codebase',
        description:
          'Analyze any codebase to answer questions about structure and architecture. Returns ranked file skeletons with ~96.5% token reduction.',
        inputSchema: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: 'What you want to understand about the codebase',
            },
            root: {
              type: 'string',
              description: 'Absolute path to the repo root',
            },
            limit: {
              type: 'number',
              description: 'Max files to return (default: 8)',
            },
            modules: {
              type: 'string',
              description: 'Comma-separated module names to focus on',
            },
            lang: {
              type: 'string',
              description: 'Language: typescript, javascript, python, auto',
            },
          },
          required: ['question', 'root'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== 'scan_codebase') {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    const args = request.params.arguments as Record<string, unknown>;
    const question = String(args.question ?? '');
    const root = String(args.root ?? '');
    const limit =
      typeof args.limit === 'number' && !Number.isNaN(args.limit) && args.limit > 0
        ? args.limit
        : 8;
    const moduleKeys = normalizeModuleKeys(args.modules);
    const langRaw = args.lang != null ? String(args.lang).toLowerCase() : 'auto';
    const lang = (['typescript', 'javascript', 'python', 'auto'] as const).includes(
      langRaw as 'typescript' | 'javascript' | 'python' | 'auto',
    )
      ? (langRaw as 'typescript' | 'javascript' | 'python' | 'auto')
      : 'auto';

    const result = await analyzeProject({
      question,
      root,
      limit,
      moduleKeys,
      lang,
      enhancedRanking: true,
    });

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
