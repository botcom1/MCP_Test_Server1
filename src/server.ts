/**********************************************************************
 * Jokes MCP Server – Streamable HTTP (Copilot Studio-ready)          *
 *********************************************************************/

import express, { Request, Response, RequestHandler } from "express";
import { z } from "zod";
import fetchOrig from "node-fetch";

// -------------------------------------------------------------------
// 0. Ensure global fetch on Node < 18
if (!globalThis.fetch) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  globalThis.fetch = fetchOrig as unknown as typeof fetch;
}

// -------------------------------------------------------------------
// 1. MCP SDK
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const mcp = new McpServer({
  name: "jokes-mcp",
  version: "2.0.0",
  description: "Chuck Norris & Dad jokes exposed as MCP tools",
});

// -------------------------------------------------------------------
// 2. Tool registration  (raw-shape objects, NOT z.object)
// — Chuck Norris random
mcp.tool(
  "getChuckJoke",
  "Returns a random Chuck Norris joke",
  {}, // <-- no-param shape
  async () => formatText(await fetchChuck("random")),
);

// — Chuck Norris by category
mcp.tool(
  "getChuckJokeByCategory",
  "Returns a Chuck Norris joke from the specified category",
  { category: z.string() }, // one-param shape
  async ({ category }: { category: string }) =>
    formatText(await fetchChuck(`random?category=${encodeURIComponent(category)}`)),
);

// — List categories
mcp.tool(
  "getChuckCategories",
  "Lists all available Chuck Norris joke categories",
  {},
  async () => formatText((await fetchChuck("categories")).join(", ")),
);

// — Dad joke
mcp.tool(
  "getDadJoke",
  "Returns a random Dad joke",
  {},
  async () => {
    const txt = await (await fetch("https://icanhazdadjoke.com/", {
      headers: { Accept: "text/plain" },
    })).text();
    return formatText(txt);
  },
);

// Helpers ------------------------------------------------------------
async function fetchChuck(path: string): Promise<any> {
  const rsp = await fetch(`https://api.chucknorris.io/jokes/${path}`);
  return rsp.headers.get("content-type")?.includes("application/json")
    ? rsp.json()
    : rsp.text();
}

const formatText = (text: string) =>
  ({ content: [{ type: "text", text }] } as const);

// -------------------------------------------------------------------
// 3. Express bridge
const app = express();
const transport = new StreamableHTTPServerTransport();

// MCP endpoint (no body-parser)
app.all("/mcp", ((req: Request, res: Response) =>
  transport.handleRequest(req, res, req)) as RequestHandler);

// Health probe
app.get("/health", ((_req, res) => res.status(200).send("OK")) as RequestHandler);

// Mini home-page
app.get("/", ((_req, res) =>
  res.send("Jokes MCP Server – see /api/swagger.json")) as RequestHandler);

// Swagger (OpenAPI 2.0) served as JSON
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
app.get("/api/swagger.json", ((_req, res) => res.json(swaggerDoc)) as RequestHandler);

// -------------------------------------------------------------------
// 4
