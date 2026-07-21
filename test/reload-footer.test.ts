import assert from "node:assert/strict";
import test from "node:test";
import {
  patchReloadFooterPrototype,
  type PatchableFooterPrototype,
} from "../reload-footer.ts";

const placeholder = ["", ""];

test("built-in footer is replaced by height-matched rows until custom mount", () => {
  let nativeCalls = 0;
  const prototype: PatchableFooterPrototype = {
    render(width: number) {
      nativeCalls++;
      return [`native:${width}`];
    },
  };
  const suppression = patchReloadFooterPrototype(prototype);
  const card = {};
  assert.deepEqual(prototype.render(80), ["native:80"]);

  suppression.showReloadCard(card);
  assert.deepEqual(prototype.render(80), placeholder);
  assert.deepEqual(prototype.render(80), placeholder);

  suppression.customFooterMounted(2);
  assert.deepEqual(prototype.render(80), ["native:80"]);
  assert.equal(nativeCalls, 2);
});

test("footer patch is idempotent and preserves pending suppression", () => {
  const prototype: PatchableFooterPrototype = {
    render: () => ["native"],
  };
  const first = patchReloadFooterPrototype(prototype);
  const patchedRender = prototype.render;
  first.showReloadCard({});

  const replacement = patchReloadFooterPrototype(prototype);
  assert.equal(prototype.render, patchedRender);
  assert.deepEqual(prototype.render(80), placeholder);

  replacement.customFooterMounted(3);
  replacement.showReloadCard({});
  assert.deepEqual(prototype.render(80), ["", "", ""]);
  replacement.reset();
  assert.deepEqual(prototype.render(80), ["native"]);
});

test("one reload card cannot replenish the bounded fail-open budget", () => {
  const prototype: PatchableFooterPrototype = {
    render: () => ["native"],
  };
  const suppression = patchReloadFooterPrototype(prototype);
  const card = {};
  suppression.customFooterMounted(99);

  for (let index = 0; index < 16; index++) {
    suppression.showReloadCard(card);
    assert.equal(prototype.render(80).length, 10);
  }
  suppression.showReloadCard(card);
  assert.deepEqual(prototype.render(80), ["native"]);

  suppression.showReloadCard({});
  assert.equal(prototype.render(80).length, 10, "a distinct reload gets a fresh budget");
});

test("beginReload covers lifecycle orderings where no card rendered yet", () => {
  const prototype: PatchableFooterPrototype = {
    render: () => ["native"],
  };
  const suppression = patchReloadFooterPrototype(prototype);
  suppression.beginReload();
  assert.deepEqual(prototype.render(80), placeholder);
  suppression.reset();
  assert.deepEqual(prototype.render(80), ["native"]);
});
