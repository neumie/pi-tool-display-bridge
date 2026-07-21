import {
  type ExtensionAPI,
  UserMessageComponent,
} from "@earendil-works/pi-coding-agent";

export const PI_RELOAD_MESSAGE =
  "Reloading keybindings, extensions, skills, prompts, themes, and context files...";

const RELOAD_CARD_MESSAGE = "Reloading Pi configuration and resources…";
const RELOAD_CARD_PATCH_VERSION = 2;
const ANSI_CONTROL_SEQUENCE_PATTERN = /\x1b\[[0-?]*[ -/]*[@-~]/g;

export interface ReloadCardTheme {
  fg(color: "accent" | "muted", text: string): string;
  bg(color: "toolPendingBg", text: string): string;
  bold?(text: string): string;
}

type ReloadRender = (this: unknown, width: number) => string[];

interface ReloadPatchState {
  version: number;
  originalRender: ReloadRender;
  getTheme(): ReloadCardTheme | undefined;
  lastTheme?: ReloadCardTheme;
}

export interface PatchableReloadContainerPrototype {
  render: ReloadRender;
  __neumieReloadCardPatch?: ReloadPatchState;
}

function truncatePlain(text: string, width: number): string {
  if (width <= 0) return "";
  const characters = [...text];
  if (characters.length <= width) return text;
  if (width === 1) return "…";
  return `${characters.slice(0, width - 1).join("")}…`;
}

function cardRow(options: {
  raw: string;
  styled: string;
  width: number;
  horizontalPadding: number;
  theme: ReloadCardTheme;
}): string {
  const { raw, styled, width, horizontalPadding, theme } = options;
  const fill = Math.max(0, width - horizontalPadding * 2 - [...raw].length);
  const row = `${" ".repeat(horizontalPadding)}${styled}${" ".repeat(fill + horizontalPadding)}`;
  return theme.bg("toolPendingBg", row);
}

/** Render the reload placeholder with the same geometry as other message cards. */
export function renderReloadCard(
  width: number,
  theme: ReloadCardTheme,
): string[] {
  const safeWidth = Number.isFinite(width) ? Math.max(0, Math.floor(width)) : 0;
  if (safeWidth === 0) return [];
  const horizontalPadding = safeWidth >= 3 ? 1 : 0;
  const contentWidth = Math.max(0, safeWidth - horizontalPadding * 2);
  const blank = theme.bg("toolPendingBg", " ".repeat(safeWidth));
  const rawLabel = truncatePlain("reload", contentWidth);
  const label = theme.fg("accent", theme.bold?.(rawLabel) ?? rawLabel);
  const rawMessage = truncatePlain(RELOAD_CARD_MESSAGE, contentWidth);
  const message = theme.fg("muted", rawMessage);
  return [
    blank,
    cardRow({ raw: rawLabel, styled: label, width: safeWidth, horizontalPadding, theme }),
    blank,
    cardRow({ raw: rawMessage, styled: message, width: safeWidth, horizontalPadding, theme }),
  ];
}

function isPiReloadContainer(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const children = (value as { children?: unknown }).children;
  if (!Array.isArray(children)) return false;
  return children.some((child) => {
    if (child === null || typeof child !== "object") return false;
    const text = (child as { text?: unknown }).text;
    return (
      typeof text === "string" &&
      text.replace(ANSI_CONTROL_SEQUENCE_PATTERN, "") === PI_RELOAD_MESSAGE
    );
  });
}

/** Install an idempotent, exact-message-scoped renderer patch. */
export function patchReloadContainerPrototype(
  prototype: PatchableReloadContainerPrototype,
  getTheme: () => ReloadCardTheme | undefined,
): void {
  const existing = prototype.__neumieReloadCardPatch;
  if (existing?.version === RELOAD_CARD_PATCH_VERSION) {
    existing.lastTheme = getTheme() ?? existing.lastTheme;
    existing.getTheme = getTheme;
    return;
  }
  if (existing) prototype.render = existing.originalRender;
  if (typeof prototype.render !== "function") return;

  const state: ReloadPatchState = {
    version: RELOAD_CARD_PATCH_VERSION,
    originalRender: prototype.render,
    getTheme,
    lastTheme: getTheme(),
  };
  prototype.__neumieReloadCardPatch = state;
  prototype.render = function renderWithReloadCard(width: number): string[] {
    const current = prototype.__neumieReloadCardPatch;
    if (!current || !isPiReloadContainer(this)) {
      return (current?.originalRender ?? state.originalRender).call(this, width);
    }
    const theme = current.getTheme() ?? current.lastTheme;
    if (!theme) return current.originalRender.call(this, width);
    current.lastTheme = theme;
    try {
      return renderReloadCard(width, theme);
    } catch {
      return current.originalRender.call(this, width);
    }
  };
}

/** Keep the patch active across reload while refreshing its theme context. */
export default function registerReloadCard(
  pi: ExtensionAPI,
  hostContainerPrototype: PatchableReloadContainerPrototype | null = Object.getPrototypeOf(
    UserMessageComponent.prototype,
  ) as PatchableReloadContainerPrototype | null,
): void {
  let activeTheme: ReloadCardTheme | undefined;
  const patch = () => {
    if (!hostContainerPrototype || typeof hostContainerPrototype.render !== "function") return;
    patchReloadContainerPrototype(hostContainerPrototype, () => activeTheme);
  };
  patch();
  pi.on("session_start", (_event, ctx) => {
    activeTheme = ctx.ui.theme as unknown as ReloadCardTheme;
    patch();
  });
}
