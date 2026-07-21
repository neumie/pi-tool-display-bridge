type FooterRender = (this: unknown, width: number) => string[];

const RELOAD_FOOTER_PATCH_VERSION = 1;
const MAX_RELOAD_FOOTER_SUPPRESSIONS = 16;
const DEFAULT_SESSION_FOOTER_ROWS = 2;
const MAX_SESSION_FOOTER_ROWS = 10;

interface ReloadFooterPatchState {
  version: number;
  originalRender: FooterRender;
  remainingSuppressions: number;
  placeholderRows: number;
  reloadCard?: object;
}

export interface PatchableFooterPrototype {
  render: FooterRender;
  __neumieReloadFooterPatch?: ReloadFooterPatchState;
}

export interface ReloadFooterSuppression {
  showReloadCard(card: object): void;
  beginReload(): void;
  customFooterMounted(rows: number): void;
  reset(): void;
}

function boundedRows(rows: number): number {
  if (!Number.isFinite(rows)) return DEFAULT_SESSION_FOOTER_ROWS;
  return Math.min(MAX_SESSION_FOOTER_ROWS, Math.max(1, Math.floor(rows)));
}

function controls(
  prototype: PatchableFooterPrototype,
  state: ReloadFooterPatchState,
): ReloadFooterSuppression {
  const mutate = (callback: (current: ReloadFooterPatchState) => void) => {
    if (prototype.__neumieReloadFooterPatch === state) callback(state);
  };
  return {
    showReloadCard: (card) => mutate((current) => {
      if (current.reloadCard === card) return;
      current.reloadCard = card;
      current.remainingSuppressions = MAX_RELOAD_FOOTER_SUPPRESSIONS;
    }),
    beginReload: () => mutate((current) => {
      if (!current.reloadCard) {
        current.remainingSuppressions = MAX_RELOAD_FOOTER_SUPPRESSIONS;
      }
    }),
    customFooterMounted: (rows) => mutate((current) => {
      current.placeholderRows = boundedRows(rows);
      current.remainingSuppressions = 0;
      current.reloadCard = undefined;
    }),
    reset: () => mutate((current) => {
      current.remainingSuppressions = 0;
      current.reloadCard = undefined;
    }),
  };
}

/** Replace Pi's built-in reload footer with height-matched blank rows. */
export function patchReloadFooterPrototype(
  prototype: PatchableFooterPrototype,
): ReloadFooterSuppression {
  const existing = prototype.__neumieReloadFooterPatch;
  if (existing?.version === RELOAD_FOOTER_PATCH_VERSION) {
    return controls(prototype, existing);
  }
  if (existing) prototype.render = existing.originalRender;

  const state: ReloadFooterPatchState = {
    version: RELOAD_FOOTER_PATCH_VERSION,
    originalRender: prototype.render,
    remainingSuppressions: 0,
    placeholderRows: DEFAULT_SESSION_FOOTER_ROWS,
  };
  prototype.__neumieReloadFooterPatch = state;
  prototype.render = function renderWithoutReloadFlash(width: number): string[] {
    const current = prototype.__neumieReloadFooterPatch;
    if (!current) return state.originalRender.call(this, width);
    if (current.remainingSuppressions > 0) {
      current.remainingSuppressions--;
      return Array.from({ length: current.placeholderRows }, () => "");
    }
    return current.originalRender.call(this, width);
  };
  return controls(prototype, state);
}
