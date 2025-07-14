import express, { Request, Response } from 'express';
// Try this import, if both are exported from server/index.js or main entry
import { McpServer, StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server';
// If above fails, try importing from '@modelcontextprotocol/sdk' directly

import { z } from 'zod';

const server = new McpServer({
  name: 'mcp-streamable-http',
  version: '1.0.0'
});

// Register tools
server.tool(
  'get-chuck-joke',
  'Get a random Chuck Norris joke',
  async () => {
    const res = await fetch('https://api.chucknorris.io/jokes/random');
    const data = await res.json();
    return { content: [{ type: 'text', text: data.value }] };
  }
);

server.tool(
  'get-chuck-joke-by-category',
  'Get a random Chuck Norris joke by category',
  { category: z.string().describe('Category of the Chuck Norris joke') },
  async ({ category }: { category: string }) => {
    const res = await fetch(
      `https://api.chucknorris.io/jokes/random?category=${category}`
    );
    const data = await res.json();
    return { content: [{ type: 'text', text: data.value }] };
  }
);

server.tool(
  'get-chuck-categories',
  'Get all available categories for Chuck Norris jokes',
  async () => {
    const res = await fetch('https://api.chucknorris.io/jokes/categories');
    const data = await res.json();
    return { content: [{ type: 'text', text: data.join(', ') }] };
  }
);

server.tool(
  'get-dad-joke',
  'Get a random Dad joke',
  async () => {
    const res = await fetch('https://icanhazdadjoke.com/', {
      headers: { Accept: 'application/json' }
    });
    const data = await res.json();
    return { content: [{ type: 'text', text: data.joke }] };
  }
);

// Log registered methods at startup
console.log(
  'Registered MCP methods:',
  server.describeTools().map((t: { name: string }) => t.name)
);

const app = express();
app.use(express.json());

// Handle each MCP call with a fresh transport
app.post('/mcp', async (req: Request, res: Response) => {
  console.log('Received MCP request:', req.body);

  const transport = new StreamableHTTPServerTransport({
    request: req,
    response: res,
    sessionIdGenerator: undefined
  });

  try {
    await server.connect(transport);
  } catch (err) {
    console.error('MCP transport error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null
      });
    }
  }
});

// Expose the live tool registry
app.get('/mcp/tools', (_req: Request, res: Response) => {
  res.json(server.describeTools());
});

// Handle unsupported methods
app.delete('/mcp', (_req: Request, res: Response) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed.' },
    id: null
  });
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () =>
  console.log(`MCP Streamable HTTP Server listening on port ${PORT}`)
);
