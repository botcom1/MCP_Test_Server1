import express, { Request, Response } from 'express';
import { z } from 'zod';

const app = express();
app.use(express.json());

// Tool definitions following MCP spec
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
          description: 'Category of the Chuck Norris joke'
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

// JSON-RPC request validation
const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.any().optional()
});

// Main MCP endpoint - handles all JSON-RPC 2.0 calls
app.post('/mcp', async (req: Request, res: Response): Promise<void> => {
  console.log('Received MCP request:', JSON.stringify(req.body, null, 2));

  try {
    const request = JsonRpcRequestSchema.parse(req.body);
    const { jsonrpc, id, method, params } = request;

    // Handle MCP protocol methods
    switch (method) {
      // Initialize method - called when Copilot Studio connects
      case 'initialize': {
        res.json({
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
        });
        return;
      }

      // List available tools - this is what Copilot Studio uses to discover tools
      case 'tools/list': {
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            tools: toolDefinitions
          }
        });
        return;
      }

      // Execute a tool
      case 'tools/call': {
        if (!params || !params.name) {
          res.json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: 'Invalid params: tool name is required'
            }
          });
          return;
        }

        const toolName = params.name;
        const toolArgs = params.arguments || {};
        let result: any;

        switch (toolName) {
          case 'get-chuck-joke': {
            const response = await fetch('https://api.chucknorris.io/jokes/random');
            const data = await response.json();
            result = {
              content: [
                {
                  type: 'text',
                  text: data.value
                }
              ]
            };
            break;
          }

          case 'get-chuck-joke-by-category': {
            if (!toolArgs.category) {
              res.json({
                jsonrpc: '2.0',
                id,
                error: {
                  code: -32602,
                  message: 'Invalid params: category is required'
                }
              });
              return;
            }
            
            const response = await fetch(
              `https://api.chucknorris.io/jokes/random?category=${toolArgs.category}`
            );
            
            if (!response.ok) {
              res.json({
                jsonrpc: '2.0',
                id,
                error: {
                  code: -32603,
                  message: 'Invalid category'
                }
              });
              return;
            }
            
            const data = await response.json();
            result = {
              content: [
                {
                  type: 'text',
                  text: data.value
                }
              ]
            };
            break;
          }

          case 'get-chuck-categories': {
            const response = await fetch('https://api.chucknorris.io/jokes/categories');
            const data = await response.json();
            result = {
              content: [
                {
                  type: 'text',
                  text: `Available categories: ${data.join(', ')}`
                }
              ]
            };
            break;
          }

          case 'get-dad-joke': {
            const response = await fetch('https://icanhazdadjoke.com/', {
              headers: { Accept: 'application/json' }
            });
            const data = await response.json();
            result = {
              content: [
                {
                  type: 'text',
                  text: data.joke
                }
              ]
            };
            break;
          }

          default:
            res.json({
              jsonrpc: '2.0',
              id,
              error: {
                code: -32601,
                message: `Unknown tool: ${toolName}`
              }
            });
            return;
        }

        res.json({
          jsonrpc: '2.0',
          id,
          result
        });
        return;
      }

      // Handle other potential MCP methods
      case 'notifications/initialized':
      case 'logging/setLevel': {
        // Acknowledge these methods
        res.json({
          jsonrpc: '2.0',
          id,
          result: {}
        });
        return;
      }

      default:
        res.json({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`
          }
        });
        return;
    }

  } catch (error) {
    console.error('MCP request error:', error);
    
    if (error instanceof z.ZodError) {
      res.json({
        jsonrpc: '2.0',
        id: req.body.id || null,
        error: {
          code: -32600,
          message: 'Invalid Request',
          data: error.errors
        }
      });
      return;
    }

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

// Health check endpoint
app.get('/health', (_req: Request, res: Response): void => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    server: 'jokes-mcp-server',
    tools: toolDefinitions.length
  });
});

// Root endpoint with server info
app.get('/', (_req: Request, res: Response): void => {
  res.json({
    name: 'Jokes MCP Server',
    version: '1.0.0',
    protocol: 'MCP',
    description: 'Model Context Protocol server for jokes',
    endpoints: {
      mcp: 'POST /mcp',
      health: 'GET /health'
    }
  });
});

// Swagger for Power Platform Custom Connector - MCP-aware
app.get('/api/swagger.json', (_req: Request, res: Response): void => {
  const PORT = process.env.PORT ?? 3000;
  const host = process.env.HOST || `localhost:${PORT}`;
  
  const swagger = {
    swagger: '2.0',
    info: {
      title: 'Jokes MCP Server',
      description: 'Model Context Protocol server that provides joke tools to Copilot Studio',
      version: '1.0',
      'x-ms-api-annotation': {
        status: 'Production'
      }
    },
    host: host,
    basePath: '/',
    schemes: ['https', 'http'],
    paths: {
      '/mcp': {
        post: {
          summary: 'MCP Protocol Endpoint',
          operationId: 'mcpProtocol',
          description: 'Handles all MCP protocol communications including tool discovery and execution',
          consumes: ['application/json'],
          produces: ['application/json'],
          parameters: [
            {
              in: 'body',
              name: 'body',
              description: 'JSON-RPC 2.0 request',
              required: true,
              schema: {
                type: 'object',
                properties: {
                  jsonrpc: {
                    type: 'string',
                    enum: ['2.0'],
                    default: '2.0'
                  },
                  id: {
                    type: 'string',
                    default: '1'
                  },
                  method: {
                    type: 'string',
                    enum: ['initialize', 'tools/list', 'tools/call'],
                    description: 'MCP method to call'
                  },
                  params: {
                    type: 'object',
                    description: 'Method-specific parameters'
                  }
                },
                required: ['jsonrpc', 'id', 'method']
              }
            }
          ],
          responses: {
            '200': {
              description: 'JSON-RPC 2.0 response',
              schema: {
                type: 'object'
              }
            }
          },
          'x-ms-visibility': 'important'
        }
      }
    },
    securityDefinitions: {},
    security: []
  };
  
  res.json(swagger);
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Jokes MCP Server running on port ${PORT}`);
  console.log(`\n📋 For Copilot Studio integration:`);
  console.log(`   1. Deploy this server to a public URL`);
  console.log(`   2. In Copilot Studio, add "Model Context Protocol" tool`);
  console.log(`   3. Use your server URL: https://your-server.com/mcp`);
  console.log(`   4. Copilot Studio will auto-discover all ${toolDefinitions.length} tools\n`);
  console.log(`Available tools:`);
  toolDefinitions.forEach(tool => {
    console.log(`   - ${tool.name}: ${tool.description}`);
  });
});
