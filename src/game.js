import {
  SIZE,
  wrap,
  shifted,
  rotated,
  generate,
  matches,
  collapse,
  hint,
} from "./engine.js";
import { BOARD, project, unproject } from "./board.js";
import { renderBoard, COLORS } from "./renderer.js";
import { ShiftAudio } from "./audio.js";
const $ = (id) => document.getElementById(id);
const canvas = $("board"),
  ctx = canvas.getContext("2d"),
  events = new EventTarget(),
  audio = new ShiftAudio(events);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let grid,
  score = 0,
  best = 0,
  mode = "idle",
  selected = -1,
  row = 0;
let offset = 0,
  velocity = 0,
  target = 0,
  angle = 0,
  spin = 0,
  direction = 1,
  queued = null;
let drag = null,
  tickCell = 0,
  chain = 0,
  clearCells = [],
  phase = 0,
  fallDistances = null,
  particles = [],
  hintRow = -1,
  hintUntil = 0;
let hintCount = 0,
  pendingMove = null,
  history = [],
  hasShifted = false,
  hasTurned = false;
let cueMessage = "",
  cueUntil = 0,
  lastCue = "",
  lastControls = "";
let lastTime = 0,
  dpr = 1,
  size = 400,
  cell = size / SIZE,
  pointerId = null,
  arrival = false;
let shownScore = 0,
  hover = -1;

