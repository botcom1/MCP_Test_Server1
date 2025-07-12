import { Tool } from "mcp-tooling";

export const listMethods = new Tool({
  name: "list-methods",
  description: "Lists all available MCP methods.",
  parameters: {},
  execute: async ({ tools }) => {
    // tools is a Map<string, Tool>
    return Array.from(tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  },
});
