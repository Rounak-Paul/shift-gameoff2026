import test from "node:test";
import assert from "node:assert/strict";
import { renderBoard } from "../src/renderer.js";
import { SIZE } from "../src/engine.js";

test("renders every tile with a finite scale at rest and during a turn", () => {
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  for (const angle of [0, -Math.PI / 4, Math.PI / 4, Math.PI / 2]) {
    let tileFaces = 0;
    const ctx = new Proxy({
      scale(x, y) {
        assert.ok(Number.isFinite(x) && x > 0);
        assert.ok(Number.isFinite(y) && y > 0);
      },
      createLinearGradient() {
        tileFaces++;
        return { addColorStop() {} };
      },
    }, {
      get(target, key) {
        return target[key] ?? (() => {});
      },
    });
    renderBoard(ctx, { size: 600, dpr: 1, grid, angle,
      mode: angle === 0 ? "idle" : "rotate", focusRow: -1, hintRow: -1 });
    assert.equal(tileFaces, SIZE * SIZE);
  }
});
