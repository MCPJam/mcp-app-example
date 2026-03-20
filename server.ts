import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  CallToolResult,
  ReadResourceResult,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const DIST_DIR = import.meta.filename.endsWith(".ts")
  ? path.join(import.meta.dirname, "dist")
  : import.meta.dirname;

export function createServer(): McpServer {
  const server = new McpServer({
    name: "IO Explainer",
    version: "1.0.0",
  });

  const resourceUri = "ui://io-explainer/mcp-app.html";

  registerAppTool(
    server,
    "create-status-card",
    {
      title: "Create Status Card",
      description:
        "Creates a visual status card. This tool demonstrates how tool inputs " +
        "become UI elements and how structured outputs reflect the rendered state. " +
        "The accompanying UI annotates every input→visual and output→visual mapping.",
      inputSchema: z.object({
        title: z
          .string()
          .describe("Card heading displayed prominently at the top"),
        message: z
          .string()
          .describe("Body text shown beneath the title"),
        status: z
          .enum(["success", "warning", "error", "info"])
          .describe("Determines the card's icon and color scheme"),
        progress: z
          .number()
          .min(0)
          .max(100)
          .describe("Fills the progress bar from 0–100%"),
      }),
      outputSchema: z.object({
        title: z.string(),
        message: z.string(),
        status: z.string(),
        progress: z.number(),
        statusEmoji: z.string(),
        progressLabel: z.string(),
        timestamp: z.string(),
      }),
      _meta: { ui: { resourceUri } },
    },
    async ({ title, message, status, progress }): Promise<CallToolResult> => {
      const emojiMap: Record<string, string> = {
        success: "\u2705",
        warning: "\u26A0\uFE0F",
        error: "\u274C",
        info: "\u2139\uFE0F",
      };
      const statusEmoji = emojiMap[status] ?? "\u2139\uFE0F";
      const progressLabel = `${progress}% complete`;
      const timestamp = new Date().toISOString();

      return {
        content: [
          {
            type: "text",
            text: `${statusEmoji} ${title} — ${progressLabel}`,
          },
        ],
        structuredContent: {
          title,
          message,
          status,
          progress,
          statusEmoji,
          progressLabel,
          timestamp,
        },
      };
    },
  );

  registerAppResource(
    server,
    resourceUri,
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(
        path.join(DIST_DIR, "mcp-app.html"),
        "utf-8",
      );
      return {
        contents: [
          { uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html },
        ],
      };
    },
  );

  return server;
}
