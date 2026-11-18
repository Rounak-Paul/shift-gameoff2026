import test from "node:test";
import assert from "node:assert/strict";
import { generate, matches, hint, collapse, rotated, shifted, SIZE } from "../src/engine.js";
import { LEVELS, LevelRun } from "../src/levels.js";
import { loadProfile, saveProfile } from "../src/profile.js";

test("every authored level starts repeatably without matches and has a productive move", () => {
  for (const level of LEVELS) {
    const first = new LevelRun(level), second = new LevelRun(level);
    const grid = generate(first.random);
    assert.deepEqual(grid, generate(second.random));
    assert.deepEqual(matches(grid), []);
    assert.ok(hint(grid), `Level ${level.id} has a productive opening`);
    const indices = hint(grid);
    const cells = [0, 6, 12];
    assert.deepEqual(collapse(grid, cells, first.random), collapse(grid, cells, second.random));
    assert.ok(first.goals.length > 0 && indices);
  }
});

test("goals count unique symbols and brass spaces across cascades, with final-move victory", () => {
  const run = new LevelRun({ id: 1, seed: 1, moves: 1, score: 90, collect: [5, 3], marks: [0, 1, 2] });
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(5));
  run.recordShift();
  run.recordMatch(grid, [0, 1, 2, 2], 1);
  assert.equal(run.score, 30);
  assert.equal(run.collected[5], 3);
  assert.equal(run.goals.at(-1).current, 3);
  assert.equal(run.result, null);
  run.recordMatch(grid, [0, 1, 2], 2);
  assert.equal(run.finish(), "won");
  assert.equal(run.score, 90);
  run.recordMatch(grid, [3, 4, 5], 1);
  assert.equal(run.score, 90);
});

test("turns rotate brass backing without spending moves and incomplete attempts lose", () => {
  const run = new LevelRun({ seed: 1, moves: 1, marks: [0] });
  run.turn(1);
  assert.equal(run.marks[0][5], true);
  assert.equal(run.moves, 0);
  run.turn(-1);
  assert.equal(run.marks[0][0], true);
  run.recordShift();
  assert.equal(run.finish(), "lost");
});

test("profile rejects invalid preferences, duplicate progress, and unavailable storage", () => {
  const storage = { getItem: () => JSON.stringify({ sound: "false", volume: 8, motion: "other", particles: false, completed: [1, 1, -1, 99, "2"] }) };
  assert.deepEqual(loadProfile(storage), { sound: true, volume: 1, motion: "system", particles: false, completed: [1] });
  const blocked = { getItem() { throw Error(); }, setItem() { throw Error(); } };
  assert.equal(loadProfile(blocked).motion, "system");
  assert.equal(saveProfile({}, blocked), false);
});

/** Plays an authored level by prioritizing immediate objective progress through all four orientations. */
function solve(level) {
  const run = new LevelRun(level);
  let grid = generate(run.random);
  while (!run.result) {
    let choice = null;
    let oriented = grid, marks = run.marks;
    for (let turns = 0; turns < 4; turns++) {
      for (let row = 0; row < SIZE; row++)
        for (let count = 1; count < SIZE; count++) {
          const next = oriented.map((line) => [...line]);
          next[row] = shifted(next[row], count);
          const cells = matches(next);
          let value = cells.length;
          for (const index of cells) {
            const r = Math.floor(index / SIZE), c = index % SIZE;
            if (marks[r][c]) value += 1000;
            if (level.collect && run.collected[level.collect[0]] < level.collect[1] && next[r][c] === level.collect[0]) value += 50;
          }
          if (!choice || value > choice.value) choice = { turns, row, count, value };
        }
      oriented = rotated(oriented, 1);
      marks = rotated(marks, 1);
    }
    for (let i = 0; i < choice.turns; i++) { grid = rotated(grid, 1); run.turn(1); }
    grid[choice.row] = shifted(grid[choice.row], choice.count);
    run.recordShift();
    let chain = 0, cells;
    while ((cells = matches(grid)).length) {
      assert.ok(chain < 100, "cascade terminates");
      run.recordMatch(grid, cells, ++chain);
      grid = collapse(grid, cells, run.random).grid;
    }
    run.finish();
  }
  return run;
}

test("every campaign level has a verified winning sequence within its move budget", () => {
  for (const level of LEVELS) {
    const run = solve(level);
    assert.equal(run.result, "won", `Level ${level.id}: ${run.goals.map((goal) => `${goal.label} ${goal.current}/${goal.target}`).join(", ")}`);
  }
});
