import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import hypaExtension from "@hypabolic/pi-hypa/extensions/index.ts";
import toolDisplayExtension from "pi-tool-display";

/**
 * Load both extensions against the same API instance. pi-tool-display can then
 * decorate Hypa's tool definitions before Pi snapshots their renderers.
 */
export default function toolDisplayBridge(pi: ExtensionAPI): void {
  toolDisplayExtension(pi as never);
  hypaExtension(pi);
}
