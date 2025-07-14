import express, { Request, Response } from 'express';
import { z } from 'zod';

const app = express();
app.use(express.json());

// Store server state
let isInitialized = false;

// Tool definitions following MCP spec exactly
const toolDefinitions = [
  {
    name: 'get-chuck-joke',
    description: 'Get a random Chuck Norris joke',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get-chuck-joke-by-category',
    description: 'Get a random Chuck Norris joke by category',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Category of the Chuck Norris joke',
          enum: ['animal', 'career', 'celebrity', 'dev', 'explicit', 'fashion', 'food', 'history', 'money', 'movie', 'music', 'political', 'religion', 'science', 'sport', 'travel']
        }
      },
      required: ['category']
    }
  },
  {
    name: 'get-chuck-categories',
    description: 'Get all available categories for Chuck Norris jokes',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get-dad-joke',
    description: 'Get a random Dad joke',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

// MCP Server implementation that auto-negotiates with Copilot Studio
class MCPServer {
  async handleRequest(body: any): Promise<any> {
    // Handle both single requests and batch requests
    if (Array.isArray(body)) {
      // Batch request
      const responses = await Promise.all(body.map(req => this.processSingleRequest(req)));
      return responses;
    } else {
      // Single request
      return await this.processSingleRequest(body);
    }
  }

  async processSingleRequest(request: any): Promise<any> {
    const { jsonrpc, id, method, params } = request;

    try {
      switch (method) {
        case 'initialize':
          isInitialized = true;
          return {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: {},
                logging: {}
              },
              serverInfo: {
                name: 'jokes-mcp-server',
                version: '1.0.0'
              }
            }
          };

        case 'initialized':
          // Client confirming initialization
          return {
            jsonrpc: '2.0',
            id,
            result: {}
          };

        case 'tools/list':
          return {
            jsonrpc: '2.0',
            id,
            result: {
              tools: toolDefinitions
            }
          };

        case 'tools/call':
          return await this.executeTool(id, params);

        case 'completion/complete':
          // Handle completion requests
          return {
            jsonrpc: '2.0',
            id,
            result: {
              completion: {
                values: [],
                total: 0,
                hasMore: false
              }
            }
          };

        default:
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: `Method not found: ${method}`
            }
          };
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error'
        }
      };
    }
  }

  async executeTool(id: any, params: any): Promise<any> {
    if (!params || !params.name) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32602,
          message: 'Invalid params: tool name is required'
        }
      };
    }

    const toolName = params.name;
    const toolArgs = params.arguments || {};

    try {
      let content: string;

      switch (toolName) {
        case 'get-chuck-joke': {
          const response = await fetch('https://api.chucknorris.io/jokes/random');
          const data = await response.json();
          content = data.value;
          break;
        }

        case 'get-chuck-joke-by-category': {
          if (!toolArgs.category) {
            return {
              jsonrpc: '2.0',
              id,
              error: {
                code: -32602,
                message: 'Invalid params: category is required'
              }
            };
          }
          
          const response = await fetch(
            `https://api.chucknorris.io/jokes/random?category=${toolArgs.category}`
          );
          
          if (!response.ok) {
            return {
              jsonrpc: '2.0',
              id,
              error: {
                code: -32603,
                message: 'Invalid category'
              }
            };
          }
          
          const data = await response.json();
          content = data.value;
          break;
        }

        case 'get-chuck-categories': {
          const response = await fetch('https://api.chucknorris.io/jokes/categories');
          const data = await response.json();
          content = `Available categories: ${data.join(', ')}`;
          break;
        }

        case 'get-dad-joke': {
          const response = await fetch('https://icanhazdadjoke.com/', {
            headers: { Accept: 'application/json' }
          });
          const data = await response.json();
          content = data.joke;
          break;
        }

        default:
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: `Unknown tool: ${toolName}`
            }
          };
      }

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: content
            }
          ]
        }
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
    }
  }
}

const mcpServer = new MCPServer();

// Main MCP endpoint - handles all requests
app.post('/mcp', async (req: Request, res: Response): Promise<void> => {
  console.log('MCP Request:', JSON.stringify(req.body, null, 2));
  
  try {
    const response = await mcpServer.handleRequest(req.body);
    console.log('MCP Response:', JSON.stringify(response, null, 2));
    res.json(response);
  } catch (error) {
    console.error('MCP Error:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body.id || null,
      error: {
        code: -32603,
        message: 'Internal server error'
      }
    });
  }
});

