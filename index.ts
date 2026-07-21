import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import hypaExtension from "@hypabolic/pi-hypa/extensions/index.ts";
import toolDisplayExtension from "pi-tool-display";
import registerReloadCard from "./reload-card.js";

/**
 * Load both extensions against the same API instance. pi-tool-display can then
 * decorate Hypa's tool definitions before Pi snapshots their renderers. The
 * private reload-card skin is installed between them without changing order.
 */
export default function toolDisplayBridge(pi: ExtensionAPI): void {
  toolDisplayExtension(pi as never);
  registerReloadCard(pi);
  hypaExtension(pi);
}
