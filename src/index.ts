import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import mcpAppHtml from "../dist/mcp-app.html";
import authorizeHtml from "../dist/authorize.html";

const RESOURCE_URI = "ui://mcp-demo/mcp-app.html";

export class MyMCP extends McpAgent {
  server = new McpServer({
    name: "MCP App Demo",
    version: "1.0.0",
  });

  async init() {
    registerAppTool(
      this.server,
      "display-mcp-app",
      {
        title: "Display MCP App",
        description:
          "Renders a minimal interactive card inside the host UI. " +
          "Pass a title and body to see how tool I/O maps to a live visual.",
        inputSchema: z.object({
          title: z.string().describe("Heading shown at the top of the card"),
          body: z.string().describe("Supporting text displayed below the heading"),
        }),
        outputSchema: z.object({
          title: z.string(),
          body: z.string(),
          renderedAt: z.string(),
        }),
        _meta: { ui: { resourceUri: RESOURCE_URI } },
      },
      async ({ title, body }) => {
        const renderedAt = new Date().toISOString();
        return {
          content: [
            {
              type: "text" as const,
              text: `${title} — ${body}`,
            },
          ],
          structuredContent: { title, body, renderedAt },
        };
      },
    );

    registerAppResource(
      this.server,
      RESOURCE_URI,
      RESOURCE_URI,
      { mimeType: RESOURCE_MIME_TYPE },
      async () => ({
        contents: [
          {
            uri: RESOURCE_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text: mcpAppHtml,
          },
        ],
      }),
    );

    // ── Sample Tool (standard SDK method) ─────────────────────────
    // Contrast with registerAppTool above: no UI resource, just I/O.
    this.server.tool(
      "greet",
      "Returns a friendly greeting for the given name",
      {
        name: z.string().describe("The name of the person to greet"),
      },
      async ({ name }) => ({
        content: [
          {
            type: "text" as const,
            text: `Hello, ${name}! Welcome to the MCP App Demo server.`,
          },
        ],
      }),
    );

    // ── Sample Prompt ─────────────────────────────────────────────
    // Prompts are reusable message templates that clients can discover
    // and fill in with parameters.
    this.server.prompt(
      "explain-concept",
      "Generates a prompt asking for a clear explanation of a concept",
      {
        concept: z.string().describe("The concept or topic to explain"),
        audience: z
          .enum(["beginner", "intermediate", "expert"])
          .describe("Target audience level"),
      },
      async ({ concept, audience }) => ({
        description: `Explain "${concept}" for a ${audience} audience`,
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text:
                `Please explain the concept of "${concept}" ` +
                `in a way that is appropriate for a ${audience}-level audience. ` +
                `Use clear language, relevant examples, and keep it concise.`,
            },
          },
        ],
      }),
    );

    // ── Sample Resource ───────────────────────────────────────────
    // Resources expose read-only data that clients can fetch by URI.
    this.server.resource(
      "server-info",
      "info://mcp-demo/server-info",
      {
        description: "General information about this MCP demo server",
        mimeType: "text/plain",
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain",
            text:
              "MCP App Demo Server v1.0.0\n" +
              "==========================\n\n" +
              "This is an educational MCP server demonstrating the three core primitives:\n\n" +
              "1. Tools     – Functions the client can invoke (e.g., 'greet', 'display-mcp-app')\n" +
              "2. Prompts   – Reusable message templates (e.g., 'explain-concept')\n" +
              "3. Resources – Read-only data the client can fetch (e.g., this document)\n\n" +
              "Built with:\n" +
              "  - @modelcontextprotocol/sdk\n" +
              "  - @modelcontextprotocol/ext-apps\n" +
              "  - Cloudflare Workers (agents package)\n" +
              "  - Zod for schema validation\n",
          },
        ],
      }),
    );
  }
}

// ── Auth helpers ──────────────────────────────────────────────────

function getResourceMetadataUrl(request: Request): string {
  const url = new URL(request.url);
  return `${url.origin}/.well-known/oauth-protected-resource`;
}

function unauthorized(request: Request): Response {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "WWW-Authenticate": `Bearer resource_metadata="${getResourceMetadataUrl(request)}"`,
    },
  });
}

async function verifyToken(token: string, env: Env): Promise<boolean> {
  try {
    const issuer = env.STYTCH_DOMAIN;
    const jwksUrl = new URL("/.well-known/jwks.json", env.STYTCH_DOMAIN);
    const jwks = createRemoteJWKSet(jwksUrl);
    await jwtVerify(token, jwks, { issuer });
    return true;
  } catch {
    return false;
  }
}

// ── Worker entrypoint ────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // RFC 9728 — Protected Resource Metadata
    if (
      url.pathname === "/.well-known/oauth-protected-resource" ||
      url.pathname === "/.well-known/oauth-protected-resource/mcp"
    ) {
      return new Response(
        JSON.stringify({
          resource: `${url.origin}/mcp`,
          authorization_servers: [`${env.STYTCH_DOMAIN}/`],
          scopes_supported: ["openid", "email", "profile"],
          bearer_methods_supported: ["header"],
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // Proxy Stytch's OAuth Authorization Server Metadata
    if (
      url.pathname === "/.well-known/oauth-authorization-server" ||
      url.pathname === "/.well-known/oauth-authorization-server/mcp"
    ) {
      const res = await fetch(
        new URL("/.well-known/oauth-authorization-server", env.STYTCH_DOMAIN),
      );
      const metadata = await res.json();
      return new Response(JSON.stringify(metadata), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Stytch IdentityProvider — OAuth authorize + login pages
    if (url.pathname === "/oauth/authorize" || url.pathname === "/login") {
      return new Response(authorizeHtml, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // MCP endpoint — require Bearer token
    if (url.pathname === "/mcp") {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return unauthorized(request);
      }

      const token = authHeader.slice(7);
      const valid = await verifyToken(token, env);
      if (!valid) {
        return unauthorized(request);
      }

      return MyMCP.serve("/mcp").fetch(request, env, ctx);
    }

    // Simple landing page
    return new Response(
      `<html><body style="font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0">
        <div style="text-align:center">
          <h1>MCP App Demo</h1>
          <p>Connect to this server at <code>/mcp</code></p>
        </div>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  },
};
