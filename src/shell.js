import { LEVELS } from "./levels.js";
import { saveProfile } from "./profile.js";

/** Owns menu views, settings, level selection, and result presentation. */
export class GameShell extends EventTarget {
  /** Binds menu controls to semantic action events and uses profile for local progress. */
  constructor(profile) {
    super();
    this.profile = profile;
    this.view = "home";
    this.active = false;
    this.pendingLevel = null;
    const actions = {
      "play-levels": "levels", "free-play": "free", "resume-game": "resume",
      "map-back": "home", "home": "home", "result-map": "levels",
      "result-retry": "retry", "result-next": "next",
    };
    for (const [id, action] of Object.entries(actions))
      document.getElementById(id).addEventListener("click", () => this.dispatchEvent(new CustomEvent("action", { detail: { action } })));
    for (const id of ["settings", "menu-settings"])
      document.getElementById(id).addEventListener("click", () => this.dispatchEvent(new CustomEvent("action", { detail: { action: "settings" } })));
    document.getElementById("menu-help").addEventListener("click", () => this.dispatchEvent(new CustomEvent("action", { detail: { action: "help" } })));
    for (const id of ["close-settings", "settings-done"])
      document.getElementById(id).addEventListener("click", () => document.getElementById("settings-dialog").close());
    document.getElementById("begin-level").addEventListener("click", () => {
      document.getElementById("level-dialog").close();
      this.dispatchEvent(new CustomEvent("action", { detail: { action: "start", id: this.pendingLevel } }));
    });
    document.getElementById("cancel-level").addEventListener("click", () => document.getElementById("level-dialog").close());
    for (const key of ["sound", "volume", "motion", "particles"]) {
      const input = document.getElementById(`setting-${key}`);
      input.addEventListener(key === "volume" ? "input" : "change", () => {
        profile[key] = key === "volume" ? Number(input.value) / 100 : key === "motion" ? input.value : input.checked;
        saveProfile(profile);
        this.syncSettings();
        this.dispatchEvent(new CustomEvent("preferences", { detail: profile }));
      });
    }
    this.syncSettings();
    this.show("home");
  }

  /** Reflects saved preferences in the settings controls. */
  syncSettings() {
    for (const key of ["sound", "particles"])
      document.getElementById(`setting-${key}`).checked = this.profile[key];
    document.getElementById("setting-volume").value = Math.round(this.profile.volume * 100);
    document.getElementById("volume-value").textContent = `${Math.round(this.profile.volume * 100)}%`;
    document.getElementById("setting-motion").value = this.profile.motion;
  }

  /** Switches to home, map, or play while removing hidden controls from keyboard navigation. */
  show(view) {
    this.view = view;
    document.querySelector(".game").classList.toggle("menu-active", view !== "play");
    document.querySelector(".game").classList.toggle("level-active", view === "play" && Boolean(this.run));
    for (const name of ["home", "map"])
      document.getElementById(`${name}-view`).hidden = view !== name;
    document.getElementById("play-view").inert = view !== "play";
    document.getElementById("play-view").style.visibility = view === "play" ? "visible" : "hidden";
    document.querySelector(".control-panel").inert = view !== "play";
    document.querySelector(".control-panel").style.visibility = view === "play" ? "visible" : "hidden";
    document.getElementById("resume-game").hidden = !this.active;
    document.getElementById("campaign-progress").textContent = `${this.profile.completed.length} / ${LEVELS.length} levels cleared`;
    if (view === "map") this.renderMap();
    const focus = view === "play" ? "board" : view === "map" ? "map-back" : this.active ? "resume-game" : "play-levels";
    document.getElementById(focus).focus({ preventScroll: true });
  }

