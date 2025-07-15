// --------------------------------------------------------------
//  MCP Server (Streamable HTTP) – Jokes Tools (Fixed API signatures)
// --------------------------------------------------------------
//  • Uses @modelcontextprotocol/sdk v0.4.x (TypeScript)
//  • Correct mcp.tool() overload: name → description → paramsSchema → handler
//  • Removes unsupported mcp.tools property (SDK hasn’t exposed it yet)
// --------------------------------------------------------------

import express from "express";
import { z } from "zod";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// For Node <18 poly‑fill global fetch (safe no‑op on newer runtimes)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import fetch from "node-fetch";

// --------------------------------------------------------------
// 1️⃣  Build the MCP server and register tools
// --------------------------------------------------------------

const mcp = new McpServer({ name: "jokes-mcp-server", version: "2.0.0" });

mcp.tool(
  "get-chuck-joke",                                 // 🔹 tool name
  "Random Chuck Norris joke",                      // 🔹 description (2nd arg)
  {},                                               // 🔹 input schema (empty)
  async () => {
    const data: any = await (await fetch("https://api.chucknorris.io/jokes/random")).json();
    return { content: [{ type: "text", text: data.value }] };
  }
);

mcp.tool(
  "get-chuck-joke-by-category",
  "Chuck joke (by category)",
  { category: z.string() },                          // expects { category: string }
  async ({ category }) => {
    const url = `https://api.chucknorris.io/jokes/random?category=${encodeURIComponent(category)}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Invalid category");
    const data: any = await resp.json();
    return { content: [{ type: "text", text: data.value }] };
  }
);

mcp.tool(
  "get-chuck-categories",
  "Chuck categories list",
  {},
  async () => {
    const data: string[] = await (await fetch("https://api.chucknorris.io/jokes/categories")).json();
    return {
      content: [{ type: "text", text: `Available categories: ${data.join(", ")}` }]
    };
  }
);

mcp.tool(
  "get-dad-joke",
  "Random Dad joke",
  {},
  async () => {
    const data: any = await (
      await fetch("https://icanhazdadjoke.com/", { headers: { Accept: "application/json" } })
    ).json();
    return { content: [{ type: "text", text: data.joke }] };
  }
);

// --------------------------------------------------------------
// 2️⃣  Wire Streamable HTTP transport to Express
// --------------------------------------------------------------

const transport = new StreamableHTTPServerTransport();
// It’s fine to ignore the returned promise; connect happens immediately.
// No top‑level await = compatible with CommonJS builds.
mcp.connect(transport);

const app = express();
app.all("/mcp", (req, res) => transport.handleRequest(req, res, req));

// --------------------------------------------------------------
// 3️⃣  Health & metadata endpoints
// --------------------------------------------------------------

app.get("/health", (_req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

app.get("/", (_req, res) => {
  res.json({ name: "Jokes MCP Server", version: "2.0.0", tools: 4 });
});

// --------------------------------------------------------------
// 4️⃣  Minimal Swagger for Power Platform custom connector
// --------------------------------------------------------------

app.get("/api/swagger.json", (req, res) => {
  const host = (req.headers["x-forwarded-host"] as string) ?? req.get("host") ?? "localhost:3000";
  const swagger = {
    swagger: "2.0",
    info: {
      title: "Jokes MCP Server",
      description: "Model Context Protocol endpoint (streamable)",
      version: "2.0.0"
    },
    host,
    basePath: "/",
    schemes: ["https", "http"],
    paths: {
      "/mcp": {
        post: {
          summary: "MCP Streamable endpoint",
          operationId: "InvokeMcp",
          "x-ms-agentic-protocol": "mcp-streamable-1.0",
          responses: { "200": { description: "Success" } }
        }
      }
    }
  };
  res.json(swagger);
});

// --------------------------------------------------------------
// 5️⃣  Start the HTTP server
// --------------------------------------------------------------

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`🚀 MCP server listening on http://localhost:${PORT}`);
  console.log("Registered tools: get-chuck-joke, get-chuck-joke-by-category, get-chuck-categories, get-dad-joke");
});
