import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type Tool = {
  name: string;
  renderCall?: (...args: any[]) => { render(width: number): string[] };
  renderResult?: (...args: any[]) => { render(width: number): string[] };
  [key: string]: unknown;
};

type EventHandler = (event: { reason: string }) => void;

const theme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

test("bridge decorates Hypa snapshots from explicit config and cleans interception across reloads", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "pi-tool-display-bridge-"));
  const agentDir = join(tempDir, "agent");
  const hypaConfig = join(tempDir, "hypa.json");
  const displayConfigDir = join(agentDir, "extensions", "pi-tool-display");
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  const previousHypaConfig = process.env.HYPA_PI_CONFIG;
  mkdirSync(displayConfigDir, { recursive: true });
  writeFileSync(
    join(displayConfigDir, "config.json"),
    JSON.stringify({
      customToolOverrides: {
        hypa_shell: {
          enabled: true,
          kind: "generic",
          outputMode: "hidden",
          preserveCallRenderer: true,
        },
      },
    }),
    "utf8",
  );
  writeFileSync(hypaConfig, JSON.stringify({ mode: "additive", mcpProxyEnabled: false }), "utf8");
  process.env.PI_CODING_AGENT_DIR = agentDir;
  process.env.HYPA_PI_CONFIG = hypaConfig;

  try {
    // Import after setting both environment variables: pi-tool-display resolves
    // its config path during module evaluation, while Hypa reads its config on load.
    const { default: bridge } = await import("../index.ts");
    const tools = new Map<string, Tool>();
    let hypaShellRegistrationCount = 0;
    const events = new Map<string, EventHandler[]>();
    const builtins = ["read", "edit", "grep", "find", "ls", "bash"].map((name) => ({
      name,
      description: `Built-in ${name}`,
      sourceInfo: { source: "builtin", path: `<builtin:${name}>` },
    }));
    const api = {
      registerTool(tool: Tool) {
        // Model Pi snapshotting the definition during registration.
        if (tool.name === "hypa_shell") hypaShellRegistrationCount++;
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
      on(event: string, handler: EventHandler) {
        const handlers = events.get(event) ?? [];
        handlers.push(handler);
        events.set(event, handlers);
      },
    } as unknown as ExtensionAPI;
    const originalRegisterTool = api.registerTool;

    bridge(api);
    assert.notEqual(api.registerTool, originalRegisterTool, "display interceptor is installed");

    const hypaShell = tools.get("hypa_shell");
    assert.ok(hypaShell);
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

    for (const handler of events.get("session_shutdown") ?? []) {
      handler({ reason: "reload" });
    }
    assert.equal(api.registerTool, originalRegisterTool, "reload restores the original registration function");

    bridge(api);
    const firstReloadWrapper = api.registerTool;
    const hypaShellRegistrationsBeforeDoubleLoad = hypaShellRegistrationCount;
    bridge(api);
    assert.notEqual(api.registerTool, firstReloadWrapper, "double-load disposes the previous registration generation");
    assert.equal(
      hypaShellRegistrationCount,
      hypaShellRegistrationsBeforeDoubleLoad + 1,
      "the new generation registers one freshly decorated Hypa shell definition",
    );
    const reloadedHypaShell = tools.get("hypa_shell");
    assert.ok(reloadedHypaShell);
    assert.equal(
      reloadedHypaShell.renderCall?.({ command: "git status" }, theme)?.render(120).join("\n").trim(),
      "hypa_shell $ git status",
    );
    assert.equal(
      reloadedHypaShell.renderResult?.(
        { content: [{ type: "text", text: "noisy output" }], details: {} },
        { expanded: false, isPartial: false },
        theme,
      )?.render(120).join("\n").trim(),
      "",
    );
  } finally {
    restoreEnvironment("PI_CODING_AGENT_DIR", previousAgentDir);
    restoreEnvironment("HYPA_PI_CONFIG", previousHypaConfig);
    rmSync(tempDir, { recursive: true, force: true });
  }
});
