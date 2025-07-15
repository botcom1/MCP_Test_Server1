// --------------------------------------------------------------
//  MCP Server (Streamable HTTP) – Jokes Tools
//  Uses the official TypeScript SDK + Express wrapper
// --------------------------------------------------------------
//  • Exposes four joke‑related tools  (Chuck Norris + Dad jokes)
//  • Implements the Streamable HTTP transport so Copilot Studio
//    can discover tools automatically.
//  • Generates a minimal OpenAPI file at /api/swagger.json with
//    x‑ms‑agentic‑protocol: mcp‑streamable‑1.0 (no body parameters)
// --------------------------------------------------------------

import express from "express";
import { z } from "zod";

// MCP SDK imports
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// Poly‑fill fetch for Node <18 (optional – harmless if already global)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import fetch from "node-fetch";

// --------------------------------------------------------------
// 1️⃣  Build the MCP server and register tools
// --------------------------------------------------------------

const mcp = new McpServer({ name: "jokes-mcp-server", version: "2.0.0" });

mcp.tool(
  "get-chuck-joke",
  {},
  async () => {
    const data: any = await (await fetch("https://api.chucknorris.io/jokes/random")).json();
    return { content: [{ type: "text", text: data.value }] };
  },
  {
    title: "Random Chuck Norris joke",
    description: "Returns a random Chuck Norris joke"
  }
);

mcp.tool(
  "get-chuck-joke-by-category",
  { category: z.string() },
  async ({ category }) => {
    const url = `https://api.chucknorris.io/jokes/random?category=${encodeURIComponent(category)}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Invalid category");
    const data: any = await resp.json();
    return { content: [{ type: "text", text: data.value }] };
  },
  {
    title: "Chuck joke (by category)",
    description: "Get a Chuck Norris joke for a specific category"
  }
);

mcp.tool(
  "get-chuck-categories",
  {},
  async () => {
    const data: string[] = await (await fetch("https://api.chucknorris.io/jokes/categories")).json();
    return {
      content: [
        {
          type: "text",
          text: `Available categories: ${data.join(", ")}`
        }
      ]
    };
  },
  {
    title: "Chuck categories",
    description: "List all available Chuck Norris joke categories"
  }
);

mcp.tool(
  "get-dad-joke",
  {},
  async () => {
    const data: any = await (
      await fetch("https://icanhazdadjoke.com/", { headers: { Accept: "application/json" } })
    ).json();
    return { content: [{ type: "text", text: data.joke }] };
  },
  {
    title: "Random Dad joke",
    description: "Returns a random Dad joke"
  }
);

// --------------------------------------------------------------
// 2️⃣  Wire the Streamable HTTP transport to Express
// --------------------------------------------------------------

const transport = new StreamableHTTPServerTransport();
await mcp.connect(transport);

const app = express();

// The transport will parse the streamed JSON‑RPC. No body parser!
app.all("/mcp", (req, res) => {
  transport.handleRequest(req, res, req);
});

// --------------------------------------------------------------
// 3️⃣  Health & metadata endpoints
// --------------------------------------------------------------

app.get("/health", (_req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

app.get("/", (_req, res) => {
  res.json({ name: "Jokes MCP Server", version: "2.0.0", tools: mcp.tools.size });
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
          responses: {
            "200": { description: "Success" }
          }
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
  console.table([...mcp.tools.entries()].map(([name, def]) => ({ tool: name, description: def.description })));
});
