import { SIZE, KINDS, rotated } from "./engine.js";

export const SYMBOLS = ["suns", "diamonds", "clovers", "waves", "bolts", "hearts"];
export const LEVELS = Object.freeze([
  { id: 1, name: "First shift", moves: 8, seed: 1701, score: 120, tip: "Slide rows to match three. Every slide uses one move; turns are free." },
  { id: 2, name: "Heart collector", moves: 12, seed: 1702, collect: [5, 9], tip: "Match hearts to fill your order. Other matches can set up your next move." },
  { id: 3, name: "Clear the corners", moves: 14, seed: 1703, marks: [0, 5, 30, 35], tip: "Match on the brass-backed spaces to clear them. Turn the board to reach them." },
  { id: 4, name: "Bright ideas", moves: 14, seed: 1704, score: 300, collect: [4, 9], tip: "Complete both goals. Cascades earn extra points without using more moves." },
  { id: 5, name: "Center stage", moves: 15, seed: 1705, marks: [14, 15, 20, 21], tip: "Clear the center. Free turns change which way tiles fall after a match." },
  { id: 6, name: "Lucky streak", moves: 16, seed: 1706, collect: [2, 18], score: 450, tip: "Collect clovers and build your score. Try setting up more than one match." },
  { id: 7, name: "Around the edge", moves: 20, seed: 1707, marks: [1, 2, 3, 4, 6, 11, 24, 29, 31, 32, 33, 34], tip: "Work around the frame. Cleared backing stays cleared when new tiles fall." },
  { id: 8, name: "Diamond run", moves: 18, seed: 1708, collect: [1, 21], score: 600, tip: "Plan your row shifts. A longer slide still uses just one move." },
  { id: 9, name: "Crossroads", moves: 20, seed: 1709, marks: [2, 8, 12, 13, 14, 15, 16, 17, 20, 26, 32], tip: "Clear the crossing tracks. A match at an intersection can clear both lines." },
  { id: 10, name: "Making waves", moves: 24, seed: 1710, collect: [3, 24], score: 750, tip: "Collect waves and score. A retry starts with the same board and refill sequence." },
  { id: 11, name: "Golden hour", moves: 26, seed: 1711, collect: [0, 24], marks: [7, 10, 14, 15, 20, 21, 25, 28], tip: "Collect suns while clearing the brass spaces. Both goals need to be complete." },
  { id: 12, name: "Full circuit", moves: 24, seed: 1712, score: 1000, marks: [0, 2, 5, 7, 10, 12, 14, 15, 17, 20, 21, 23, 25, 28, 30, 32, 35], tip: "Put it all together. Choose your falling direction before you make a match." },
]);

/** Returns a repeatable random source for the unsigned integer seed. */
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tracks one level attempt independently of rendering, animation, and persistence. */
export class LevelRun {
  /** Initializes a fresh attempt from the authored level definition. */
  constructor(level) {
    this.level = level;
    this.random = seededRandom(level.seed);
    this.moves = 0;
    this.score = 0;
    this.collected = Array(KINDS).fill(0);
    this.marks = Array.from({ length: SIZE }, (_, r) =>
      Array.from({ length: SIZE }, (_, c) => (level.marks || []).includes(r * SIZE + c)),
    );
    this.result = null;
  }

  /** Counts one committed, nonzero row shift; canceled gestures and turns are free. */
  recordShift() {
    if (!this.result) this.moves++;
  }

  /** Records unique matched cell indices in grid at the supplied cascade depth. */
  recordMatch(grid, cells, chain) {
    if (this.result) return;
    const unique = new Set(cells);
    this.score += unique.size * 10 * chain;
    for (const index of unique) {
      const r = Math.floor(index / SIZE), c = index % SIZE;
      this.collected[grid[r][c]]++;
      this.marks[r][c] = false;
    }
  }

  /** Rotates goal backing with the cartridge for the signed quarter-turn direction. */
  turn(direction) {
    this.marks = rotated(this.marks, direction);
  }

  /** Returns current, target and readable label for each goal in this attempt. */
  get goals() {
    const { level } = this;
    const goals = [];
    if (level.score) goals.push({ label: "Score", current: this.score, target: level.score });
    if (level.collect) {
      const [kind, target] = level.collect;
      goals.push({ label: `Collect ${SYMBOLS[kind]}`, current: this.collected[kind], target, kind });
    }
    if (level.marks) goals.push({ label: "Clear brass", current: level.marks.length - this.marks.flat().filter(Boolean).length, target: level.marks.length });
    return goals;
  }

  /** Decides the outcome after all cascades settle; the final move may still win. */
  finish() {
    if (!this.result) {
      if (this.goals.every((goal) => goal.current >= goal.target)) this.result = "won";
      else if (this.moves >= this.level.moves) this.result = "lost";
    }
    return this.result;
  }
}
