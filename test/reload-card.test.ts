import assert from "node:assert/strict";
import test from "node:test";
import registerReloadCard, {
  PI_RELOAD_MESSAGE,
  patchReloadContainerPrototype,
  renderReloadCard,
  type ReloadCardTheme,
} from "../reload-card.ts";

const plainTheme: ReloadCardTheme = {
  fg: (_color, text) => text,
  bg: (_color, text) => text,
  bold: (text) => text,
};

test("reload card matches the standardized padded card geometry", () => {
  const backgrounds: string[] = [];
  const theme: ReloadCardTheme = {
    ...plainTheme,
    bg: (color, text) => {
      backgrounds.push(color);
      return text;
    },
  };

  const lines = renderReloadCard(80, theme);
  assert.equal(lines.length, 4);
  assert.ok(lines.every((line) => [...line].length === 80));
  assert.equal(lines[1]?.trim(), "reload");
  assert.equal(lines[2]?.trim(), "");
  assert.equal(lines[3]?.trim(), "Reloading Pi configuration and resources…");
  assert.ok(backgrounds.every((color) => color === "toolPendingBg"));
});

test("reload patch changes only Pi's exact reload container and is idempotent", () => {
  let nativeCalls = 0;
  const prototype = {
    render(width: number) {
      nativeCalls++;
      return [`native:${width}`];
    },
  };

  patchReloadContainerPrototype(prototype, () => plainTheme);
  const patchedRender = prototype.render;
  patchReloadContainerPrototype(prototype, () => plainTheme);
  assert.equal(prototype.render, patchedRender, "does not stack wrappers");

  assert.deepEqual(prototype.render.call({ children: [] }, 40), ["native:40"]);
  const reload = prototype.render.call(
    { children: [{ text: `\x1b[38;2;128;128;128m${PI_RELOAD_MESSAGE}\x1b[39m` }] },
    40,
  );
  assert.equal(reload.length, 4);
  assert.equal(reload[1]?.trim(), "reload");
  assert.equal(nativeCalls, 1, "target rendering bypasses the native border box");
  assert.deepEqual(
    prototype.render.call({ children: [{ text: `${PI_RELOAD_MESSAGE} changed` }] }, 40),
    ["native:40"],
    "nearby text does not broaden the patch target",
  );
});

test("reload patch fails open until a theme is available", () => {
  const prototype = {
    render(width: number) {
      return [`native:${width}`];
    },
  };
  patchReloadContainerPrototype(prototype, () => undefined);
  assert.deepEqual(
    prototype.render.call({ children: [{ text: PI_RELOAD_MESSAGE }] }, 20),
    ["native:20"],
  );
});

test("reload registration preserves the last theme between runtime generations", () => {
  const prototype = {
    render(width: number) {
      return [`native:${width}`];
    },
  };
  const target = { children: [{ text: PI_RELOAD_MESSAGE }] };
  const fakePi = () => {
    const sessionStartHandlers: Array<(event: unknown, ctx: unknown) => void> = [];
    return {
      api: {
        on(event: string, handler: (event: unknown, ctx: unknown) => void) {
          if (event === "session_start") sessionStartHandlers.push(handler);
        },
      },
      start(theme: ReloadCardTheme) {
        for (const handler of sessionStartHandlers) {
          handler({ reason: "reload" }, { ui: { theme } });
        }
      },
    };
  };
  const themed = (prefix: string): ReloadCardTheme => ({
    fg: (_color, text) => text,
    bg: (_color, text) => `${prefix}:${text}`,
    bold: (text) => text,
  });

  const first = fakePi();
  registerReloadCard(first.api as never, prototype);
  first.start(themed("first"));
  assert.ok(prototype.render.call(target, 40)[0]?.startsWith("first:"));

  const replacement = fakePi();
  registerReloadCard(replacement.api as never, prototype);
  assert.ok(
    prototype.render.call(target, 40)[0]?.startsWith("first:"),
    "re-registration does not erase the active reload theme",
  );

  replacement.start(themed("replacement"));
  assert.ok(prototype.render.call(target, 40)[0]?.startsWith("replacement:"));
});
