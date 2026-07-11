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
      {
        name: 'blast_radius',
        description:
          'Analyze downstream impact and risk of a git diff. Returns affected files, risk score, and test coverage gaps.',
        inputSchema: {
          type: 'object',
          properties: {
            root: {
              type: 'string',
              description: 'Absolute path to the repo root',
            },
            diff: {
              type: 'string',
              description: 'Unified diff content (if omitted, uses working tree vs HEAD)',
            },
            hops: {
              type: 'number',
              description: 'Max traversal hops for downstream impact (default: 2)',
            },
          },
          required: ['root'],
        },
      },
      {
        name: 'guard_review',
        description:
          'Review staged or diff changes against team-defined rules. Returns structured violations with severity, confidence, and fixability.',
        inputSchema: {
          type: 'object',
          properties: {
            root: {
              type: 'string',
              description: 'Absolute path to the repo root',
            },
            diff: {
              type: 'string',
              description: 'Unified diff content (if omitted, reviews staged files)',
            },
            diff_only: {
              type: 'boolean',
              description: 'Skip cross-file context for faster review (default: false)',
            },
            fix: {
              type: 'boolean',
              description: 'Apply auto-fixes for fixable violations (default: false)',
            },
          },
          required: ['root'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const args = request.params.arguments as Record<string, unknown>;

    if (toolName === 'scan_codebase') {
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
    }

    if (toolName === 'blast_radius') {
      const { computeBlastRadius } = await import('./blast-radius');
      const root = String(args.root ?? '');
      const hops =
        typeof args.hops === 'number' && !Number.isNaN(args.hops) && args.hops > 0
          ? args.hops
          : 2;
      const diffContent =
        typeof args.diff === 'string' && args.diff.length > 0
          ? args.diff
          : undefined;

      const result = computeBlastRadius({
        root,
        diffContent,
        hops,
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }

    if (toolName === 'guard_review') {
      const { runGuard, formatGuardJson } = await import('./guard/index');
      const root = String(args.root ?? '');
      const diffContent =
        typeof args.diff === 'string' && args.diff.length > 0
          ? args.diff
          : undefined;
      const diffOnly = args.diff_only === true;
      const fix = args.fix === true;

      const { result } = await runGuard({
        root,
        diffOnly,
        fix,
        ...(diffContent ? { prMode: false } : {}),
      });

      return {
        content: [{ type: 'text', text: formatGuardJson(result) }],
      };
    }

    throw new Error(`Unknown tool: ${toolName}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
