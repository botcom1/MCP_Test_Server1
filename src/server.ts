/**********************************************************************
 * Jokes MCP Server – Streamable HTTP (Copilot Studio–ready)
 *********************************************************************/

import express, { RequestHandler, Request, Response } from "express";
import { z } from "zod";
import fetchOrig from "node-fetch";

// Ensure global fetch on Node <18
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (!globalThis.fetch) globalThis.fetch = fetchOrig as unknown as typeof fetch;

// --- MCP SDK --------------------------------------------------------
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// -------------------------------------------------------------------
// 1. Build server & tools
const mcp = new McpServer({
  name: "jokes-mcp",
  version: "2.0.0",
  description: "Chuck Norris & Dad jokes exposed as MCP tools",
});

// Chuck Norris random joke
mcp.tool(
  "getChuckJoke",
  "Returns a random Chuck Norris joke",
  z.object({}), // no params
  async (): Promise<ReturnType<typeof formatText>> => {
    const rsp = await fetch("https://api.chucknorris.io/jokes/random");
    const { value } = (await rsp.json()) as { value: string };
    return formatText(value);
  },
);

// Chuck Norris joke by category
const categorySchema = z.object({ category: z.string() });
mcp.tool(
  "getChuckJokeByCategory",
  "Returns a Chuck Norris joke from the specified category",
  categorySchema,
  async (
    { category }: z.infer<typeof categorySchema>,
  ): Promise<ReturnType<typeof formatText>> => {
    const rsp = await fetch(
      `https://api.chucknorris.io/jokes/random?category=${encodeURIComponent(
        category,
      )}`,
    );
    const { value } = (await rsp.json()) as { value: string };
    return formatText(value);
  },
);

// List Chuck joke categories
mcp.tool(
  "getChuckCategories",
  "Lists all available Chuck Norris joke categories",
  z.object({}), // no params
  async (): Promise<ReturnType<typeof formatText>> => {
    const rsp = await fetch("https://api.chucknorris.io/jokes/categories");
    const cats = (await rsp.json()) as string[];
    return formatText(cats.join(", "));
  },
);

// Dad joke
mcp.tool(
  "getDadJoke",
  "Returns a random Dad joke",
  z.object({}), // no params
  async (): Promise<ReturnType<typeof formatText>> => {
    const rsp = await fetch("https://icanhazdadjoke.com/", {
      headers: { Accept: "text/plain" },
    });
    const joke = await rsp.text();
    return formatText(joke);
  },
);

// Helper to wrap plain text responses
function formatText(text: string) {
  return { content: [{ type: "text", text }] } as const;
}

// -------------------------------------------------------------------
// 2. Express bridge
const app = express();

// Streamable HTTP transport (stateless for simplicity)
const transport = new StreamableHTTPServerTransport();

// POST (or ANY) to /mcp → SDK transport
app.all(
  "/mcp",
  ((req: Request, res: Response) =>
    transport.handleRequest(req, res, req)) as RequestHandler,
);

// Health probe
app.get(
  "/health",
  ((_req: Request, res: Response): void => {
    res.status(200).send("OK");
  }) as RequestHandler,
);

// Tiny home page
app.get(
  "/",
  ((_req: Request, res: Response): void => {
    res
      .status(200)
      .send("Jokes MCP Server is running – see /api/swagger.json for spec");
  }) as RequestHandler,
);

// Minimal Swagger (OpenAPI 2.0) – note the MCP flag
const swaggerDoc = {
  swagger: "2.0",
  info: {
    title: "Jokes MCP Server",
    description: "Streamable MCP endpoint for Copilot Studio",
    version: "2.0.0",
  },
  host: "<replace-with-your-host>.azurewebsites.net",
  b
