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
import { BOARD, project, unproject, magneticTarget } from "./board.js";
import { renderBoard, COLORS } from "./renderer.js";
import { ShiftAudio } from "./audio.js";
import { LEVELS, LevelRun } from "./levels.js";
import { loadProfile, saveProfile } from "./profile.js";
import { GameShell } from "./shell.js";
const $ = (id) => document.getElementById(id);
const canvas = $("board"),
  ctx = canvas.getContext("2d"),
  events = new EventTarget(),
  audio = new ShiftAudio(events);
const profile = loadProfile();
const shell = new GameShell(profile);
let run = null;
const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
let reducedMotion = profile.motion === "reduced" || (profile.motion === "system" && motionPreference.matches);
motionPreference.addEventListener("change", () => applyMotion());
let grid,
  score = 0,
  best = 0,
  mode = "idle",
  selected = -1,
  row = 0;
let offset = 0,
  velocity = 0,
  target = 0,
  keyboardShift = false,
  keyboardShiftAge = 0,
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

/** Applies the chosen motion preference to canvas effects and DOM animations. */
function applyMotion() {
  reducedMotion = profile.motion === "reduced" || (profile.motion === "system" && motionPreference.matches);
  document.documentElement.classList.toggle("reduced-motion", reducedMotion);
  if (reducedMotion) particles = [];
}
applyMotion();

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
    const count = mode === "drag" ? drag.detent : Math.round(target / cell);
    message = `ROW ${row + 1} · ${count ? `${count > 0 ? "→" : "←"} ${Math.abs(count)}` : "← SLIDE →"}`;
  } else if (time < hintUntil && mode === "idle")
    message = `ROW ${hintRow + 1} · ${hintCount > 0 ? "→" : "←"} ${Math.abs(hintCount)}`;
  if (message !== lastCue) {
    $("cue").textContent = message;
    lastCue = message;
  }
  $("cue").classList.toggle("hint-cue", time < hintUntil);
  const controls = `${mode}/${queued}/${direction}`;
  if (controls !== lastControls) {
    $("hint").disabled = mode !== "idle";
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
function reset(level = null) {
  if (pointerId !== null && canvas.hasPointerCapture(pointerId))
    canvas.releasePointerCapture(pointerId);
  run = level ? new LevelRun(level) : null;
  grid = generate(run ? run.random : Math.random);
  shell.active = true;
  shell.updateRun(run);
  score = 0;
  shownScore = 0;
  mode = "idle";
  selected = -1;
  row = 0;
  offset = velocity = target = angle = spin = 0;
  keyboardShift = false;
  hover = -1;
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
      drag.base = drag.raw * cell;
      drag.target = magneticTarget(drag.raw, drag.detent).cells * cell;
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
    marks: run?.marks,
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
    shell.updateRun(run);
    if (run?.finish()) {
      queued = null;
      shownScore = score;
      updateStats();
      shell.result(run);
      status(run.result === "won" ? "Level cleared." : "Out of moves. Try again.");
      return;
    }
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
  run?.recordMatch(grid, clearCells, chain);
  shell.updateRun(run);
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
  if (!reducedMotion && profile.particles)
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
  if (shell.view !== "play" || run?.result || document.querySelector("dialog[open]")) return;
  if (mode === "drag") return;
  if (mode !== "idle") {
    queued = turn;
    return;
  }
  hintUntil = 0;
  mode = "rotate";
  direction = turn;
  angle = 0;
  spin = 0;
  arrival = false;
  emit("whoosh");

  status("Board turned.");
}

/** Starts a keyboard slide, following the complete active hint in its suggested direction. */
function shiftRow(count) {
  if (shell.view !== "play" || run?.result || mode !== "idle") return;
  hover = -1;
  if (selected < 0) selected = 0;
  row = selected;
  offset = 0;
  velocity = 0;
  const hintedCount = hintUntil > performance.now() && selected === hintRow && Math.sign(hintCount) === Math.sign(count)
    ? hintCount : count;
  target = hintedCount * cell;
  keyboardShift = true;
  keyboardShiftAge = 0;
  tickCell = 0;
  mode = "settle";
  hintUntil = 0;
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

/** Updates the captured drag's magnetic target from its latest client coordinates. */
function moveDrag(event) {
  if (!drag || event.pointerId !== pointerId) return;
  const p = point(event);
  drag.raw = (p.x - drag.start + drag.base) / cell;
  const magnet = magneticTarget(drag.raw, drag.detent);
  drag.detent = magnet.detent;
  drag.target = magnet.cells * cell;
  drag.last = p.x;
}

/** Ends the current pointer gesture, optionally canceling its pending movement. */
function release(event, cancel = false) {
  if (!drag || event.pointerId !== pointerId) return;
  if (!cancel) moveDrag(event);
  target = cancel ? 0 : drag.detent * cell;
  keyboardShift = false;
  drag = null;
  mode = "settle";
  const captured = pointerId;
  pointerId = null;
  if (canvas.hasPointerCapture(captured))
    canvas.releasePointerCapture(captured);
}
canvas.addEventListener("focus", () => {
  if (selected < 0) selected = 0;
});
canvas.addEventListener("pointerdown", (event) => {
  if (
    event.button !== 0 ||
    shell.view !== "play" || run?.result ||
    mode !== "idle" ||
    document.querySelector("dialog[open]")
  )
    return;
  const p = point(event);
  if (!p.inside) return;
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  row = Math.floor(p.y / cell);
  selected = row;
  mode = "drag";
  offset = velocity = 0;
  tickCell = 0;
  pointerId = event.pointerId;
  canvas.setPointerCapture(pointerId);
  drag = { start: p.x, last: p.x, base: 0, raw: 0, detent: 0, target: 0 };
  hintUntil = 0;
});
canvas.addEventListener("pointermove", (event) => {
  const p = point(event);
  hover = p.inside ? Math.floor(p.y / cell) : -1;
  moveDrag(event);
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
    shell.view !== "play" || run?.result ||
    document.querySelector("dialog[open]") ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.target.closest("input,textarea,select,[contenteditable=true]")
  )
    return;
  const key = event.key.toLowerCase();
  if (key === "escape") {
    if (drag || queued || hintUntil > performance.now()) {
      event.preventDefault();
      queued = null;
      hintUntil = 0;
      if (drag) release({ pointerId }, true);
      showCue("CANCELED", 1200);
      status("Pending input canceled.");
    } else {
      pauseHome();
    }
    return;
  }
  if (
    ![
      "q",
      "e",
      "arrowleft",
      "arrowright",
      "arrowup",
      "arrowdown",
      "w",
      "s",
      "a",
      "d",
      "h",
    ].includes(key)
  )
    return;
  event.preventDefault();
  if (event.repeat && ["q", "e", "h", "arrowleft", "arrowright"].includes(key))
    return;
  if (key === "q" || key === "arrowleft") rotate(-1);
  else if (key === "e" || key === "arrowright") rotate(1);
  else if (["arrowup", "arrowdown", "w", "s"].includes(key)) {
    if (mode !== "idle") return;
    const step = key === "w" || key === "arrowup" ? -1 : 1;
    selected = selected < 0 ? 0 : wrap(selected + step);
    emit("select");
    hover = -1;
    hintUntil = 0;
    showCue(`ROW ${selected + 1} · A ← SLIDE → D`, 1800);
    status(`Row ${selected + 1} selected. A slides left, D slides right.`);
  } else if (key === "a" || key === "d") {
    shiftRow(key === "a" ? -1 : 1);
  } else showHint();
});

/** Finds and highlights a productive row, turning the board first if needed. */
function showHint() {
  if (shell.view !== "play" || run?.result || mode !== "idle") return;
  const suggestion = hint(grid);
  if (!suggestion) {
    showCue("SHIFT A ROW TO REARRANGE");
    status("No match available. Shift any row to rearrange.");
    return;
  }
  selected = hintRow = suggestion.row;
  hover = -1;
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
/** Applies audio preference and reflects the actual supported state in its control. */
async function setSound(enabled) {
  const active = await audio.setEnabled(enabled);
  $("sound").classList.toggle("sound-on", active);
  $("sound").setAttribute("aria-label", active ? "Mute sound" : "Enable sound");
  $("sound").setAttribute("aria-pressed", String(active));
  audio.setVolume(profile.volume);
}

let soundStarted = false;
/** Unlocks interaction audio on the first game gesture without overriding manual mute. */
function startSound(event) {
  if (soundStarted) return;
  soundStarted = true;
  if (!event.target.closest("#sound")) void setSound(profile.sound);
}
window.addEventListener("pointerdown", startSound, {
  capture: true,
  once: true,
});
window.addEventListener("keydown", startSound, { capture: true, once: true });
$("sound").addEventListener("click", () => {
  soundStarted = true;
  profile.sound = !profile.sound;
  saveProfile(profile);
  shell.syncSettings();
  void setSound(profile.sound);
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
/** Opens the named dialog after safely canceling a held gesture and queued turn. */
function openDialog(id) {
  if (drag) release({ pointerId }, true);
  queued = null;
  hover = -1;
  $(id).showModal();
}
$("help").addEventListener("click", () => openDialog("help-dialog"));
for (const button of $("help-dialog").querySelectorAll(".close-dialog,.close-help"))
  button.addEventListener("click", () => $("help-dialog").close());
$("restart").addEventListener("click", () => {
  $("restart-title").textContent = run ? "Restart level?" : "New game?";
  $("restart-copy").textContent = run ? "Start this level again with the same board and all your moves." : "Your best score stays.";
  openDialog("restart-dialog");
});
$("confirm-restart").addEventListener("click", () => {
  $("restart-dialog").close();
  reset(run?.level || null);
  canvas.focus({ preventScroll: true });
});
$("restart-dialog")
  .querySelector(".cancel")
  .addEventListener("click", () => $("restart-dialog").close());
for (const dialog of document.querySelectorAll("dialog")) {
  dialog.addEventListener("cancel", (event) => {
    if (dialog.id === "result-dialog") {
      event.preventDefault();
      dialog.close();
      shell.show("map");
    }
  });
  dialog.addEventListener("close", () => {
    lastTime = 0;
    if (shell.view === "play" && !run?.result) canvas.focus({ preventScroll: true });
  });
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog && !["result-dialog", "level-dialog"].includes(dialog.id)) {
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
}

/** Pauses the attempt on the main menu without losing its current board or progress. */
function pauseHome() {
  if (drag) release({ pointerId }, true);
  queued = null;
  hover = -1;
  shell.show("home");
}

shell.addEventListener("preview", (event) => {
  shell.renderGoals($("level-intro-goals"), new LevelRun(event.detail));
});
shell.addEventListener("preferences", () => {
  applyMotion();
  if (!profile.particles) particles = [];
  void setSound(profile.sound);
});
shell.addEventListener("action", (event) => {
  const { action, id } = event.detail;
  if (action === "settings" || action === "help") {
    openDialog(action === "settings" ? "settings-dialog" : "help-dialog");
    return;
  }
  for (const dialog of document.querySelectorAll("dialog[open]")) dialog.close();
  if (action === "home") pauseHome();
  else if (action === "levels") { queued = null; shell.show("map"); }
  else if (action === "resume") shell.show("play");
  else if (action === "next") {
    const next = LEVELS.find((level) => level.id === run?.level.id + 1);
    if (next) { shell.show("map"); shell.preview(next); }
  } else {
    const level = action === "start" ? LEVELS.find((level) => level.id === id)
      : action === "retry" ? run?.level : null;
    if (action === "start" && (!level || (level.id > 1 && !profile.completed.includes(level.id - 1) && !profile.completed.includes(level.id)))) return;
    reset(level);
    shell.show("play");
  }
  lastTime = 0;
});

/** Advances the interaction state, cascades, and visual effects for one animation frame. */
function frame(time) {
  const dt = lastTime ? Math.min((time - lastTime) / 1000, 1 / 30) : 1 / 60;
  lastTime = time;
  if (!document.hidden && shell.view === "play" && !document.querySelector("dialog[open]")) {
    if (mode === "drag") {
      [offset, velocity] = reducedMotion
        ? [drag.target, 0]
        : spring(offset, velocity, drag.target, dt);
      ticks();
    } else if (mode === "settle") {
      if (reducedMotion) {
        offset = target;
        velocity = 0;
      } else if (keyboardShift && keyboardShiftAge < 0.045) {
        keyboardShiftAge += dt;
        const preload = Math.min(1, keyboardShiftAge / 0.045);
        offset = target * 0.1 * preload;
      } else {
        const settleTime = keyboardShift ? dt * 1.25 : dt;
        [offset, velocity] = spring(offset, velocity, target, settleTime);
      }
      ticks();
      if (
        keyboardShift
          ? Math.abs(target - offset) < cell * 0.02
          : Math.abs(target - offset) < cell * 0.004 &&
            Math.abs(velocity) < cell * 0.05
      ) {
        const count = Math.round(target / cell);
        grid[row] = shifted(grid[row], count);
        offset = 0;
        velocity = 0;
        mode = "idle";
        if (wrap(count) !== 0) {
          hasShifted = true;
          run?.recordShift();
          shell.updateRun(run);
          resolve();
        } else if (queued) {
          const turn = queued;
          queued = null;
          rotate(turn);
        }
      }
    } else if (mode === "rotate") {
      [angle, spin] = reducedMotion
        ? [(direction * Math.PI) / 2, 0]
        : spring(angle, spin, (direction * Math.PI) / 2, dt);
      if (!arrival && Math.abs((direction * Math.PI) / 2 - angle) < 0.02) {
        arrival = true;
        emit("thunk");
      }
      if (
        Math.abs((direction * Math.PI) / 2 - angle) < 0.004 &&
        Math.abs(spin) < 0.05
      ) {
        grid = rotated(grid, direction);
        run?.turn(direction);
        hasTurned = true;
        angle = 0;
        spin = 0;
        mode = "idle";
        resolve();
      }
    } else if (mode === "clear") {
      phase += dt;
      if (phase >= (reducedMotion ? 0.08 : 0.32)) {
        const result = collapse(grid, clearCells, run ? run.random : Math.random);
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
shell.active = false;
shell.show("home");
new ResizeObserver(resize).observe(canvas);
resize();
requestAnimationFrame(frame);
