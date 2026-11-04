import { SIZE, wrap } from "./engine.js";
import { BOARD, turnScale } from "./board.js";

export const COLORS = [
  "#bd573e",
  "#ae8325",
  "#547646",
  "#2b7e7b",
  "#52689c",
  "#a25477",
];
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

/** Draws a printed seven-pixel symbol, counter-rotating it to remain legible during turns. */
function glyph(ctx, kind, angle) {
  ctx.save();
  ctx.rotate(-angle);
  ctx.fillStyle = COLORS[kind];
  const pixel = 5;
  for (let y = 0; y < 7; y++)
    for (let x = 0; x < 7; x++)
      if (GLYPHS[kind][y][x] === "1")
        ctx.fillRect((x - 3.5) * pixel, (y - 3.5) * pixel, pixel, pixel);
  ctx.restore();
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
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#0c242a";
  rect(ctx, -32, -29, 64, 66, 4);
  ctx.fillStyle = "#a8ad92";
  rect(ctx, -31, -30, 62, 65, 3);
  const finish = ctx.createLinearGradient(0, -31, 0, 30);
  finish.addColorStop(0, selected ? "#f4e9c8" : "#eee5c8");
  finish.addColorStop(1, selected ? "#ddd1a7" : "#d5d0ae");
  ctx.fillStyle = finish;
  rect(ctx, -31, -33, 62, 63, 3);
  ctx.strokeStyle = "#fbf0d3b3";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#b4b498";
  ctx.fillRect(-27, 28, 54, 1);
  if (highlight) {
    ctx.strokeStyle = "#fff4b0";
    ctx.lineWidth = 3;
    ctx.strokeRect(-29, -31, 58, 59);
  }
  ctx.translate(0, -1);
  glyph(ctx, kind, angle);
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
  for (let r = 0; r < 6; r++) {
    ctx.fillStyle = "#071e27";
    rect(ctx, 80, BOARD.origin + r * BOARD.pitch + 2, 440, 68, 1);
    ctx.fillStyle = "#a4b39826";
    ctx.fillRect(81, BOARD.origin + r * BOARD.pitch, 438, 1);
  }
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

/** Draws inset selector shoes and brass track edges for row, with stronger active feedback. */
function rowSelector(ctx, row, active, hinting, pulse) {
  const y = BOARD.origin + row * BOARD.pitch;
  const bright = active || hinting;
  ctx.save();
  ctx.fillStyle = bright ? "#b28d493d" : "#b6b38820";
  rect(ctx, 80, y + 1, 440, 71, 1);
  const rail = ctx.createLinearGradient(84, 0, 516, 0);
  rail.addColorStop(0, bright ? "#d2a65e" : "#899b80");
  rail.addColorStop(0.5, bright ? "#e6c88a70" : "#a2b39636");
  rail.addColorStop(1, bright ? "#d2a65e" : "#899b80");
  ctx.fillStyle = rail;
  ctx.fillRect(84, y + 1, 432, 1);
  ctx.fillRect(84, y + 71, 432, 1);
  for (const x of [66, 520]) {
    ctx.fillStyle = "#11292e";
    rect(ctx, x - 1, y + 11, 15, 50, 2);
    ctx.fillStyle = bright ? "#a88a5d" : "#647d70";
    rect(ctx, x, y + 12, 13, 47, 1);
    ctx.fillStyle = bright ? "#dbbb80" : "#95a68a";
    ctx.fillRect(x + 1, y + 12, 11, 1);
    ctx.fillStyle = "#243e3b";
    rect(ctx, x + 3, y + 22, 7, 27, 1);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = bright ? `rgba(239,181,102,${pulse})` : "#a3b49a";
      ctx.fillRect(x + 4, y + 25 + i * 7, 5, 3);
    }
  }
  ctx.restore();
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
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.scale(units, units);
  ctx.translate(300, 300);
  ctx.rotate(angle);
  ctx.scale(rotationScale, rotationScale);
  ctx.translate(-300, -300);
  cartridge(ctx);
  if (focusRow >= 0 && mode !== "rotate") {
    const y = BOARD.origin + focusRow * BOARD.pitch;
    const hinting = hintRow === focusRow;
    const pulse =
      hinting && !reducedMotion ? 0.7 + 0.3 * Math.sin(time * 0.006) : 1;
    rowSelector(ctx, focusRow, focusActive, hinting, pulse);
    if (hinting) {
      ctx.fillStyle = "#f8d295";
      ctx.font = "bold 17px Courier New";
      ctx.textAlign = "center";
      const x = hintCount > 0 ? 563 : 37;
      ctx.fillText(String(Math.abs(hintCount)), x, y + 32);
      ctx.font = "bold 20px Courier New";
      ctx.fillText(hintCount > 0 ? "→" : "←", x, y + 53);
    }
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(
    BOARD.origin,
    BOARD.origin,
    BOARD.pitch * SIZE,
    BOARD.pitch * SIZE + 4,
  );
  ctx.clip();
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      let u = c + 0.5,
        v = r + 0.5,
        scale = 1,
        alpha = 1;
      const sliding = (mode === "drag" || mode === "settle") && r === row;
      if (sliding) u = wrap(u + offset / cell, SIZE);
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
      const x = BOARD.origin + u * BOARD.pitch,
        y = BOARD.origin + v * BOARD.pitch;
      tile(
        ctx,
        grid[r][c],
        x,
        y,
        angle,
        scale,
        alpha,
        mode === "clear" && clearCells.includes(r * SIZE + c),
        r === focusRow && mode !== "rotate",
      );
      if (sliding && u < 0.5)
        tile(
          ctx,
          grid[r][c],
          x + SIZE * BOARD.pitch,
          y,
          angle,
          scale,
          alpha,
          false,
          true,
        );
      if (sliding && u > 5.5)
        tile(
          ctx,
          grid[r][c],
          x - SIZE * BOARD.pitch,
          y,
          angle,
          scale,
          alpha,
          false,
          true,
        );
    }
  ctx.restore();
  ctx.restore();
}