// SSE endpoint for streaming (if needed by Copilot Studio)
app.get('/mcp/sse', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Send initial connection event
  res.write('event: open\n');
  res.write('data: {}\n\n');
  
  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write('event: ping\n');
    res.write('data: {}\n\n');
  }, 30000);
  
  req.on('close', () => {
    clearInterval(keepAlive);
  });
});

// Health check
app.get('/health', (_req: Request, res: Response): void => {
  res.json({
    status: 'healthy',
    server: 'jokes-mcp-server',
    initialized: isInitialized,
    tools: toolDefinitions.length
  });
});

// Root endpoint
app.get('/', (_req: Request, res: Response): void => {
  res.json({
    name: 'Jokes MCP Server',
    version: '1.0.0',
    protocol: 'MCP/2024-11-05',
    endpoints: {
      mcp: 'POST /mcp',
      sse: 'GET /mcp/sse',
      health: 'GET /health',
      swagger: 'GET /api/swagger.json'
    }
  });
});

// OpenAPI spec for MCP - THIS IS THE KEY CHANGE
app.get('/api/swagger.json', (req: Request, res: Response): void => {
  const host = req.get('host') || 'localhost:3000';
  
  const spec = {
    swagger: '2.0',
    info: {
      title: 'Jokes MCP Server',
      description: 'Connects to the Jokes MCP Server using the minimal agentic protocol',
      version: '1.0.0'
    },
    host: host,
    basePath: '/api',
    schemes: ['https'],
    paths: {
      '/mcp': {
        post: {
          summary: 'Invoke Jokes MCP Server',
          'x-ms-agentic-protocol': 'mcp-streamable-1.0',
          operationId: 'InvokeJokesMcpServer',
          responses: {
            default: {
              description: 'Default response. The actual response will be handled by the MCP stream.'
            }
          }
        }
      }
    },
    securityDefinitions: {}
  };
  
  res.json(spec);
});

// Legacy OpenAPI spec for the MCP connector (keep for compatibility)
app.get('/api/mcp-connector.json', (_req: Request, res: Response): void => {
  const PORT = process.env.PORT ?? 3000;
  const host = process.env.HOST || `localhost:${PORT}`;
  
  // This is a special OpenAPI spec for MCP connectors
  const spec = {
    swagger: '2.0',
    info: {
      title: 'Jokes MCP Server',
      description: 'Model Context Protocol server providing joke tools',
      version: '1.0.0',
      'x-ms-api-annotation': {
        status: 'Production'
      }
    },
    host: host,
    basePath: '/',
    schemes: ['https', 'http'],
    consumes: ['application/json'],
    produces: ['application/json'],
    paths: {
      '/mcp': {
        post: {
          summary: 'MCP Protocol Handler',
          description: 'Processes MCP protocol messages',
          operationId: 'mcp',
          parameters: [
            {
              name: 'body',
              in: 'body',
              required: true,
              schema: {
                type: 'object'
              }
            }
          ],
          responses: {
            '200': {
              description: 'Success',
              schema: {
                type: 'object'
              }
            }
          },
          'x-ms-visibility': 'internal'
        }
      }
    },
    'x-ms-connector-metadata': [
      {
        propertyName: 'Website',
        propertyValue: 'https://modelcontextprotocol.io'
      },
      {
        propertyName: 'Privacy policy',
        propertyValue: 'https://modelcontextprotocol.io/privacy'
      },
      {
        propertyName: 'Categories',
        propertyValue: 'AI;Data'
      }
    ]
  };
  
  res.json(spec);
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Jokes MCP Server running on port ${PORT}`);
  console.log(`\n📋 Integration Instructions:`);
  console.log(`\nFor Copilot Studio (MCP Server):`);
  console.log(`1. In Copilot Studio, go to Tools > Add tool`);
  console.log(`2. Choose "Connector" > "Create custom connector"`);
  console.log(`3. Import from OpenAPI URL: https://your-server.com/api/swagger.json`);
  console.log(`4. The connector will be recognized as an MCP server due to x-ms-agentic-protocol`);
  console.log(`5. Save and the tools will appear in the configuration\n`);
  console.log(`Available tools (${toolDefinitions.length} total):`);
  toolDefinitions.forEach(tool => {
    console.log(`   - ${tool.name}: ${tool.description}`);
  });
});
