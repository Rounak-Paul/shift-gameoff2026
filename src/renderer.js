import { SIZE } from "./engine.js";
import { BOARD, turnScale, slidePosition } from "./board.js";

export const COLORS = [
  "#bd573e",
  "#ae8325",
  "#547646",
  "#2b7e7b",
  "#52689c",
  "#a25477",
];
const TILE_SIZE = 64;

const GLYPHS = [
  ["0001000", "0101010", "0011100", "1111111", "0011100", "0101010", "0001000"],
  ["0001000", "0011100", "0111110", "1111111", "0111110", "0011100", "0001000"],
  ["0110110", "1111111", "1111111", "0011100", "1111111", "1111111", "0110110"],
  ["0000000", "0110011", "1111110", "1101100", "0110011", "1111110", "1101100"],
  ["0001100", "0011100", "0111000", "1111111", "0001110", "0011100", "0011000"],
  ["0110110", "1111111", "1111111", "1111111", "0111110", "0011100", "0001000"],
];

/** Fills a rounded rectangle with the current canvas fill style. */
function rect(ctx, x, y, width, height, radius = 2) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

/** Draws the tile’s printed seven-pixel symbol. */
function glyph(ctx, kind) {
  ctx.fillStyle = COLORS[kind];
  const pixel = 5;
  for (let y = 0; y < 7; y++)
    for (let x = 0; x < 7; x++)
      if (GLYPHS[kind][y][x] === "1")
        ctx.fillRect((x - 3.5) * pixel, (y - 3.5) * pixel, pixel, pixel);
}

/** Draws one shallow bakelite tile at x/y with its printed symbol and face bevel. */
function tile(
  ctx,
  kind,
  x,
  y,
  angle,
  scale = 1,
  alpha = 1,
  highlight = false,
  selected = false,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-angle);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#0c242a";
  rect(ctx, -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, 4);
  ctx.fillStyle = "#a8ad92";
  rect(ctx, -31, -30, 62, 61, 3);
  const finish = ctx.createLinearGradient(0, -31, 0, 27);
  finish.addColorStop(0, selected ? "#f5e4b9" : "#eee5c8");
  finish.addColorStop(1, selected ? "#dfc99b" : "#d5d0ae");
  ctx.fillStyle = finish;
  rect(ctx, -31, -31, 62, 58, 3);
  ctx.strokeStyle = "#fbf0d3b3";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#b4b498";
  ctx.fillRect(-27, 25, 54, 1);
  if (highlight) {
    ctx.strokeStyle = "#fff4b0";
    ctx.lineWidth = 3;
    ctx.strokeRect(-29, -29, 58, 54);
  }
  ctx.translate(0, -2);
  glyph(ctx, kind);
  ctx.restore();
}

/** Draws cartridge rails, retaining a square silhouette through quarter turns. */
function cartridge(ctx) {
  ctx.shadowColor = "#03131c";
  ctx.shadowBlur = 17;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = "#728b7e";
  rect(ctx, 65, 65, 470, 470, 7);
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#293f43";
  rect(ctx, 69, 69, 462, 462, 5);
  ctx.strokeStyle = "#cbd3ae7a";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#102a31";
  rect(ctx, 78, 78, 444, 444, 2);
  for (const x of [73, 527])
    for (const y of [73, 527]) {
      ctx.fillStyle = "#122b30";
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#b7bd9c80";
      ctx.beginPath();
      ctx.moveTo(x - 1, y);
      ctx.lineTo(x + 1, y);
      ctx.stroke();
    }
}

/** Draws recessed side channels only for row, with warm rails when active or hinted. */
function gutters(ctx, row, active, hinting, pulse) {
  if (row < 0) return;
  const y = BOARD.origin + row * BOARD.pitch,
    width = BOARD.origin;
  const end = BOARD.origin + SIZE * BOARD.pitch;
  for (const x of [0, end]) {
    ctx.fillStyle = "#526e66";
    rect(ctx, x - 2, y + 1, width + 4, 70, 3);
    ctx.fillStyle = "#1c383c";
    rect(ctx, x, y + 3, width, 66, 1);
    ctx.fillStyle = "#081e28";
    rect(ctx, x + 1, y + 4, width - 2, 64, 2);
    const shade = ctx.createLinearGradient(x, 0, x + width, 0);
    shade.addColorStop(0, x === 0 ? "#020e18" : "#203b3c");
    shade.addColorStop(1, x === 0 ? "#203b3c" : "#020e18");
    ctx.fillStyle = shade;
    rect(ctx, x + 2, y + 6, width - 4, 60, 1);
    ctx.fillStyle =
      active || hinting ? `rgba(229,184,112,${pulse})` : "#9bab8f";
    ctx.fillRect(x + 2, y + 3, width - 4, 1);
    ctx.fillRect(x + 2, y + 68, width - 4, 1);
    ctx.fillStyle = "#102c34";
    for (let i = 0; i < 5; i++) ctx.fillRect(x + 12 + i * 14, y + 32, 4, 8);
  }
}

