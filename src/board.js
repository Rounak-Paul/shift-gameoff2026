export const BOARD = Object.freeze({
  size: 600,
  center: 300,
  origin: 84,
  pitch: 72,
  count: 6,
});

/** Maps grid coordinates u/v into canvas coordinates after a screen-plane turn. */
export function project(u, v, angle = 0) {
  const x = (u - 3) * BOARD.pitch,
    y = (v - 3) * BOARD.pitch;
  return {
    x: BOARD.center + x * Math.cos(angle) - y * Math.sin(angle),
    y: BOARD.center + x * Math.sin(angle) + y * Math.cos(angle),
  };
}

/** Maps a canvas point into the resting grid; captured drags can extend beyond its edges. */
export function unproject(x, y) {
  const u = (x - BOARD.origin) / BOARD.pitch,
    v = (y - BOARD.origin) / BOARD.pitch;
  return {
    u,
    v,
    inside: u >= 0 && u < BOARD.count && v >= 0 && v < BOARD.count,
  };
}

/** Leaves room for the cartridge corners as it passes through a diagonal orientation. */
export function turnScale(angle) {
  return 1 / (1 + 0.14 * Math.abs(Math.sin(angle * 2)));
}
