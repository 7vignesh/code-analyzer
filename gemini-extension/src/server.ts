import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { analyzeProject } from '../../dist/index';

const server = new Server(
  { name: 'code-analyzer', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'scan_codebase',
      description: 'Analyzes any codebase to answer questions about its structure and architecture. Scans files, generates structural skeletons, and ranks results using hybrid retrieval. Supports TypeScript, JavaScript, and Python. Pass the root path of any repository.',
      inputSchema: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'What you want to understand about the codebase',
          },
          root: {
            type: 'string',
            description: 'Absolute path to the repository root',
          },
          limit: {
            type: 'number',
            description: 'Max number of files to return (default: 10)',
          },
          modules: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional module keys (or directory names) to narrow the search scope',
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

  const { question, root, limit = 10, modules } = request.params.arguments as {
    question: string;
    root: string;
    limit?: number;
    modules?: string[];
  };

  const result = await analyzeProject({
    question,
    root,
    limit,
    moduleKeys: modules,
    enhancedRanking: true,
  });

  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
});

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
