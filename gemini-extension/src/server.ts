import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { analyzeProject } from '../../dist/index';

const server = new Server(
  { name: 'rc-code-analyzer', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'scan_codebase',
      description: 'Scan Rocket.Chat TypeScript files and return compressed skeletons of the most relevant ones for a question.',
      inputSchema: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'What you want to understand about the codebase',
          },
          root: {
            type: 'string',
            description: 'Absolute path to the Rocket.Chat repo root',
          },
          limit: {
            type: 'number',
            description: 'Max number of files to return (default: 10)',
          },
          modules: {
            type: 'array',
            items: { type: 'string' },
            description: 'Narrow search to specific modules: lib-server-functions, authorization, e2e, file-upload',
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

  const result = await analyzeProject({ question, root, limit, moduleKeys: modules });

  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
});

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
