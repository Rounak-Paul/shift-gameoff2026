export const SIZE = 6;
export const KINDS = 6;

/** Wraps an integer index into a positive range of length n. */
export function wrap(index, n = SIZE) {
  return ((index % n) + n) % n;
}

/** Returns row cyclically shifted right by count cells. */
export function shifted(row, count) {
  return row.map((_, i) => row[wrap(i - count, row.length)]);
}

/** Returns grid rotated one quarter-turn in direction (1 clockwise, -1 counterclockwise). */
export function rotated(grid, direction) {
  const n = grid.length;
  return grid.map((row, r) =>
    row.map((_, c) =>
      direction === 1 ? grid[n - c - 1][r] : grid[c][n - r - 1],
    ),
  );
}

/** Returns unique cell indices belonging to straight runs of at least three. */
export function matches(grid) {
  const found = new Set(),
    n = grid.length;
  for (let axis = 0; axis < 2; axis++)
    for (let line = 0; line < n; line++) {
      let start = 0;
      for (let end = 1; end <= n; end++) {
        const value = (i) => (axis ? grid[i][line] : grid[line][i]);
        if (end < n && value(end) === value(start)) continue;
        if (end - start >= 3 && value(start) !== null)
          for (let i = start; i < end; i++)
            found.add(axis ? i * n + line : line * n + i);
        start = end;
      }
    }
  return [...found];
}

/** Generates a random board without existing matches using random() in [0, 1). */
export function generate(random = Math.random) {
  const grid = Array.from({ length: SIZE }, () => []);
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const choices = Array.from({ length: KINDS }, (_, i) => i).filter(
        (k) =>
          !(c > 1 && grid[r][c - 1] === k && grid[r][c - 2] === k) &&
          !(r > 1 && grid[r - 1][c] === k && grid[r - 2][c] === k),
      );
      grid[r][c] = choices[Math.floor(random() * choices.length)];
    }
  return grid;
}

/** Removes cells and refills from above; returns grid and per-cell fall distances. */
export function collapse(grid, cells, random = Math.random) {
  const n = grid.length,
    removed = new Set(cells);
  const next = grid.map((row) => [...row]),
    distances = grid.map((row) => row.map(() => 0));
  for (let c = 0; c < n; c++) {
    let target = n - 1;
    for (let r = n - 1; r >= 0; r--)
      if (!removed.has(r * n + c)) {
        next[target][c] = grid[r][c];
        distances[target][c] = target - r;
        target--;
      }
    const added = target + 1;
    while (target >= 0) {
      next[target][c] = Math.floor(random() * KINDS);
      distances[target][c] = added;
      target--;
    }
  }
  return { grid: next, distances };
}

/** Finds a row shift that makes a match, considering both board orientations. */
export function hint(grid) {
  for (const turn of [0, 1]) {
    const board = turn ? rotated(grid, 1) : grid;
    for (let row = 0; row < SIZE; row++)
      for (let count = 1; count < SIZE; count++) {
        const next = board.map((r) => [...r]);
        next[row] = shifted(next[row], count);
        if (matches(next).length)
          return { turn, row, count: count > 3 ? count - SIZE : count };
      }
  }
  return null;
}
