import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import mcpAppHtml from "../dist/mcp-app.html";

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
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/mcp") {
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
