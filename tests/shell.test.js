import test from "node:test";
import assert from "node:assert/strict";
import { GameShell } from "../src/shell.js";

/** Runs shell navigation against focusable display elements without browser rendering. */
function withShell(check) {
  const previous = globalThis.document;
  const elements = new Map();
  const listeners = new Map();
  const profile = { completed: [], sound: true, volume: 0.5, motion: "system", particles: true };
  const document = {
    activeElement: null,
    getElementById: element,
    querySelector: element,
    querySelectorAll: () => [],
    addEventListener: (name, callback) => listeners.set(name, callback),
  };
  /** Returns a focusable element for the supplied view or control ID. */
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      id, hidden: false, inert: false, style: {}, tagName: "BUTTON", isConnected: true,
      classList: { toggle() {} }, addEventListener() {},
      focus() { document.activeElement = this; },
      closest() { return null; },
    });
    return elements.get(id);
  }
  globalThis.document = document;
  try { check(new GameShell(profile), document, listeners); }
  finally { globalThis.document = previous; }
}

test("settings and help replace the display, then Back restores the previous view and focus", () => {
  withShell((shell, document) => {
    const origin = document.getElementById("menu-settings");
    origin.focus();
    shell.open("settings");
    assert.equal(document.getElementById("home-view").hidden, true);
    assert.equal(document.getElementById("settings-view").hidden, false);
    shell.open("help");
    shell.back();
    assert.equal(shell.view, "settings");
    shell.back();
    assert.equal(shell.view, "home");
    assert.equal(document.activeElement, origin);
  });
});

test("reopening the current page does not add an extra Back step", () => {
  withShell((shell) => {
    shell.open("settings");
    shell.open("settings");
    shell.back();
    assert.equal(shell.view, "home");
  });
});

test("gameplay and physical controls become inert on another page without being removed", () => {
  withShell((shell, document) => {
    shell.show("play");
    assert.equal(document.getElementById("play-view").inert, false);
    shell.open("help");
    assert.equal(document.getElementById("play-view").inert, true);
    assert.equal(document.querySelector(".control-panel").inert, true);
    assert.equal(document.querySelector(".control-panel").style.visibility, "visible");
    shell.back();
    assert.equal(document.getElementById("play-view").inert, false);
  });
});

test("Escape leaves result and level brief pages through the level map", () => {
  withShell((shell, document, listeners) => {
    shell.renderMap = () => {};
    for (const view of ["result", "intro"]) {
      shell.show(view);
      let prevented = false;
      listeners.get("keydown")({ key: "Escape", preventDefault() { prevented = true; } });
      assert.equal(shell.view, "map");
      assert.equal(prevented, true);
    }
  });
});
