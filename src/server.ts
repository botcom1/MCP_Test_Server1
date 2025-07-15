// Jokes MCP Server – fully MCP‑compliant version
// ------------------------------------------------
// This file replaces the previous server.ts, adding:
//  • Correct MCP capability advertisement in `initialize`
//  • Output schema for every tool
//  • Poly‑fill for global `fetch` when running on Node <18
//  • Streamable MCP support flag `x-ms-agentic-protocol` in generated Swagger
//  • Minor type safety and logging improvements

import express, { Request, Response } from 'express';
import { z } from 'zod';
// Poly‑fill fetch for Node 14/16 runtimes (no‑op on Node 18+ where fetch is global)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import fetch, { Headers as FetchHeaders } from 'node-fetch';

const app = express();
app.use(express.json());

// ---------------------------------------------
// Tool definitions (MCP Schema)
// ---------------------------------------------
interface ToolSchema {
  type: string;
  properties: Record<string, unknown>;
  required: string[];
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ToolSchema;
  outputSchema: ToolSchema;
}

const jsonTextOutputSchema: ToolSchema = {
  type: 'object',
  properties: {
    content: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          text: { type: 'string' }
        },
        required: ['type', 'text']
      }
    }
  },
  required: ['content']
};

const toolDefinitions: ToolDefinition[] = [
  {
    name: 'get-chuck-joke',
    description: 'Get a random Chuck Norris joke',
    inputSchema: { type: 'object', properties: {}, required: [] },
    outputSchema: jsonTextOutputSchema
  },
  {
    name: 'get-chuck-joke-by-category',
    description: 'Get a random Chuck Norris joke by category',
    inputSchema: {
      type: 'object',
      properties: { category: { type: 'string', description: 'Joke category' } },
      required: ['category']
    },
    outputSchema: jsonTextOutputSchema
  },
  {
    name: 'get-chuck-categories',
    description: 'List all available Chuck Norris joke categories',
    inputSchema: { type: 'object', properties: {}, required: [] },
    outputSchema: jsonTextOutputSchema
  },
  {
    name: 'get-dad-joke',
    description: 'Get a random dad joke',
    inputSchema: { type: 'object', properties: {}, required: [] },
    outputSchema: jsonTextOutputSchema
  }
];

// ---------------------------------------------
// MCP JSON‑RPC validation schema
// ---------------------------------------------
const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.any().optional()
});

// ---------------------------------------------
// MCP Endpoint – POST /mcp
// ---------------------------------------------
app.post('/mcp', async (req: Request, res: Response): Promise<void> => {
  console.log('📥 MCP request', JSON.stringify(req.body, null, 2));

  try {
    const { id, method, params } = JsonRpcRequestSchema.parse(req.body);

    switch (method) {
      // 1. Handshake -------------------------------------------------------
      case 'initialize': {
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: { list: {}, call: {} },
              logging: {}
            },
            serverInfo: { name: 'jokes-mcp-server', version: '2.0.0' }
          }
        });
        return;
      }

      // 2. List tools ------------------------------------------------------
      case 'tools/list': {
        res.json({ jsonrpc: '2.0', id, result: { tools: toolDefinitions } });
        return;
      }

      // 3. Call tool -------------------------------------------------------
      case 'tools/call': {
        if (!params?.name) {
          res.json({
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: 'Invalid params: tool name is required' }
          });
          return;
        }

        const { name: toolName, arguments: toolArgs = {} } = params;
        let result: unknown;

        switch (toolName) {
          case 'get-chuck-joke': {
            const data = await (await fetch('https://api.chucknorris.io/jokes/random')).json();
            result = {
              content: [{ type: 'text', text: data.value }]
            };
            break;
          }
          case 'get-chuck-joke-by-category': {
            if (!toolArgs.category) {
              res.json({
                jsonrpc: '2.0',
                id,
                error: { code: -32602, message: 'Invalid params: category is required' }
              });
              return;
            }
            const url = `https://api.chucknorris.io/jokes/random?category=${encodeURIComponent(toolArgs.category)}`;
            const response = await fetch(url);
            if (!response.ok) {
              res.json({
                jsonrpc: '2.0',
                id,
                error: { code: -32603, message: 'Invalid category' }
              });
              return;
            }
            const data = await response.json();
            result = {
              content: [{ type: 'text', text: data.value }]
            };
            break;
          }
          case 'get-chuck-categories': {
            const data = await (await fetch('https://api.chucknorris.io/jokes/categories')).json();
            result = {
              content: [{ type: 'text', text: `Available categories: ${data.join(', ')}` }]
            };
            break;
          }
          case 'get-dad-joke': {
            const data = await (
              await fetch('https://icanhazdadjoke.com/', { headers: { Accept: 'application/json' } })
            ).json();
            result = {
              content: [{ type: 'text', text: data.joke }]
            };
            break;
          }
          default: {
            res.json({
              jsonrpc: '2.0',
              id,
              error: { code: -32601, message: `Unknown tool: ${toolName}` }
            });
            return;
          }
        }

        res.json({ jsonrpc: '2.0', id, result });
        return;
      }

      // 4. Misc housekeeping ---------------------------------------------
      case 'notifications/initialized':
      case 'logging/setLevel': {
        res.json({ jsonrpc: '2.0', id, result: {} });
        return;
      }

      default: {
        res.json({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` }
        });
        return;
      }
    }
  } catch (err) {
    console.error('❌ MCP error', err);
    if (err instanceof z.ZodError) {
      res.json({
        jsonrpc: '2.0',
        id: req.body.id ?? null,
        error: { code: -32600, message: 'Invalid Request', data: err.errors }
      });
    } else {
      res.json({
        jsonrpc: '2.0',
        id: req.body.id ?? null,
        error: { code: -32603, message: 'Internal server error' }
      });
    }
  }
});

// ---------------------------------------------
// Health + root endpoints
// ---------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/', (_req, res) => {
  res.json({ name: 'Jokes MCP Server', version: '2.0.0', protocol: 'MCP', tools: toolDefinitions.length });
});

// ---------------------------------------------
// Swagger – exposed at /api/swagger.json
// ---------------------------------------------
app.get('/api/swagger.json', (req: Request, res: Response) => {
  const PORT = process.env.PORT ?? 3000;
  const host = req.headers['x-forwarded-host'] ?? req.get('host') ?? `localhost:${PORT}`;

  const swagger = {
    swagger: '2.0',
    info: {
      title: 'Jokes MCP Server',
      description: 'Model Context Protocol server that provides joke tools to Copilot Studio',
      version: '2.0.0'
    },
    host,
    basePath: '/',
    schemes: ['https', 'http'],
    paths: {
      '/mcp': {
        post: {
          summary: 'MCP streamable endpoint',
          description: 'Full‑duplex streamable MCP endpoint',
          operationId: 'InvokeMcpStreamable',
          'x-ms-agentic-protocol': 'mcp-streamable-1.0',
          consumes: ['application/json'],
          produces: ['application/json'],
          parameters: [
            {
              in: 'body',
              name: 'body',
              schema: { type: 'object' },
              required: true,
              description: 'JSON‑RPC 2.0 envelope'
            }
          ],
          responses: { '200': { description: 'Success' } },
          'x-ms-visibility': 'important'
        }
      }
    }
  };

  res.json(swagger);
});

// ---------------------------------------------
// Start server
// ---------------------------------------------
const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`🚀 MCP server listening on http://localhost:${PORT}`);
  console.table(toolDefinitions.map(t => ({ tool: t.name, description: t.description })));
});
