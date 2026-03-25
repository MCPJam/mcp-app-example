import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./global.css";
import "./mcp-app.css";

// ── DOM refs ──

const mainEl = document.querySelector(".main") as HTMLElement;
const waitingEl = document.getElementById("waiting")!;
const streamingEl = document.getElementById("streaming")!;
const streamingJson = document.getElementById("streaming-json")!;
const cardEl = document.getElementById("card")!;
const cardTitle = document.getElementById("card-title")!;
const cardBody = document.getElementById("card-body")!;
const cardTime = document.getElementById("card-time")!;

function show(el: HTMLElement) { el.classList.remove("hidden"); }
function hide(el: HTMLElement) { el.classList.add("hidden"); }

// ── MCP App lifecycle ──

const app = new App({ name: "MCP App Demo", version: "1.0.0" });

app.ontoolinputpartial = (params) => {
  hide(waitingEl);
  show(streamingEl);
  hide(cardEl);
  try {
    streamingJson.textContent = JSON.stringify(params.arguments, null, 2);
  } catch {
    streamingJson.textContent = String(params.arguments);
  }
  streamingJson.scrollTop = streamingJson.scrollHeight;
};

app.ontoolinput = (params) => {
  hide(waitingEl);
  hide(streamingEl);
  show(cardEl);

  const args = (params.arguments ?? {}) as { title?: string; body?: string };
  cardTitle.textContent = args.title ?? "";
  cardBody.textContent = args.body ?? "";
  cardTime.textContent = "";
};

app.ontoolresult = (result: CallToolResult) => {
  const out = (result.structuredContent ?? {}) as { renderedAt?: string };
  if (out.renderedAt) {
    cardTime.textContent = out.renderedAt;
  }
};

app.ontoolcancelled = () => {
  hide(streamingEl);
  hide(cardEl);
  show(waitingEl);
};

app.onerror = console.error;
app.onteardown = async () => ({});

// ── Host styling ──

function handleHostContext(ctx: McpUiHostContext): void {
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
  if (ctx.safeAreaInsets) {
    mainEl.style.paddingTop = `${ctx.safeAreaInsets.top}px`;
    mainEl.style.paddingRight = `${ctx.safeAreaInsets.right}px`;
    mainEl.style.paddingBottom = `${ctx.safeAreaInsets.bottom}px`;
    mainEl.style.paddingLeft = `${ctx.safeAreaInsets.left}px`;
  }
}

app.onhostcontextchanged = handleHostContext;

app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) handleHostContext(ctx);
});
