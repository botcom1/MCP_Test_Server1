import express, { Request, Response } from 'express';
import { z } from 'zod';

const app = express();
app.use(express.json());

// Tool definitions
const toolDefinitions = [
  {
    category: 'tool',
    name: 'get-chuck-joke',
    description: 'Get a random Chuck Norris joke',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    category: 'tool',
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
    category: 'tool',
    name: 'get-chuck-categories',
    description: 'Get all available categories for Chuck Norris jokes',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    category: 'tool',
    name: 'get-dad-joke',
    description: 'Get a random Dad joke',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

// Generate dynamic Swagger that creates individual operations for each tool
function generateDynamicSwagger(host: string): any {
  const paths: any = {};
  
  // Create a separate POST operation for each tool
  toolDefinitions.forEach(tool => {
    const operationId = tool.name.replace(/-/g, '_');
    const pathName = `/mcp/${tool.name}`;
    
    paths[pathName] = {
      post: {
        summary: tool.description,
        operationId: operationId,
        description: `Executes the ${tool.name} tool via JSON-RPC 2.0`,
        consumes: ['application/json'],
        produces: ['application/json'],
        parameters: [
          {
            in: 'body',
            name: 'body',
            description: 'Tool execution request',
            required: true,
            schema: {
              type: 'object',
              properties: {
                // Pre-fill the method name for this specific tool
                jsonrpc: {
                  type: 'string',
                  enum: ['2.0'],
                  default: '2.0',
                  'x-ms-visibility': 'internal' // Hide from Power Platform UI
                },
                id: {
                  type: 'integer',
                  default: 1,
                  'x-ms-visibility': 'internal' // Hide from Power Platform UI
                },
                method: {
                  type: 'string',
                  enum: [tool.name],
                  default: tool.name,
                  'x-ms-visibility': 'internal' // Hide from Power Platform UI
                },
                params: tool.inputSchema.properties && Object.keys(tool.inputSchema.properties).length > 0 
                  ? tool.inputSchema 
                  : {
                      type: 'object',
                      'x-ms-visibility': 'internal',
                      default: {}
                    }
              },
              required: ['jsonrpc', 'id', 'method']
            }
          }
        ],
        responses: {
          '200': {
            description: 'Successful response',
            schema: {
              type: 'object',
              properties: {
                jsonrpc: { type: 'string' },
                id: { type: 'integer' },
                result: {
                  type: 'object',
                  properties: {
                    content: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          type: { type: 'string' },
                          text: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };
  });
  
  // Also keep the generic MCP endpoint
  paths['/mcp'] = {
    post: {
      summary: 'Execute any MCP tool',
      operationId: 'callMCP',
      description: 'Generic endpoint to invoke any registered MCP method',
      consumes: ['application/json'],
      produces: ['application/json'],
      parameters: [
        {
          in: 'body',
          name: 'body',
          description: 'JSON-RPC 2.0 request envelope',
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
                type: 'integer',
                format: 'int64',
                default: 1
              },
              method: {
                type: 'string',
                description: 'MCP method to invoke',
                enum: toolDefinitions.map(t => t.name)
              },
              params: {
                type: 'object',
                description: 'Method parameters'
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
            type: 'object',
            properties: {
              jsonrpc: { type: 'string' },
              id: { type: 'integer' },
              result: { type: 'object' }
            }
          }
        }
      }
    }
  };
  
  paths['/mcp/tools'] = {
    get: {
      summary: 'List all available tools',
      operationId: 'listTools',
      produces: ['application/json'],
      responses: {
        '200': {
          description: 'Array of tool definitions',
          schema: {
            type: 'array',
            items: {
              $ref: '#/definitions/Tool'
            }
          }
        }
      }
    }
  };
  
  return {
    swagger: '2.0',
    info: {
      title: 'Jokes MCP Server',
      description: 'Get jokes via MCP - each tool is exposed as a separate operation',
      version: '1.0',
      'x-ms-api-annotation': {
        status: 'Production'
      }
    },
    host: host,
    basePath: '/',
    schemes: ['https', 'http'],
    paths: paths,
    definitions: {
      Tool: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          inputSchema: { type: 'object' }
        }
      }
    },
    securityDefinitions: {},
    security: []
  };
}

// Handle all tool-specific endpoints
app.post('/mcp/:toolName', async (req: Request, res: Response): Promise<void> => {
  const { toolName } = req.params;
  
  // Override the method with the tool name from the URL
  const jsonRpcRequest = {
    jsonrpc: req.body.jsonrpc || '2.0',
    id: req.body.id || 1,
    method: toolName,
    params: req.body.params || {}
  };
  
  // Process as normal JSON-RPC
  req.body = jsonRpcRequest;
  await handleMcpRequest(req, res);
});

// Generic MCP endpoint
app.post('/mcp', async (req: Request, res: Response): Promise<void> => {
  await handleMcpRequest(req, res);
});

// Shared handler for all MCP requests
async function handleMcpRequest(req: Request, res: Response): Promise<void> {
  try {
    const { jsonrpc, id, method, params = {} } = req.body;
    let result: any;

    switch (method) {
      case 'get-chuck-joke': {
        const response = await fetch('https://api.chucknorris.io/jokes/random');
        const data = await response.json();
        result = {
          content: [{ type: 'text', text: data.value }]
        };
        break;
      }

      case 'get-chuck-joke-by-category': {
        if (!params.category) {
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
          `https://api.chucknorris.io/jokes/random?category=${params.category}`
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
          content: [{ type: 'text', text: data.value }]
        };
        break;
      }

      case 'get-chuck-categories': {
        const response = await fetch('https://api.chucknorris.io/jokes/categories');
        const data = await response.json();
        result = {
          content: [{ type: 'text', text: data.join(', ') }]
        };
        break;
      }

      case 'get-dad-joke': {
        const response = await fetch('https://icanhazdadjoke.com/', {
          headers: { Accept: 'application/json' }
        });
        const data = await response.json();
        result = {
          content: [{ type: 'text', text: data.joke }]
        };
        break;
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

    res.json({
      jsonrpc: '2.0',
      id,
      result
    });

  } catch (error) {
    console.error('MCP request error:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body.id || null,
      error: {
        code: -32603,
        message: 'Internal server error'
      }
    });
  }
}

// List tools endpoint
app.get('/mcp/tools', (_req: Request, res: Response): void => {
  res.json(toolDefinitions);
});

// Dynamic Swagger generation
app.get('/api/swagger.json', (_req: Request, res: Response): void => {
  const PORT = process.env.PORT ?? 3000;
  const host = process.env.HOST || `localhost:${PORT}`;
  
  const swagger = generateDynamicSwagger(host);
  res.json(swagger);
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`MCP Server listening on port ${PORT}`);
  console.log(`\nPower Platform Integration:`);
  console.log(`1. Import swagger from: http://localhost:${PORT}/api/swagger.json`);
  console.log(`2. Each tool will appear as a separate operation in Power Platform`);
  console.log(`\nAvailable operations:`);
  toolDefinitions.forEach(tool => {
    console.log(`   - ${tool.name} (POST /mcp/${tool.name})`);
  });
});
