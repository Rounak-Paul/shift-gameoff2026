import test from "node:test";
import assert from "node:assert/strict";
import {
  generate,
  matches,
  shifted,
  rotated,
  collapse,
  hint,
  SIZE,
} from "../src/engine.js";

/** Returns a reproducible seeded random source for board tests. */
function seeded(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

test("row shifts wrap both ways without mutating the source", () => {
  const row = [0, 1, 2, 3, 4, 5];
  assert.deepEqual(shifted(row, 1), [5, 0, 1, 2, 3, 4]);
  assert.deepEqual(shifted(row, -1), [1, 2, 3, 4, 5, 0]);
  assert.deepEqual(shifted(row, 12), row);
  assert.deepEqual(shifted(shifted(row, 17), -17), row);
});

test("quarter turns preserve tiles and turn columns into rows", () => {
  const grid = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
  ];
  assert.deepEqual(rotated(grid, 1), [
    [6, 3, 0],
    [7, 4, 1],
    [8, 5, 2],
  ]);
  assert.deepEqual(rotated(rotated(grid, 1), -1), grid);
  let next = grid;
  for (let i = 0; i < 4; i++) next = rotated(next, 1);
  assert.deepEqual(next, grid);
});

test("match detection merges intersections and never joins opposite edges", () => {
  const grid = [
    [0, 1, 0, 2, 3, 0],
    [1, 2, 0, 3, 4, 1],
    [0, 0, 0, 0, 0, 2],
    [3, 4, 0, 1, 2, 3],
    [4, 5, 1, 2, 3, 4],
    [5, 1, 2, 3, 4, 5],
  ];
  assert.deepEqual(
    matches(grid).sort((a, b) => a - b),
    [2, 8, 12, 13, 14, 15, 16, 20],
  );
  assert.deepEqual(
    matches([
      [0, 1, 0],
      [1, 0, 1],
      [0, 1, 0],
    ]),
    [],
  );
});

test("generated boards contain valid kinds and no initial runs", () => {
  const random = seeded(42);
  for (let i = 0; i < 1000; i++) {
    const grid = generate(random);
    assert.equal(grid.length, SIZE);
    assert.deepEqual(matches(grid), []);
    assert.ok(
      grid
        .flat()
        .every((value) => Number.isInteger(value) && value >= 0 && value < 6),
    );
  }
});

test("gravity keeps survivor order and records every fall distance", () => {
  const grid = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
  ];
  const result = collapse(grid, [0, 3], () => 0.5);
  assert.deepEqual(result.grid, [
    [3, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
  ]);
  assert.deepEqual(result.distances, [
    [2, 0, 0],
    [2, 0, 0],
    [0, 0, 0],
  ]);
  assert.deepEqual(grid, [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
  ]);
  assert.deepEqual(collapse(grid, []).grid, grid);
});

test("hints produce actual matches in their indicated orientation", () => {
  const random = seeded(17);
  for (let i = 0; i < 300; i++) {
    const grid = generate(random),
      suggestion = hint(grid);
    if (!suggestion) continue;
    const board = suggestion.turn
      ? rotated(grid, 1)
      : grid.map((row) => [...row]);
    board[suggestion.row] = shifted(board[suggestion.row], suggestion.count);
    assert.ok(matches(board).length >= 3);
  }
});

test("cascades settle to a valid board after repeated clear and refill", () => {
  const random = seeded(113);
  let grid = generate(random),
    moves = 0;
  for (let i = 0; i < 100; i++) {
    const suggestion = hint(grid);
    if (!suggestion) break;
    if (suggestion.turn) grid = rotated(grid, 1);
    grid[suggestion.row] = shifted(grid[suggestion.row], suggestion.count);
    let runs = matches(grid),
      chain = 0;
    while (runs.length && chain++ < 100) {
      grid = collapse(grid, runs, random).grid;
      runs = matches(grid);
    }
    assert.equal(runs.length, 0);
    assert.equal(grid.flat().length, 36);
    moves++;
  }
  assert.ok(moves > 0);
});
