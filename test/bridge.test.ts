import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import bridge from "../index.ts";

type Tool = {
  name: string;
  renderCall?: (...args: any[]) => { render(width: number): string[] };
  renderResult?: (...args: any[]) => { render(width: number): string[] };
  [key: string]: unknown;
};

const theme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

test("Hypa tools use pi-tool-display renderers when loaded through the bridge", () => {
  const tools = new Map<string, Tool>();
  const builtins = ["read", "edit", "grep", "find", "ls", "bash"].map((name) => ({
    name,
    description: `Built-in ${name}`,
    sourceInfo: { source: "builtin", path: `<builtin:${name}>` },
  }));
  const api = {
    registerTool(tool: Tool) {
      // Model Pi snapshotting the definition during registration.
      tools.set(tool.name, { ...tool });
    },
    getAllTools() {
      return [...builtins, ...tools.values()];
    },
    getActiveTools() {
      return [...tools.keys()];
    },
    setActiveTools() {},
    registerCommand() {},
    on() {},
  } as unknown as ExtensionAPI;

  bridge(api);

  const hypaShell = tools.get("hypa_shell");
  assert.ok(hypaShell);
  assert.equal(typeof hypaShell.renderCall, "function");
  assert.equal(typeof hypaShell.renderResult, "function");
  assert.equal(
    hypaShell.renderCall?.({ command: "git status" }, theme)?.render(120).join("\n").trim(),
    "hypa_shell $ git status",
  );
  assert.equal(
    hypaShell.renderResult?.(
      { content: [{ type: "text", text: "noisy output" }], details: {} },
      { expanded: false, isPartial: false },
      theme,
    )?.render(120).join("\n").trim(),
    "",
  );
});