/** Extends the selected row's brass guide rails across the board and its side gutters. */
function rowSelector(ctx, row, active, hinting) {
  const y = BOARD.origin + row * BOARD.pitch,
    bright = active || hinting;
  ctx.fillStyle = bright ? "#b28d493d" : "#b6b38820";
  rect(ctx, 80, y + 1, 440, 71, 1);
  const rail = ctx.createLinearGradient(84, 0, 516, 0);
  rail.addColorStop(0, bright ? "#d2a65e" : "#899b80");
  rail.addColorStop(0.5, bright ? "#e6c88a70" : "#a2b39636");
  rail.addColorStop(1, bright ? "#d2a65e" : "#899b80");
  ctx.fillStyle = rail;
  ctx.fillRect(84, y + 1, 432, 1);
  ctx.fillRect(84, y + 71, 432, 1);
}

/** Shades the gutter mouths over moving tiles, so they pass beneath the cartridge's side lips. */
function gutterLips(ctx, row) {
  if (row < 0) return;
  const y = BOARD.origin + row * BOARD.pitch,
    width = BOARD.origin;
  const end = BOARD.origin + SIZE * BOARD.pitch;
  for (const x of [0, end]) {
    const shade = ctx.createLinearGradient(x, 0, x + width, 0);
    shade.addColorStop(0, x === 0 ? "#051620e6" : "#05162000");
    shade.addColorStop(1, x === 0 ? "#05162000" : "#051620e6");
    ctx.fillStyle = shade;
    ctx.fillRect(x, y + 5, width, 62);
    ctx.fillStyle = "#9aaa8870";
    ctx.fillRect(x === 0 ? x : x + width - 2, y + 7, 2, 58);
    ctx.fillStyle = "#071b24";
    ctx.fillRect(x === 0 ? x + 2 : x + width - 4, y + 7, 2, 58);
  }
}

/** Renders the flat sliding cartridge from gameplay state; console layout remains DOM-owned. */
export function renderBoard(ctx, state) {
  const {
    size,
    dpr,
    grid,
    mode,
    row,
    offset,
    cell,
    angle,
    clearCells,
    phase,
    fallDistances,
    focusRow,
    focusActive,
    reducedMotion,
    hintRow,
    hintCount,
    time,
  } = state;
  const units = size / BOARD.size,
    rotationScale = turnScale(angle);
  const cosine = Math.abs(Math.cos(angle));
  const sine = Math.abs(Math.sin(angle));
  // Keep upright tiles within the spacing of the turning grid.
  const tileFit = Math.min(
    1,
    BOARD.pitch / (TILE_SIZE * (cosine + sine)),
  );
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.scale(units, units);
  ctx.translate(300, 300);
  ctx.rotate(angle);
  ctx.scale(rotationScale, rotationScale);
  ctx.translate(-300, -300);
  cartridge(ctx);
  const visibleFocus = mode === "rotate" ? -1 : focusRow;
  const hinting = hintRow === visibleFocus && visibleFocus >= 0;
  const pulse =
    hinting && !reducedMotion ? 0.7 + 0.3 * Math.sin(time * 0.006) : 1;
  gutters(ctx, visibleFocus, focusActive, hinting, pulse);
  if (visibleFocus >= 0) rowSelector(ctx, visibleFocus, focusActive, hinting);
  if (hinting) {
    const y = BOARD.origin + focusRow * BOARD.pitch;
    ctx.fillStyle = "#f8d295";
    ctx.font = "bold 15px Courier New";
    ctx.textAlign = "center";
    ctx.fillText(
      `${hintCount > 0 ? "→" : "←"}${Math.abs(hintCount)}`,
      hintCount > 0 ? 548 : 52,
      y - 4,
    );
  }
  ctx.save();
  if (mode !== "rotate") {
    ctx.beginPath();
    ctx.rect(0, BOARD.origin, BOARD.size, BOARD.pitch * SIZE + 4);
    ctx.clip();
  }
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      let u = c + 0.5,
        v = r + 0.5,
        scale = 1,
        alpha = 1;
      const sliding = (mode === "drag" || mode === "settle") && r === row;

      if (mode === "clear" && clearCells.includes(r * SIZE + c)) {
        const t = reducedMotion
          ? Math.min(phase / 0.08, 1)
          : Math.max(0, Math.min((phase - 0.07) / 0.25, 1));
        scale = 1 - t * 0.85;
        alpha = 1 - t;
      }
      if (mode === "fall" && fallDistances) {
        const t = Math.min(phase / (reducedMotion ? 0.08 : 0.5), 1);
        v -= Math.pow(1 - t, 3) * fallDistances[r][c];
      }
      const position = sliding
        ? slidePosition(c, offset / cell)
        : { x: BOARD.origin + u * BOARD.pitch, visible: true };
      if (!position.visible) continue;
      const y = BOARD.origin + v * BOARD.pitch;
      tile(
        ctx,
        grid[r][c],
        position.x,
        y,
        angle,
        scale * tileFit,
        alpha,
        mode === "clear" && clearCells.includes(r * SIZE + c),
        r === visibleFocus,
      );
    }
  ctx.restore();
  gutterLips(ctx, visibleFocus);
  ctx.restore();
}
