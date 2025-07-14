import express, { Request, Response } from 'express';
import { z } from 'zod';

const app = express();
app.use(express.json());

// Tool definitions for Power Platform
const toolDefinitions = [
  {
    name: 'get-chuck-joke',
    description: 'Get a random Chuck Norris joke',
    operationId: 'getChuckJoke',
    inputSchema: null
  },
  {
    name: 'get-chuck-joke-by-category',
    description: 'Get a random Chuck Norris joke by category',
    operationId: 'getChuckJokeByCategory',
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
    operationId: 'getChuckCategories',
    inputSchema: null
  },
  {
    name: 'get-dad-joke',
    description: 'Get a random Dad joke',
    operationId: 'getDadJoke',
    inputSchema: null
  }
];

// Power Platform expects standard REST endpoints
// Each tool should be exposed as a separate endpoint for easier integration

// Get Chuck Norris joke endpoint
app.get('/api/chuck-joke', async (_req: Request, res: Response) => {
  try {
    const response = await fetch('https://api.chucknorris.io/jokes/random');
    const data = await response.json();
    res.json({
      success: true,
      data: {
        joke: data.value,
        id: data.id,
        url: data.url
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Chuck Norris joke'
    });
  }
});

// Get Chuck Norris joke by category
app.get('/api/chuck-joke/:category', async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const response = await fetch(
      `https://api.chucknorris.io/jokes/random?category=${category}`
    );
    
    if (!response.ok) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category'
      });
    }
    
    const data = await response.json();
    res.json({
      success: true,
      data: {
        joke: data.value,
        category: category,
        id: data.id,
        url: data.url
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Chuck Norris joke by category'
    });
  }
});

// Get Chuck Norris categories
app.get('/api/chuck-categories', async (_req: Request, res: Response) => {
  try {
    const response = await fetch('https://api.chucknorris.io/jokes/categories');
    const data = await response.json();
    res.json({
      success: true,
      data: {
        categories: data,
        count: data.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
});

// Get Dad joke
app.get('/api/dad-joke', async (_req: Request, res: Response) => {
  try {
    const response = await fetch('https://icanhazdadjoke.com/', {
      headers: { Accept: 'application/json' }
    });
    const data = await response.json();
    res.json({
      success: true,
      data: {
        joke: data.joke,
        id: data.id
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Dad joke'
    });
  }
});

// MCP-style endpoint for Power Platform Custom Connector
// This provides a unified interface for all tools
app.post('/api/mcp/execute', async (req: Request, res: Response) => {
  try {
    const { tool, parameters } = req.body;
    
    if (!tool) {
      return res.status(400).json({
        success: false,
        error: 'Tool name is required'
      });
    }
    
    let result: any;
    
    switch (tool) {
      case 'get-chuck-joke': {
        const response = await fetch('https://api.chucknorris.io/jokes/random');
        const data = await response.json();
        result = { joke: data.value };
        break;
      }
      
      case 'get-chuck-joke-by-category': {
        if (!parameters?.category) {
          return res.status(400).json({
            success: false,
            error: 'Category parameter is required'
          });
        }
        const response = await fetch(
          `https://api.chucknorris.io/jokes/random?category=${parameters.category}`
        );
        const data = await response.json();
        result = { joke: data.value, category: parameters.category };
        break;
      }
      
      case 'get-chuck-categories': {
        const response = await fetch('https://api.chucknorris.io/jokes/categories');
        const data = await response.json();
        result = { categories: data };
        break;
      }
      
      case 'get-dad-joke': {
        const response = await fetch('https://icanhazdadjoke.com/', {
          headers: { Accept: 'application/json' }
        });
        const data = await response.json();
        result = { joke: data.joke };
        break;
      }
      
      default:
        return res.status(400).json({
          success: false,
          error: `Unknown tool: ${tool}`
        });
    }
    
    res.json({
      success: true,
      tool: tool,
      result: result
    });
    
  } catch (error) {
    console.error('MCP execution error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// List available tools - useful for Power Platform discovery
app.get('/api/mcp/tools', (_req: Request, res: Response) => {
  res.json({
    success: true,
    tools: toolDefinitions
  });
});

// OpenAPI/Swagger endpoint for Power Platform Custom Connector
app.get('/api/swagger.json', (_req: Request, res: Response) => {
  const swagger = {
    openapi: '3.0.0',
    info: {
      title: 'MCP Jokes API',
      description: 'API for fetching Chuck Norris and Dad jokes',
      version: '1.0.0'
    },
    servers: [
      {
        url: process.env.API_URL || `http://localhost:${PORT}`,
        description: 'MCP Server'
      }
    ],
    paths: {
      '/api/chuck-joke': {
        get: {
          summary: 'Get a random Chuck Norris joke',
          operationId: 'getChuckJoke',
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          joke: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/chuck-joke/{category}': {
        get: {
          summary: 'Get a Chuck Norris joke by category',
          operationId: 'getChuckJokeByCategory',
          parameters: [
            {
              name: 'category',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          joke: { type: 'string' },
                          category: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/chuck-categories': {
        get: {
          summary: 'Get Chuck Norris joke categories',
          operationId: 'getChuckCategories',
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          categories: {
                            type: 'array',
                            items: { type: 'string' }
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
      },
      '/api/dad-joke': {
        get: {
          summary: 'Get a random Dad joke',
          operationId: 'getDadJoke',
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          joke: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/mcp/execute': {
        post: {
          summary: 'Execute MCP tool',
          operationId: 'executeMcpTool',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    tool: { type: 'string' },
                    parameters: { type: 'object' }
                  },
                  required: ['tool']
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      tool: { type: 'string' },
                      result: { type: 'object' }
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
  
  res.json(swagger);
});

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'mcp-streamable-http'
  });
});

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'MCP Streamable HTTP Server for Power Platform',
    endpoints: {
      swagger: '/api/swagger.json',
      health: '/api/health',
      tools: '/api/mcp/tools',
      execute: '/api/mcp/execute'
    }
  });
});

// Log registered endpoints at startup
console.log('Registered endpoints for Power Platform:');
console.log('- GET  /api/chuck-joke');
console.log('- GET  /api/chuck-joke/:category');
console.log('- GET  /api/chuck-categories');
console.log('- GET  /api/dad-joke');
console.log('- POST /api/mcp/execute');
console.log('- GET  /api/mcp/tools');
console.log('- GET  /api/swagger.json');

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`MCP Server for Power Platform listening on port ${PORT}`);
  console.log(`Swagger documentation available at: http://localhost:${PORT}/api/swagger.json`);
});
