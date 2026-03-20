/**
 * MCP App client — shows how tool inputs and outputs map to rendered UI.
 *
 * Lifecycle:
 *   1. ontoolinputpartial → streaming preview of incoming JSON
 *   2. ontoolinput        → final inputs received, render the card + input annotations
 *   3. ontoolresult       → structured output received, render output annotations
 */
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

// ── Status color / emoji maps ──────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  error: "var(--color-error)",
  info: "var(--color-info)",
};

const STATUS_EMOJI: Record<string, string> = {
  success: "\u2705",
  warning: "\u26A0\uFE0F",
  error: "\u274C",
  info: "\u2139\uFE0F",
};

// ── DOM refs ────────────────────────────────────────────────────────────────

const mainEl = document.querySelector(".main") as HTMLElement;
const waitingEl = document.getElementById("waiting")!;
const streamingEl = document.getElementById("streaming")!;
const streamingJson = document.getElementById("streaming-json")!;
const explainerEl = document.getElementById("explainer")!;

const cardStatusBar = document.getElementById("card-status-bar")!;
const cardIcon = document.getElementById("card-icon")!;
const cardTitle = document.getElementById("card-title")!;
const cardMessage = document.getElementById("card-message")!;
const cardProgress = document.getElementById("card-progress")!;
const cardProgressLabel = document.getElementById("card-progress-label")!;
const cardFooter = document.getElementById("card-footer")!;

const inputFields = document.getElementById("input-fields")!;
const outputFields = document.getElementById("output-fields")!;

// ── Helpers ─────────────────────────────────────────────────────────────────

function show(el: HTMLElement) {
  el.classList.remove("hidden");
}
function hide(el: HTMLElement) {
  el.classList.add("hidden");
}

function addField(
  list: HTMLElement,
  name: string,
  value: string,
  mapsTo: string,
  kind: "input" | "output",
): void {
  const li = document.createElement("li");
  li.className = `field-item field-item-${kind}`;
  li.innerHTML = `
    <span class="field-name">${name}</span>
    <span class="field-value">${escapeHtml(value)}</span>
    <span class="field-maps-to">&rarr; ${escapeHtml(mapsTo)}</span>
  `;
  list.appendChild(li);
}

function escapeHtml(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

// ── Render the card from inputs ─────────────────────────────────────────────

interface CardInputs {
  title?: string;
  message?: string;
  status?: string;
  progress?: number;
}

function renderCard(args: CardInputs): void {
  const status = args.status ?? "info";
  const color = STATUS_COLORS[status] ?? STATUS_COLORS.info;

  cardStatusBar.style.background = color;
  cardIcon.textContent = STATUS_EMOJI[status] ?? STATUS_EMOJI.info;
  cardTitle.textContent = args.title ?? "";
  cardMessage.textContent = args.message ?? "";

  const pct = Math.max(0, Math.min(100, args.progress ?? 0));
  cardProgress.style.width = `${pct}%`;
  cardProgress.style.background = color;
  cardProgressLabel.textContent = `${pct}% complete`;
}

// ── Populate input annotations ──────────────────────────────────────────────

function populateInputs(args: CardInputs): void {
  inputFields.innerHTML = "";
  if (args.title != null) {
    addField(inputFields, "title", args.title, "Card heading", "input");
  }
  if (args.message != null) {
    addField(inputFields, "message", args.message, "Body text", "input");
  }
  if (args.status != null) {
    addField(inputFields, "status", args.status, "Icon & color scheme", "input");
  }
  if (args.progress != null) {
    addField(inputFields, "progress", String(args.progress), "Progress bar fill", "input");
  }
}

// ── Populate output annotations ─────────────────────────────────────────────

interface CardOutputs {
  title?: string;
  message?: string;
  status?: string;
  progress?: number;
  statusEmoji?: string;
  progressLabel?: string;
  timestamp?: string;
}

function populateOutputs(out: CardOutputs): void {
  outputFields.innerHTML = "";

  if (out.statusEmoji != null) {
    addField(outputFields, "statusEmoji", out.statusEmoji, "Resolved icon", "output");
  }
  if (out.progressLabel != null) {
    addField(outputFields, "progressLabel", out.progressLabel, "Progress text", "output");
  }
  if (out.timestamp != null) {
    addField(outputFields, "timestamp", out.timestamp, "Card footer", "output");
    cardFooter.textContent = out.timestamp;
  }
  if (out.status != null) {
    addField(outputFields, "status", out.status, "Color theme key", "output");
  }
  if (out.title != null) {
    addField(outputFields, "title", out.title, "Echoed heading", "output");
  }
  if (out.message != null) {
    addField(outputFields, "message", out.message, "Echoed body", "output");
  }
  if (out.progress != null) {
    addField(outputFields, "progress", String(out.progress), "Echoed value", "output");
  }
}

// ── MCP App lifecycle ───────────────────────────────────────────────────────

const app = new App({ name: "IO Explainer", version: "1.0.0" });

// 1. Streaming partial input — show live JSON preview
app.ontoolinputpartial = (params) => {
  hide(waitingEl);
  show(streamingEl);
  hide(explainerEl);

  try {
    streamingJson.textContent = JSON.stringify(params.arguments, null, 2);
  } catch {
    streamingJson.textContent = String(params.arguments);
  }
  streamingJson.scrollTop = streamingJson.scrollHeight;
};

// 2. Final input — render the card + input panel
app.ontoolinput = (params) => {
  hide(waitingEl);
  hide(streamingEl);
  show(explainerEl);

  const args = (params.arguments ?? {}) as CardInputs;
  renderCard(args);
  populateInputs(args);

  // Clear outputs (will fill on result)
  outputFields.innerHTML = "";
  cardFooter.textContent = "";
};

// 3. Tool result — fill the output panel
app.ontoolresult = (result: CallToolResult) => {
  const out = (result.structuredContent ?? {}) as CardOutputs;
  populateOutputs(out);
};

app.ontoolcancelled = () => {
  hide(streamingEl);
  hide(explainerEl);
  show(waitingEl);
};

app.onerror = console.error;

app.onteardown = async () => ({});

// ── Host styling ────────────────────────────────────────────────────────────

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

// ── Connect ─────────────────────────────────────────────────────────────────

app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) handleHostContext(ctx);
});
