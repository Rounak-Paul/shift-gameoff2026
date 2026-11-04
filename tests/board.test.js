import test from "node:test";
import assert from "node:assert/strict";
import {
  BOARD,
  project,
  unproject,
  turnScale,
  magneticTarget,
  slidePosition,
} from "../src/board.js";

test("all tile centers map back to the correct row and column", () => {
  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 6; c++) {
      const p = project(c + 0.5, r + 0.5),
        q = unproject(p.x, p.y);
      assert.ok(q.inside);
      assert.equal(q.u, c + 0.5);
      assert.equal(q.v, r + 0.5);
    }
});

test("quarter turns join the rotated matrix without changing tile positions", () => {
  for (const direction of [-1, 1])
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 6; c++) {
        const p = project(c + 0.5, r + 0.5, (direction * Math.PI) / 2);
        const q =
          direction === 1
            ? project(5 - r + 0.5, c + 0.5)
            : project(r + 0.5, 5 - c + 0.5);
        assert.ok(Math.hypot(p.x - q.x, p.y - q.y) < 1e-9);
      }
});

test("cartridge corners remain visible through both turns", () => {
  for (let step = -100; step <= 100; step++) {
    const angle = ((step / 100) * Math.PI) / 2,
      scale = turnScale(angle);
    for (const x of [65, 535])
      for (const y of [65, 535]) {
        const dx = (x - 300) * scale,
          dy = (y - 300) * scale;
        const u = 300 + dx * Math.cos(angle) - dy * Math.sin(angle),
          v = 300 + dx * Math.sin(angle) + dy * Math.cos(angle);
        assert.ok(u >= 0 && u <= BOARD.size);
        assert.ok(v >= 0 && v <= BOARD.size);
      }
  }
});

test("outside points cannot grab a tile and captured drags retain their full distance", () => {
  assert.equal(unproject(0, 300).inside, false);
  assert.equal(unproject(300, 600).inside, false);
  assert.equal(unproject(BOARD.origin, BOARD.origin).inside, true);
  assert.equal(
    unproject(BOARD.origin + BOARD.pitch * 6, BOARD.origin).inside,
    false,
  );
  assert.equal(unproject(-72, 300).u, (-72 - BOARD.origin) / BOARD.pitch);
});

test("magnetic detents resist small movement, snap past threshold, and reject boundary jitter", () => {
  const resting = magneticTarget(0.3, 0);
  assert.equal(resting.detent, 0);
  assert.ok(resting.cells < 0.1);
  assert.equal(magneticTarget(0.56, 0).detent, 0);
  assert.equal(magneticTarget(0.57, 0).detent, 1);
  assert.equal(magneticTarget(0.5, 1).detent, 1);
  assert.equal(magneticTarget(0.43, 1).detent, 0);
  assert.equal(magneticTarget(-0.57, 0).detent, -1);
  assert.equal(magneticTarget(-0.5, -1).detent, -1);
  assert.equal(magneticTarget(-0.43, -1).detent, 0);
  assert.equal(magneticTarget(50, 0).detent, 6);
  assert.equal(magneticTarget(-50, 0).detent, -6);
});

test("one tile completely exits before its opposite-side entry in either direction", () => {
  const first = BOARD.origin + BOARD.pitch / 2;
  const last = first + 5 * BOARD.pitch;
  const rightExit = slidePosition(5, 0.4599);
  assert.ok(rightExit.x - 32 > BOARD.size);
  assert.equal(slidePosition(5, 0.5).visible, false);
  const leftEntry = slidePosition(5, 0.5401);
  assert.ok(leftEntry.x + 32 < 0);
  assert.equal(slidePosition(5, 1).x, first);
  assert.ok(slidePosition(0, -0.4599).x + 32 < 0);
  assert.equal(slidePosition(0, -0.5).visible, false);
  assert.ok(slidePosition(0, -0.5401).x - 32 > BOARD.size);
  assert.equal(slidePosition(0, -1).x, last);
});

test("single-instance transit is reversible and joins every committed cell without a pop", () => {
  for (let column = 0; column < 6; column++)
    for (let count = -18; count <= 18; count++) {
      const p = slidePosition(column, count);
      const expected = (((column + count) % 6) + 6) % 6;
      assert.equal(p.visible, true);
      assert.equal(p.x, BOARD.origin + (expected + 0.5) * BOARD.pitch);
      const a = slidePosition(column, count - 1e-6),
        b = slidePosition(column, count + 1e-6);
      assert.ok(Math.abs(a.x - p.x) < 0.001);
      assert.ok(Math.abs(b.x - p.x) < 0.001);
    }
});
