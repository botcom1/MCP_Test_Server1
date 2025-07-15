/**********************************************************************
 * Jokes MCP Server – streamable transport (Copilot Studio-ready)    *
 *********************************************************************/

import express from "express";
import { z } from "zod";
import fetchOrig from "node-fetch";

// ------------------------------------------------------
// 0.  Make global  fetch()  work on Node <18 containers
if (!globalThis.fetch) {
  // @ts-ignore – node-fetch’s CJS default
  globalThis.fetch = fetchOrig as unknown as typeof fetch;
}

// ------------------------------------------------------
// 1.  MCP SDK
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const mcp = new McpServer({
  name: "jokes-mcp",
  version: "2.0.0",
  description: "Chuck Norris & Dad jokes exposed as MCP tools",
});

// ------------------------------------------------------
// 2.  Helper – wrap plain text into MCP response shape
type ToolTextResponse = {
  content: { type: "text"; text: string }[];
};
const text = (t: string): ToolTextResponse => ({
  content: [{ type: "text", text: t }],
});

// ------------------------------------------------------
// 3.  Register tools  (NOTE: 3rd arg is **raw Zod-shape**)

// 3.1 Chuck Norris random joke  (no params)
mcp.tool("getChuckJoke", "Random Chuck Norris joke", {}, async () => {
  const { value } = await fetchJSON<{ value: string }>(
    "https://api.chucknorris.io/jokes/random",
  );
  return text(value);
});

// 3.2 Chuck Norris joke by category
mcp.tool(
  "getChuckJokeByCategory",
  "Chuck Norris joke from a given category",
  { category: z.string() },
  async ({ category }: { category: string }) => {
    const { value } = await fetchJSON<{ value: string }>(
      `https://api.chucknorris.io/jokes/random?category=${encodeURIComponent(
        category,
      )}`,
    );
    return text(value);
  },
);

// 3.3 List Chuck joke categories
mcp.tool("getChuckCategories", "List Chuck categories", {}, async () => {
  const cats = await fetchJSON<string[]>(
    "https://api.chucknorris.io/jokes/categories",
  );
  return text(cats.join(", "));
});

// 3.4 Dad joke
mcp.tool("getDadJoke", "Random Dad joke", {}, async () => {
  const resp = await fetch("https://icanhazdadjoke.com/", {
    headers: { Accept: "text/plain" },
  });
  return text(await resp.text());
});

// ------------------------------------------------------
// 4.  Express bridge
const app = express();
const transport = new StreamableHTTPServerTransport();

// MCP endpoint – no body-parser!
app.all("/mcp", (req, res) => transport.handleRequest(req, res, req));

// Health probe
app.get("/health", (_req, res) => res.status(200).send("OK"));

// Root
app.get("/", (_req, res) =>
  res.send("Jokes MCP Server – see /api/swagger.json"),
);

// Minimal Swagger 2.0 with MCP flag
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
app.get("/api/swagger.json", (_req, res) => res.json(swaggerDoc));

// ------------------------------------------------------
// 5.  Startup
(async () => {
  await mcp.connect(transport);
  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, () => console.log(`MCP server listening on ${PORT}`));
})();

// ------------------------------------------------------
// 6.  Small JSON helper
async function fetchJSON<T>(url: string): Promise<T> {
  const r = await fetch(url);
  return r.json() as Promise<T>;
}
