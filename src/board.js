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
  return 1 / (1 + 0.16 * Math.abs(Math.sin(angle * 2)));
}

/** Returns a hysteretic magnetic detent and its small elastic offset for raw drag distance in cells. */
export function magneticTarget(raw, detent) {
  const threshold = 0.56;
  if (raw - detent > threshold) detent = Math.floor(raw + 1 - threshold);
  else if (raw - detent < -threshold) detent = Math.ceil(raw - 1 + threshold);
  detent = Math.max(-BOARD.count, Math.min(BOARD.count, detent)) || 0;
  const tension = Math.max(-threshold, Math.min(threshold, raw - detent));
  return { detent, cells: detent + tension * 0.18 };
}

/** Interpolates a transit segment with endpoint tangents measured over its normalized duration. */
function transit(t, from, to, startSpeed, endSpeed) {
  const t2 = t * t,
    t3 = t2 * t;
  return (
    from +
    (to - from) * (3 * t2 - 2 * t3) +
    startSpeed * (t3 - 2 * t2 + t) +
    endSpeed * (t3 - t2)
  );
}

/** Maps column and row offset to one tile instance, completing exit before opposite-side entry. */
export function slidePosition(column, cells) {
  const phase = (((column + cells) % BOARD.count) + BOARD.count) % BOARD.count;
  const first = BOARD.origin + BOARD.pitch / 2;
  const last = first + (BOARD.count - 1) * BOARD.pitch;
  if (phase <= BOARD.count - 1)
    return { x: first + phase * BOARD.pitch, visible: true };
  const handoff = phase - (BOARD.count - 1);
  if (handoff <= 0.25)
    return { x: last + handoff * BOARD.pitch, visible: true };
  if (handoff < 0.46)
    return {
      x: transit(
        (handoff - 0.25) / 0.21,
        last + 0.25 * BOARD.pitch,
        BOARD.size + 34,
        BOARD.pitch * 0.21,
        0,
      ),
      visible: true,
    };
  if (handoff <= 0.54) return { x: BOARD.size + 34, visible: false };
  return {
    x: transit((handoff - 0.54) / 0.46, -34, first, 0, BOARD.pitch * 0.46),
    visible: true,
  };
}