/** Reads a numeric best score without requiring storage access. */
function loadBest() {
  try {
    const value = Number(localStorage.getItem("shift.best"));
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}
best = loadBest();

/** Dispatches a semantic feedback event for independent audio observers. */
function emit(name, detail = {}) {
  events.dispatchEvent(new CustomEvent(name, { detail }));
}

/** Sets the accessible status line. */
function status(message) {
  $("status").textContent = message;
}

/** Captures a completed position so a whole move and its cascades can be undone. */
function snapshot() {
  return { grid: grid.map((row) => [...row]), score, selected };
}

/** Stores one previous position, bounded to the latest twenty player actions. */
function rememberMove(position) {
  history.push(position);
  if (history.length > 20) history.shift();
}

/** Restores the previous completed position; personal best remains a lifetime record. */
function undo() {
  if (mode !== "idle" || !history.length) return;
  const previous = history.pop();
  grid = previous.grid;
  score = shownScore = previous.score;
  selected = previous.selected;
  offset = velocity = angle = spin = 0;
  queued = pendingMove = null;
  particles = [];
  clearCells = [];
  chain = 0;
  hintUntil = 0;
  hover = -1;
  $("combo").classList.remove("show");
  $("combo").replaceChildren();
  updateStats();
  emit("tick");
  showCue("MOVE UNDONE");
  status("Last move undone.");
  canvas.focus({ preventScroll: true });
}

/** Shows a short display message without adding persistent instructions around the board. */
function showCue(message, duration = 2400) {
  cueMessage = message;
  cueUntil = performance.now() + duration;
}

/** Reflects input mode, onboarding, hints, and busy controls only when their values change. */
function updateInterface(time) {
  let message =
    time < cueUntil
      ? cueMessage
      : !hasShifted
        ? "↔ DRAG A ROW"
        : !hasTurned
          ? "↶ TURN THE BOARD ↷"
          : "";
  if (mode === "drag" || mode === "settle") {
    const count = Math.round((mode === "drag" ? offset : target) / cell);
    message = `ROW ${row + 1} · ${count ? `${count > 0 ? "→" : "←"} ${Math.abs(count)}` : "← SLIDE →"}`;
  } else if (time < hintUntil && mode === "idle")
    message = `ROW ${hintRow + 1} · ${hintCount > 0 ? "→" : "←"} ${Math.abs(hintCount)}`;
  if (message !== lastCue) {
    $("cue").textContent = message;
    lastCue = message;
  }
  $("cue").classList.toggle("hint-cue", time < hintUntil);
  const controls = `${mode}/${queued}/${history.length}/${direction}`;
  if (controls !== lastControls) {
    $("hint").disabled = mode !== "idle";
    $("undo").disabled = mode !== "idle" || !history.length;
    for (const [id, turn] of [
      ["rotate-left", -1],
      ["rotate-right", 1],
    ]) {
      $(id).disabled = mode === "drag";
      $(id).classList.toggle(
        "engaged",
        mode === "rotate" && direction === turn,
      );
      $(id).classList.toggle("queued", queued === turn);
    }
    canvas.setAttribute(
      "aria-busy",
      String(mode !== "idle" && mode !== "drag"),
    );
    canvas.style.cursor =
      mode === "drag" ? "grabbing" : mode === "idle" ? "grab" : "default";
    lastControls = controls;
  }
}

/** Updates the current score and persistent best. */
function updateStats() {
  $("score").textContent = Math.round(shownScore).toLocaleString("en-US");
  $("best").textContent = best.toLocaleString("en-US");
}

/** Starts a fresh board and clears transient input and animation state. */
function reset() {
  if (pointerId !== null && canvas.hasPointerCapture(pointerId))
    canvas.releasePointerCapture(pointerId);
  grid = generate();
  score = 0;
  shownScore = 0;
  mode = "idle";
  selected = -1;
  row = 0;
  offset = velocity = angle = spin = 0;
  queued = drag = null;
  pointerId = null;
  particles = [];
  chain = 0;
  clearCells = [];
  hintUntil = 0;
  hintRow = -1;
  $("combo").classList.remove("show");
  $("combo").replaceChildren();
  status("Drag a row. Match three.");
  history = [];
  pendingMove = null;
  cueUntil = 0;
  lastControls = "";
  updateStats();
}

/** Sizes the canvas backing store to the displayed square and device pixel ratio. */
function resize() {
  const previous = cell;
  size = canvas.getBoundingClientRect().width;
  if (!size) return;
  cell = size / SIZE;
  dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  if (previous) {
    const ratio = cell / previous;
    offset *= ratio;
    target *= ratio;
    velocity *= ratio;
    if (drag) {
      drag.start = drag.last;
      drag.base = offset;
    }
  }
}

/** Advances a damped spring using bounded substeps for stable animation. */
function spring(position, speed, destination, dt) {
  for (let remaining = dt; remaining > 0;) {
    const step = Math.min(remaining, 1 / 120);
    speed += ((destination - position) * 420 - speed * 25) * step;
    position += speed * step;
    remaining -= step;
  }
  return [position, speed];
}

/** Renders the sliding cartridge and transient match particles for the current frame. */
function draw(time) {
  const focusRow =
    mode === "drag" || mode === "settle"
      ? row
      : hintUntil > time
        ? hintRow
        : hover >= 0
          ? hover
          : selected;
  renderBoard(ctx, {
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
    focusActive: mode === "drag" || mode === "settle" || selected === focusRow,
    reducedMotion,
    hintRow: time < hintUntil ? hintRow : -1,
    hintCount,
    time,
  });
  for (const p of particles) {
    const alpha = Math.max(0, 1 - p.age / p.life);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.radius * alpha * 2, p.radius * alpha * 2);
  }
  ctx.globalAlpha = 1;
}

/** Emits at most three detent sounds per update as a row crosses cell boundaries. */
function ticks() {
  const next = Math.floor(offset / cell + 0.5);
  for (let i = 0; i < Math.min(Math.abs(next - tickCell), 3); i++) emit("tick");
  tickCell = next;
}

/** Shows a short nonblocking match celebration. */
function celebrate(points) {
  const element = $("combo");
  element.replaceChildren(document.createTextNode(`+${points}`));
  if (chain > 1) {
    const multiplier = document.createElement("small");
    multiplier.textContent = `${chain}× CHAIN`;
    element.append(multiplier);
  }
  element.classList.remove("show");
  void element.offsetWidth;
  element.classList.add("show");
}