  /** Rebuilds the numbered level map from completion state; completed levels remain replayable. */
  renderMap() {
    const map = document.getElementById("level-map");
    map.replaceChildren();
    for (const level of LEVELS) {
      const completed = this.profile.completed.includes(level.id);
      const unlocked = completed || level.id === 1 || this.profile.completed.includes(level.id - 1);
      const button = document.createElement("button");
      button.className = `level-card${completed ? " completed" : ""}`;
      button.disabled = !unlocked;
      button.setAttribute("aria-label", `Level ${level.id}: ${level.name}${completed ? ", cleared" : unlocked ? "" : ", locked"}`);
      const number = document.createElement("strong");
      number.textContent = completed ? `${level.id} ✓` : String(level.id).padStart(2, "0");
      const title = document.createElement("span");
      title.textContent = level.name;
      button.append(number, title);
      button.addEventListener("click", () => this.preview(level));
      map.append(button);
    }
  }

  /** Shows an authored level brief before starting or replacing an attempt. */
  preview(level) {
    this.pendingLevel = level.id;
    document.getElementById("level-intro-label").textContent = `LEVEL ${String(level.id).padStart(2, "0")}`;
    document.getElementById("level-title").textContent = level.name;
    document.getElementById("level-tip").textContent = level.tip;
    document.getElementById("level-budget").textContent = `${level.moves} moves · Free turns · No timer`;
    this.dispatchEvent(new CustomEvent("preview", { detail: level }));
    document.getElementById("level-dialog").showModal();
  }

  /** Renders goals in element using run's progress, optionally including progress bars. */
  renderGoals(element, run, bars = false) {
    element.replaceChildren();
    for (const goal of run.goals) {
      const item = document.createElement("div");
      item.className = `goal${goal.current >= goal.target ? " complete" : ""}`;
      const label = document.createElement("span");
      label.textContent = goal.label;
      const value = document.createElement("strong");
      value.textContent = `${Math.min(goal.current, goal.target)} / ${goal.target}${goal.current >= goal.target ? " ✓" : ""}`;
      item.append(label, value);
      if (bars) {
        const progress = document.createElement("progress");
        progress.max = goal.target;
        progress.value = Math.min(goal.current, goal.target);
        progress.setAttribute("aria-label", goal.label);
        item.append(progress);
      }
      element.append(item);
    }
  }

  /** Updates compact in-game objectives and moves for a level, or hides them for free play. */
  updateRun(run) {
    this.run = run;
    document.querySelector(".game").classList.toggle("level-active", this.view === "play" && Boolean(run));
    document.getElementById("level-hud").hidden = !run;
    document.getElementById("goal-list").hidden = !run;
    document.querySelector(".screen").classList.toggle("campaign", Boolean(run));
    document.getElementById("restart").setAttribute("aria-label", run ? "Restart level" : "New game");
    if (!run) return;
    document.getElementById("level-label").textContent = `${String(run.level.id).padStart(2, "0")} · ${run.level.name}`;
    const remaining = Math.max(0, run.level.moves - run.moves);
    document.getElementById("moves-left").textContent = `${remaining} ${remaining === 1 ? "MOVE" : "MOVES"}`;
    document.getElementById("moves-left").classList.toggle("low-moves", remaining <= 3);
    this.renderGoals(document.getElementById("goal-list"), run, true);
  }

  /** Presents the settled attempt result and persists successful level completion. */
  result(run) {
    const won = run.result === "won";
    this.active = false;
    if (won && !this.profile.completed.includes(run.level.id)) {
      this.profile.completed.push(run.level.id);
      saveProfile(this.profile);
    }
    document.getElementById("result-label").textContent = `LEVEL ${String(run.level.id).padStart(2, "0")} · ${run.level.name}`;
    document.getElementById("result-title").textContent = won ? "Level cleared!" : "Out of moves";
    document.getElementById("result-copy").textContent = won ? `${run.score} points · ${run.moves} moves used${run.level.id === LEVELS.length ? ". First circuit complete!" : ""}` : "Try another angle. Retry uses the same starting board.";
    document.getElementById("result-next").hidden = !won || run.level.id === LEVELS.length;
    document.getElementById("result-retry").textContent = won ? "PLAY AGAIN" : "TRY AGAIN";
    this.renderGoals(document.getElementById("result-goals"), run);
    document.getElementById("result-dialog").showModal();
  }
}
