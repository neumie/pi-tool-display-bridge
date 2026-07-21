# pi-tool-display bridge

Private Neumie bridge package that loads the maintained [`pi-tool-display` fork](https://github.com/neumie/pi-tool-display) and upstream [`@hypabolic/pi-hypa`](https://github.com/Hypabolic/Hypa) through one Pi extension API instance. It retains upstream attribution while pinning the required fork revision in `package-lock.json`.

Pi normally gives each extension a separate API object. Sharing one instance lets `pi-tool-display` decorate Hypa tool definitions before Pi snapshots their renderers. `preserveCallRenderer: true` retains Hypa's native command/path header while replacing only verbose result bodies.

## Installation

Clone this repository, install its pinned dependencies, and verify it from a clean checkout:

```bash
git clone https://github.com/neumie/pi-tool-display-bridge.git
cd pi-tool-display-bridge
npm ci --ignore-scripts
npm run check
```

Requires Node.js 22.19.0 or later. This package is intentionally private; install it from a local path rather than npm.

Add this package to Pi settings **instead of** separately loading `pi-tool-display` or `@hypabolic/pi-hypa`:

```json
{
  "packages": [
    "/absolute/path/to/pi-tool-display-bridge"
  ]
}
```

## Required display configuration

Save the following as `$PI_CODING_AGENT_DIR/extensions/pi-tool-display/config.json` (or `~/.pi/agent/extensions/pi-tool-display/config.json` when `PI_CODING_AGENT_DIR` is unset), then run `/reload`:

```json
{
  "customToolOverrides": {
    "hypa_shell": { "enabled": true, "kind": "generic", "outputMode": "hidden", "preserveCallRenderer": true },
    "hypa_read": { "enabled": true, "kind": "generic", "outputMode": "hidden", "preserveCallRenderer": true },
    "hypa_grep": { "enabled": true, "kind": "generic", "outputMode": "hidden", "preserveCallRenderer": true },
    "hypa_find": { "enabled": true, "kind": "generic", "outputMode": "hidden", "preserveCallRenderer": true },
    "hypa_ls": { "enabled": true, "kind": "generic", "outputMode": "hidden", "preserveCallRenderer": true }
  }
}
```

`hidden` is recommended for stock Hypa tools because their native call headers retain the useful command/path context. Use `summary` or `preview` if result text should remain visible. `hypa_mcp_proxy`, when enabled in Hypa, is a separate MCP proxy: configure it explicitly as `kind: "mcp"` if you want compact display behavior.

Do not load another copy of Hypa or pi-tool-display alongside this bridge; duplicate extension registration can defeat deterministic renderer ownership.