/** Checks for matches, starts their removal, or returns control to the player. */
function resolve() {
  clearCells = matches(grid);
  if (!clearCells.length) {
    mode = "idle";
    chain = 0;
    if (queued) {
      const turn = queued;
      queued = null;
      rotate(turn);
    }
    return;
  }
  chain++;
  mode = "clear";
  phase = 0;
  const points = clearCells.length * 10 * chain;
  score += points;
  if (score > best) {
    best = score;
    try {
      localStorage.setItem("shift.best", String(best));
    } catch {}
  }
  emit("match", { chain });
  showCue(
    `${clearCells.length} MATCHED${chain > 1 ? ` · ${chain}× CHAIN` : ""}`,
  );
  celebrate(points);
  status(
    `${clearCells.length} matched${chain > 1 ? `, ${chain} times chain` : ""}.`,
  );
  updateStats();
  if (!reducedMotion)
    for (const index of clearCells) {
      const r = Math.floor(index / SIZE),
        c = index % SIZE;
      for (let i = 0; i < 9; i++) {
        const a = Math.random() * Math.PI * 2,
          v = 25 + Math.random() * 95;
        particles.push({
          x: (project(c + 0.5, r + 0.5).x * size) / BOARD.size,
          y: (project(c + 0.5, r + 0.5).y * size) / BOARD.size,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          age: 0,
          life: 0.5 + Math.random() * 0.5,
          radius: 1 + Math.random() * 3,
          color: COLORS[grid[r][c]],
        });
      }
    }
}

/** Starts a springy quarter-turn or retains one request while another move settles. */
function rotate(turn) {
  if (document.querySelector("dialog[open]")) return;
  if (mode === "drag") return;
  if (mode !== "idle") {
    queued = turn;
    return;
  }
  hintUntil = 0;
  pendingMove = null;
  rememberMove(snapshot());
  mode = "rotate";
  direction = turn;
  angle = 0;
  spin = 0;
  arrival = false;
  emit("whoosh");

  status("Board turned.");
}

/** Starts a one-cell keyboard row shift. */
function shiftRow(count) {
  if (mode !== "idle") return;
  hover = -1;
  if (selected < 0) selected = 0;
  row = selected;
  pendingMove = snapshot();
  offset = 0;
  velocity = 0;
  target = count * cell;
  tickCell = 0;
  mode = "settle";
  arrival = false;
  hintUntil = 0;

  emit("grab");
}

/** Converts a client pointer coordinate to a canvas-relative location. */
function point(event) {
  const rect = canvas.getBoundingClientRect();
  const p = unproject(
    ((event.clientX - rect.left) * BOARD.size) / size,
    ((event.clientY - rect.top) * BOARD.size) / size,
  );
  return { x: p.u * cell, y: p.v * cell, inside: p.inside };
}

