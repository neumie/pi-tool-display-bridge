# pi-tool-display bridge

A small local Pi package that loads [`pi-tool-display`](https://github.com/MasuRii/pi-tool-display) and [`@hypabolic/pi-hypa`](https://github.com/Hypabolic/Hypa) through the same Pi extension API instance.

Pi normally gives each extension a separate API object. Sharing one instance lets `pi-tool-display` decorate Hypa's tool definitions before Pi registers them, so `customToolOverrides` such as hidden `hypa_*` results work without modifying Hypa.

## Usage

Add this package to Pi settings instead of loading `pi-tool-display` and `@hypabolic/pi-hypa` separately:

```json
{
  "packages": [
    "/absolute/path/to/pi-tool-display-bridge"
  ]
}
```

Configuration remains in `~/.pi/agent/extensions/pi-tool-display/config.json`.
