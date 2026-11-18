import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as engine from "../src/engine.js";
import * as board from "../src/board.js";
import * as levels from "../src/levels.js";

const source = readFileSync(new URL("../src/game.js", import.meta.url), "utf8")
  .replace(/import[\s\S]*?from "[^\"]+";/g, "");

/** Creates an isolated controller with DOM events, real rules, and a manually advanced clock. */
function controller() {
  let open = false;
  const nodes = new Map();
  const listeners = new Map();
  const context = new Proxy({}, { get: () => () => {} });
  const document = {
    hidden: false,
    documentElement: { classList: { toggle() {} } },
    getElementById: node,
    querySelector: () => open ? node("help-dialog") : null,
    querySelectorAll: (selector) => selector === "dialog" ? [node("help-dialog"), node("restart-dialog")] : [],
    addEventListener() {},
    createTextNode: (text) => text,
    createElement: () => node("small"),
  };
  /** Returns a minimal element for id, preserving handlers and pointer capture. */
  function node(id) {
    if (!nodes.has(id)) {
      const handlers = new Map();
      const captures = new Set();
      nodes.set(id, {
        textContent: "", style: {},
        classList: { toggle() {}, remove() {}, add() {} },
        addEventListener: (type, fn) => handlers.set(type, fn),
        fire: (type, event = {}) => handlers.get(type)?.(event),
        closest: () => null,
        setAttribute() {}, replaceChildren() {}, append() {},
        getContext: () => context,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 600 }),
        hasPointerCapture: (id) => captures.has(id),
        setPointerCapture: (id) => captures.add(id),
        releasePointerCapture: (id) => captures.delete(id),
        focus: () => handlers.get("focus")?.(),
        showModal: () => { open = true; },
        close: () => { open = false; handlers.get("close")?.(); },
        querySelector: () => node("cancel"),
        querySelectorAll: () => [],
      });
    }
    return nodes.get(id);
  }
  const sandbox = vm.createContext({
    ...engine, ...board, ...levels, document,
    loadProfile: () => ({ sound: false, volume: 0.5, motion: "system", particles: true, completed: [] }),
    saveProfile() {},
    GameShell: class extends EventTarget {
      constructor() { super(); this.view = "play"; }
      show() {} updateRun() {} syncSettings() {} result() {}
    },
    window: { addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    } },
    ShiftAudio: class { async setEnabled() { return false; } setVolume() {} }, renderBoard() {}, COLORS: [],
    EventTarget, CustomEvent,
    performance: { now: () => 100 },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    requestAnimationFrame() {},
    ResizeObserver: class { observe() {} },
    localStorage: { getItem: () => null, setItem() {} },
    devicePixelRatio: 1,
  });
  vm.runInContext(source, sandbox);
  return {
    node,
    run: (code) => vm.runInContext(code, sandbox),
    key: (key) => listeners.get("keydown").forEach((fn) => fn({ key, target: node("board"), preventDefault() {} })),
    pointer: (type, x, y = 120, id = 1) => node("board").fire(type, {
      button: 0, clientX: x, clientY: y, pointerId: id, preventDefault() {},
    }),
  };
}

test("quick drags use the release coordinate and ignore other pointers", () => {
  const game = controller();
  game.pointer("pointerdown", 120);
  game.pointer("pointerup", 192, 120, 2);
  assert.equal(game.run("mode"), "drag");
  game.pointer("pointerup", 192);
  assert.equal(game.run("target / cell"), 1);
  assert.equal(game.run("pointerId"), null);
  assert.equal(game.node("board").hasPointerCapture(1), false);
});

test("Escape and pointer cancellation return a held row to its original detent", () => {
  for (const cancel of ["Escape", "pointercancel", "lostpointercapture"]) {
    const game = controller();
    game.pointer("pointerdown", 120);
    game.pointer("pointermove", 192);
    if (cancel === "Escape") game.key(cancel);
    else game.pointer(cancel, 192);
    assert.equal(game.run("target"), 0);
    assert.equal(game.run("mode"), "settle");
    assert.equal(game.run("drag"), null);
  }
});

test("row navigation cannot change selection during a move", () => {
  const game = controller();
  game.key("s");
  game.key("d");
  game.key("s");
  assert.equal(game.run("selected"), 0);
  game.key("e");
  assert.equal(game.run("queued"), 1);
  game.key("Escape");
  assert.equal(game.run("queued"), null);
  assert.equal(game.run("target / cell"), 1);
});

test("hints select their highlighted row for subsequent keyboard shifts", () => {
  const game = controller();
  game.run("hint = () => ({ row: 4, count: -1, turn: false }); hover = 1");
  game.key("h");
  assert.equal(game.run("selected"), 4);
  assert.equal(game.run("hover"), -1);
  game.key("a");
  assert.equal(game.run("row"), 4);
});

test("dialogs pause animation and clear a pending turn before resuming", () => {
  const game = controller();
  game.key("e");
  game.key("e");
  game.node("help").fire("click");
  game.run("frame(1000)");
  assert.equal(game.run("angle"), 0);
  assert.equal(game.run("queued"), null);
  game.node("help-dialog").close();
  game.run("frame(2000)");
  assert.ok(game.run("angle") > 0);
});

test("reduced motion commits shifts and turns without spring travel", () => {
  const game = controller();
  game.run("reducedMotion = true; grid = Array.from({length: 6}, (_, r) => Array.from({length: 6}, (_, c) => (r+c)%6))");
  game.key("d");
  game.run("frame(1000)");
  assert.equal(game.run("mode"), "idle");
  assert.equal(game.run("offset"), 0);
  game.key("e");
  game.run("frame(1016)");
  assert.equal(game.run("mode"), "idle");
  assert.equal(game.run("angle"), 0);
  assert.equal(game.run("hasTurned"), true);
});

test("a hinted multi-cell keyboard slide consumes one move and waits for cascades", () => {
  const game = controller();
  game.run("reset(LEVELS[0]); reducedMotion = true; hint = () => ({ row: 0, count: 2, turn: false })");
  game.key("h");
  game.key("d");
  assert.equal(game.run("target / cell"), 2);
  game.run("frame(1000)");
  assert.equal(game.run("run.moves"), 1);
  assert.equal(game.run("run.result"), null);
  assert.equal(game.run("mode"), "clear");
});

test("the final move finishes all matches and blocks a queued turn before showing its result", () => {
  const game = controller();
  game.run("reset({...LEVELS[0], moves: 1, score: 30}); reducedMotion = true; selected = 0; hint = () => ({ row: 0, count: 2, turn: false })");
  game.key("h");
  game.key("d");
  game.key("e");
  game.run("frame(1000)");
  assert.equal(game.run("run.result"), null);
  game.run("for (let t = 1016; t < 5000 && !run.result; t += 16) frame(t)");
  assert.equal(game.run("run.result"), "won");
  assert.equal(game.run("queued"), null);
  assert.equal(game.run("hasTurned"), false);
});