/** Ends the current pointer gesture, optionally canceling its pending movement. */
function release(event, cancel = false) {
  if (!drag || event.pointerId !== pointerId) return;
  const stale = performance.now() - drag.lastTime > 100;
  target = cancel
    ? 0
    : Math.max(
        -SIZE,
        Math.min(
          SIZE,
          Math.round(
            (offset +
              (stale ? 0 : Math.max(-cell, Math.min(cell, velocity * 0.14)))) /
              cell,
          ),
        ),
      ) * cell;
  drag = null;
  mode = "settle";
  arrival = false;
  if (canvas.hasPointerCapture(pointerId))
    canvas.releasePointerCapture(pointerId);
  pointerId = null;
}
canvas.addEventListener("focus", () => {
  if (selected < 0) selected = 0;
});
canvas.addEventListener("pointerdown", (event) => {
  if (
    event.button !== 0 ||
    mode !== "idle" ||
    document.querySelector("dialog[open]")
  )
    return;
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  const p = point(event);
  if (!p.inside) return;
  row = Math.floor(p.y / cell);
  selected = row;
  pendingMove = snapshot();
  mode = "drag";
  offset = velocity = 0;
  tickCell = 0;
  pointerId = event.pointerId;
  canvas.setPointerCapture(pointerId);
  drag = { start: p.x, last: p.x, lastTime: performance.now(), base: 0 };
  hintUntil = 0;

  emit("grab");
});
canvas.addEventListener("pointermove", (event) => {
  const p = point(event);
  hover = p.inside ? Math.floor(p.y / cell) : -1;
  if (!drag || event.pointerId !== pointerId) return;
  const now = performance.now(),
    dt = (now - drag.lastTime) / 1000;
  const raw = (p.x - drag.start + drag.base) / cell,
    whole = Math.floor(raw + 0.5),
    fraction = raw - whole;
  const shown =
    (whole + 0.35 * fraction + 2.6 * fraction * fraction * fraction) * cell;
  if (dt > 0) {
    velocity +=
      (Math.max(-cell * 35, Math.min(cell * 35, (shown - offset) / dt)) -
        velocity) *
      (1 - Math.exp(-25 * dt));
  }
  offset = shown;
  drag.last = p.x;
  drag.lastTime = now;
  ticks();
});
canvas.addEventListener("pointerup", (e) => release(e));
canvas.addEventListener("pointercancel", (e) => release(e, true));
canvas.addEventListener("lostpointercapture", (e) => release(e, true));
canvas.addEventListener("pointerleave", () => {
  hover = -1;
});
canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  rotate(1);
});
window.addEventListener("blur", () => {
  if (drag) release({ pointerId }, true);
});
document.addEventListener("visibilitychange", () => {
  lastTime = 0;
  if (document.hidden && drag) release({ pointerId }, true);
});
window.addEventListener("keydown", (event) => {
  if (
    document.querySelector("dialog[open]") ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.target.closest("input,textarea,select,[contenteditable=true]")
  )
    return;
  const key = event.key.toLowerCase();
  if (
    ![
      "q",
      "e",
      "arrowleft",
      "arrowright",
      "arrowup",
      "arrowdown",
      "a",
      "d",
      "h",
      "z",
    ].includes(key)
  )
    return;
  event.preventDefault();
  if (event.repeat && ["q", "e", "h", "arrowleft", "arrowright"].includes(key))
    return;
  if (key === "q" || key === "arrowleft") rotate(-1);
  else if (key === "e" || key === "arrowright") rotate(1);
  else if (key === "arrowup" || key === "arrowdown") {
    selected = selected < 0 ? 0 : wrap(selected + (key === "arrowup" ? -1 : 1));
    hover = -1;
    hintUntil = 0;
  } else if (key === "a" || key === "d") {
    shiftRow(key === "a" ? -1 : 1);
  } else if (key === "z") undo();
  else showHint();
});

/** Finds and highlights a productive row, turning the board first if needed. */
function showHint() {
  if (mode !== "idle") return;
  const suggestion = hint(grid);
  if (!suggestion) {
    status("No match available. Shift any row to rearrange.");
    return;
  }
  hintRow = suggestion.row;
  hintCount = suggestion.count;
  hintUntil = performance.now() + 6500;
  if (suggestion.turn) {
    rotate(1);
    hintUntil = performance.now() + 7000;
  }
  status(
    `Try row ${suggestion.row + 1}: ${Math.abs(suggestion.count)} ${Math.abs(suggestion.count) === 1 ? "step" : "steps"} ${suggestion.count > 0 ? "right" : "left"}.`,
  );
}
$("rotate-left").addEventListener("click", () => rotate(-1));
$("rotate-right").addEventListener("click", () => rotate(1));
$("hint").addEventListener("click", showHint);
$("undo").addEventListener("click", undo);
/** Applies audio preference and reflects the actual supported state in its control. */
async function setSound(enabled) {
  const active = await audio.setEnabled(enabled);
  $("sound").classList.toggle("sound-on", active);
  $("sound").setAttribute("aria-label", active ? "Mute sound" : "Enable sound");
  $("sound").setAttribute("aria-pressed", String(active));
}

