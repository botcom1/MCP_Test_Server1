import express from 'express';
import { z } from 'zod';

const app = express();
app.use(express.json());

// MCP Request Schema
const MCPRequestSchema = z.object({
  jsonrpc: z.string().literal('2.0'),
  method: z.string(),
  params: z.any().optional(),
  id: z.union([z.string(), z.number()])
});

// MCP endpoint
app.post('/mcp', async (req, res) => {
  try {
    const request = MCPRequestSchema.parse(req.body);
    
    switch (request.method) {
      case 'initialize':
        res.json({
          jsonrpc: '2.0',
          id: request.id,
          result: {
            protocolVersion: '1.0.0',
            serverInfo: {
              name: 'Multi-Tool MCP Server',
              version: '1.0.0'
            },
            capabilities: {
              tools: true
            }
          }
        });
        break;
        
      case 'tools/list':
        res.json({
          jsonrpc: '2.0',
          id: request.id,
          result: {
            tools: [
              {
                name: 'get_joke',
                description: 'Get a random dad joke or Chuck Norris joke',
                inputSchema: {
                  type: 'object',
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['dad', 'chuck'],
                      description: 'Type of joke to retrieve'
                    }
                  },
                  required: ['type']
                }
              },
              {
                name: 'get_fact',
                description: 'Get a random cat fact or number fact',
                inputSchema: {
                  type: 'object',
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['cat', 'number'],
                      description: 'Type of fact to retrieve'
                    },
                    number: {
                      type: 'integer',
                      description: 'Specific number for number facts (optional)'
                    }
                  },
                  required: ['type']
                }
              },
              {
                name: 'search_recipe',
                description: 'Search for recipes by ingredients or dish name',
                inputSchema: {
                  type: 'object',
                  properties: {
                    query: {
                      type: 'string',
                      description: 'Search query for recipes'
                    }
                  },
                  required: ['query']
                }
              }
            ]
          }
        });
        break;
        
      case 'tools/call':
        const toolName = request.params?.name;
        const args = request.params?.arguments || {};
        
        let result;
        switch (toolName) {
          case 'get_joke':
            if (args.type === 'dad') {
              result = { joke: "Why don't scientists trust atoms? Because they make up everything!" };
            } else {
              result = { joke: "Chuck Norris doesn't read books. He stares them down until he gets the information he wants." };
            }
            break;
            
          case 'get_fact':
            if (args.type === 'cat') {
              result = { fact: "Cats spend 70% of their lives sleeping." };
            } else {
              result = { fact: `The number ${args.number || 42} is interesting!` };
            }
            break;
            
          case 'search_recipe':
            result = {
              recipes: [
                {
                  name: `Recipe for ${args.query}`,
                  ingredients: ['ingredient1', 'ingredient2'],
                  instructions: 'Mix and cook!'
                }
              ]
            };
            break;
            
          default:
            throw new Error(`Unknown tool: ${toolName}`);
        }
        
        res.json({
          jsonrpc: '2.0',
          id: request.id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          }
        });
        break;
        
      default:
        res.status(400).json({
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601,
            message: 'Method not found'
          }
        });
    }
  } catch (error) {
    res.status(400).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error'
      }
    });
  }
});

// Swagger endpoint
app.get('/api/swagger.json', (req, res) => {
  res.json({
    swagger: '2.0',
    info: {
      title: 'Multi-Tool MCP Server',
      description: 'MCP Server with multiple tools for jokes, facts, and recipes',
      version: '1.0.0'
    },
    host: req.get('host'),
    basePath: '/api',
    schemes: ['https'],
    paths: {
      '/mcp': {
        post: {
          summary: 'Invoke Multi-Tool MCP Server',
          'x-ms-agentic-protocol': 'mcp-streamable-1.0',
          operationId: 'InvokeMcpServer',
          responses: {
            default: {
              description: 'Default response. The actual response will be handled by the MCP stream.'
            }
          }
        }
      }
    },
    securityDefinitions: {}
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`);
});
