/**********************************************************************
 * Jokes MCP Server – streamable transport, ready for Copilot Studio  *
 *********************************************************************/

import express from "express";
import { z } from "zod";
import fetchOrig from "node-fetch";

// -------------------------------------------------------------------
// 1. Ensure global fetch (Node <18 needs node-fetch; Node 18+ already has it)
if (!globalThis.fetch) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore – node-fetch CommonJS default export
  globalThis.fetch = (fetchOrig as unknown) as typeof fetch;
}

// -------------------------------------------------------------------
// 2. MCP SDK setup
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp";

const mcp = new McpServer({
  name: "jokes-mcp",
  version: "2.0.0",
  description: "Chuck Norris & Dad jokes as MCP tools",
});

// Chuck Norris random
mcp.tool(
  "getChuckJoke",
  "Returns a random Chuck Norris joke",
  z.object({}),
  async () => {
    const rsp = await fetch("https://api.chucknorris.io/jokes/random");
    const data = (await rsp.json()) as { value: string };
    return { content: [{ type: "text", text: data.value }] };
  }
);

// Chuck Norris by category
mcp.tool(
  "getChuckJokeByCategory",
  "Returns a Chuck Norris joke from the specified category",
  z.object({ category: z.string() }),
  async ({ category }) => {
    const rsp = await fetch(
      `https://api.chucknorris.io/jokes/random?category=${encodeURIComponent(
        category
      )}`
    );
    const data = (await rsp.json()) as { value: string };
    return { content: [{ type: "text", text: data.value }] };
  }
);

// Chuck categories
mcp.tool(
  "getChuckCategories",
  "Lists all available Chuck Norris joke categories",
  z.object({}),
  async () => {
    const rsp = await fetch("https://api.chucknorris.io/jokes/categories");
    const cats = (await rsp.json()) as string[];
    return { content: [{ type: "text", text: cats.join(", ") }] };
  }
);

// Dad joke
mcp.tool(
  "getDadJoke",
  "Returns a random Dad joke",
  z.object({}),
  async () => {
    const rsp = await fetch("https://icanhazdadjoke.com/", {
      headers: { Accept: "text/plain" },
    });
    const joke = await rsp.text();
    return { content: [{ type: "text", text: joke }] };
  }
);

// -------------------------------------------------------------------
// 3. Express + transport bridge
const app = express();
const transport = new StreamableHTTPServerTransport();

// Bind SDK transport to /mcp (NO body-parser!)
app.all("/mcp", (req, res) => transport.handleRequest(req, res, req));

// Health probe
app.get("/health", (_, res) => res.status(200).send("OK"));

// Minimal home page
app.get("/", (_, res) =>
  res
    .status(200)
    .send(
      "Jokes MCP Server is running. See /api/swagger.json for connector spec."
    )
);

// OpenAPI 2.0 (Swagger) – minimal & MCP-flagged
const swaggerDoc = {
  swagger: "2.0",
  info: {
    title: "Jokes MCP Server",
    description: "Streamable MCP endpoint for Copilot Studio",
    version: "2.0.0",
  },
  host: "<replace-with-your-host>.azurewebsites.net",
  basePath: "/",
  schemes: ["https"],
  paths: {
    "/mcp": {
      post: {
        summary: "Streamable MCP endpoint",
        operationId: "InvokeMcp",
        "x-ms-agentic-protocol": "mcp-streamable-1.0",
        responses: { "200": { description: "Success" } },
      },
    },
  },
};

// Serve swagger
app.get("/api/swagger.json", (_, res) => res.json(swaggerDoc));

// -------------------------------------------------------------------
// 4. Start everything
(async () => {
  await mcp.connect(transport); // register transport

  const PORT = process.env.PORT ?? 3000;
  app.listen(PORT, () => {
    console.log(`MCP server listening on port ${PORT}`);
  });
})();