let soundStarted = false;
/** Unlocks interaction audio on the first game gesture without overriding manual mute. */
function startSound(event) {
  if (soundStarted) return;
  soundStarted = true;
  if (!event.target.closest("#sound")) void setSound(true);
}
window.addEventListener("pointerdown", startSound, {
  capture: true,
  once: true,
});
window.addEventListener("keydown", startSound, { capture: true, once: true });
$("sound").addEventListener("click", () => {
  soundStarted = true;
  void setSound(!audio.enabled);
});
$("fullscreen").addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    status("Fullscreen unavailable.");
  }
});
document.addEventListener("fullscreenchange", () => {
  $("fullscreen").setAttribute(
    "aria-label",
    document.fullscreenElement ? "Exit fullscreen" : "Enter fullscreen",
  );
});
$("help").addEventListener("click", () => {
  $("help-dialog").showModal();
});
for (const button of document.querySelectorAll(".close-dialog,.close-help"))
  button.addEventListener("click", () => $("help-dialog").close());
$("restart").addEventListener("click", () => $("restart-dialog").showModal());
$("confirm-restart").addEventListener("click", () => {
  $("restart-dialog").close();
  reset();
  canvas.focus({ preventScroll: true });
});
$("restart-dialog")
  .querySelector(".cancel")
  .addEventListener("click", () => $("restart-dialog").close());
for (const dialog of document.querySelectorAll("dialog"))
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      )
        dialog.close();
    }
  });

/** Advances the interaction state, cascades, and visual effects for one animation frame. */
function frame(time) {
  const dt = lastTime ? Math.min((time - lastTime) / 1000, 1 / 30) : 1 / 60;
  lastTime = time;
  if (!document.hidden) {
    if (mode === "settle") {
      [offset, velocity] = spring(offset, velocity, target, dt);
      ticks();
      if (!arrival && Math.abs(target - offset) < cell * 0.02) {
        arrival = true;
        emit("thunk");
      }
      if (
        Math.abs(target - offset) < cell * 0.004 &&
        Math.abs(velocity) < cell * 0.05
      ) {
        const count = Math.round(target / cell);
        const previous = pendingMove;
        pendingMove = null;
        grid[row] = shifted(grid[row], count);
        offset = 0;
        velocity = 0;
        mode = "idle";
        if (wrap(count) !== 0) {
          if (previous) rememberMove(previous);
          hasShifted = true;
          resolve();
        } else if (queued) {
          const turn = queued;
          queued = null;
          rotate(turn);
        }
      }
    } else if (mode === "rotate") {
      [angle, spin] = spring(angle, spin, (direction * Math.PI) / 2, dt);
      if (!arrival && Math.abs((direction * Math.PI) / 2 - angle) < 0.02) {
        arrival = true;
        emit("thunk");
      }
      if (
        Math.abs((direction * Math.PI) / 2 - angle) < 0.004 &&
        Math.abs(spin) < 0.05
      ) {
        grid = rotated(grid, direction);
        hasTurned = true;
        angle = 0;
        spin = 0;
        mode = "idle";
        resolve();
      }
    } else if (mode === "clear") {
      phase += dt;
      if (phase >= (reducedMotion ? 0.08 : 0.32)) {
        const result = collapse(grid, clearCells);
        grid = result.grid;
        fallDistances = result.distances;
        phase = 0;
        mode = "fall";
      }
    } else if (mode === "fall") {
      phase += dt;
      if (phase >= (reducedMotion ? 0.08 : 0.5)) {
        mode = "idle";
        emit("thunk");
        resolve();
      }
    }
    for (const p of particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 90 * dt;
    }
    particles = particles.filter((p) => p.age < p.life);
    if (Math.abs(score - shownScore) > 0.5) {
      shownScore += (score - shownScore) * (1 - Math.exp(-9 * dt));
      updateStats();
    } else if (shownScore !== score) {
      shownScore = score;
      updateStats();
    }
    updateInterface(time);
    draw(time);
  }
  requestAnimationFrame(frame);
}
reset();
new ResizeObserver(resize).observe(canvas);
resize();
requestAnimationFrame(frame);
