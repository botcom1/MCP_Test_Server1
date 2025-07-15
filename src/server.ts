/**********************************************************************
 *  Jokes MCP Server – streamable transport (Copilot Studio-ready)   *
 *********************************************************************/

import express from "express";
import { z } from "zod";
import fetchOrig from "node-fetch";
import { randomUUID } from "crypto";   // For sessionIdGenerator

// ------------------------------------------------------------------
// 0.  Make global fetch() work on Node < 18
if (!globalThis.fetch) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  globalThis.fetch = fetchOrig as unknown as typeof fetch;
}

// ------------------------------------------------------------------
// 1.  MCP SDK
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const mcp = new McpServer({
  name:        "jokes-mcp",
  version:     "2.0.0",
  description: "Chuck Norris & Dad jokes exposed as MCP tools",
});

// ------------------------------------------------------------------
// 2.  Helpers
type ToolText = { content: { type: "text"; text: string }[] };
const text = (t: string): ToolText => ({ content: [{ type: "text", text: t }] });
const fetchJSON = async <T>(url: string): Promise<T> => (await fetch(url)).json();

// ------------------------------------------------------------------
// 3.  Tools   (3rd arg = raw Zod shape, not z.object)
mcp.tool("getChuckJoke", "Random Chuck Norris joke", {}, async () => {
  const { value } = await fetchJSON<{ value: string }>("https://api.chucknorris.io/jokes/random");
  return text(value);
});

mcp.tool(
  "getChuckJokeByCategory",
  "Chuck Norris joke from a given category",
  { category: z.string() },
  async ({ category }: { category: string }) => {
    const { value } = await fetchJSON<{ value: string }>(
      `https://api.chucknorris.io/jokes/random?category=${encodeURIComponent(category)}`,
    );
    return text(value);
  },
);

mcp.tool("getChuckCategories", "List Chuck Norris joke categories", {}, async () => {
  const cats = await fetchJSON<string[]>("https://api.chucknorris.io/jokes/categories");
  return text(cats.join(", "));
});

mcp.tool("getDadJoke", "Random Dad joke", {}, async () => {
  const resp = await fetch("https://icanhazdadjoke.com/", { headers: { Accept: "text/plain" } });
  return text(await resp.text());
});

// ------------------------------------------------------------------
// 4.  Express bridge
const app = express();

// ctor now needs a sessionIdGenerator
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
});

// MCP endpoint (no body-parser!)
app.all("/mcp", (req, res) => {
  transport.handleRequest(req, res, req);
});

// Health probe
app.get("/health", (_req, res) => {
  res.status(200).send("OK");
});

// Root
app.get("/", (_req, res) => {
  res.send("Jokes MCP Server – see /api/swagger.json");
});

// Swagger 2.0  (minimal, MCP-flagged)
const swaggerDoc = {
  swagger: "2.0",
  info: {
    title:       "Jokes MCP Server",
    description: "Streamable MCP endpoint for Copilot Studio",
    version:     "2.0.0",
  },
  host:     "<replace-with-your-host>.azurewebsites.net",
  basePath: "/",
  schemes:  ["https"],
  paths: {
    "/mcp": {
      post: {
        summary:                 "Streamable MCP endpoint",
        operationId:             "InvokeMcp",
        "x-ms-agentic-protocol": "mcp-streamable-1.0",
        responses: { "200": { description: "Success" } },
      },
    },
  },
};

app.get("/api/swagger.json", (_req, res) => {
  res.json(swaggerDoc);
});

// ------------------------------------------------------------------
// 5.  Start server
(async () => {
  await mcp.connect(transport);
  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, () => console.log(`MCP server listening on port ${PORT}`));
})();
