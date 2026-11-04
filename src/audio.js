/** Event-driven mechanical samples and short tuned match feedback. */
export class ShiftAudio {
  /** Subscribes audio feedback to the board event target. */
  constructor(events) {
    this.enabled = false;
    this.context = null;
    this.buffers = new Map();
    this.lastTick = 0;
    this.sources = new Set();
    for (const name of ["grab", "tick", "thunk", "whoosh", "match"])
      events.addEventListener(name, (e) => this.play(name, e.detail));
    document.addEventListener("visibilitychange", () => {
      if (!this.context) return;
      if (document.hidden) {
        this.context.suspend().catch(() => {});
      } else if (this.enabled) {
        this.context.resume().catch(() => {});
      }
    });
  }

  /** Unlocks Web Audio from a user gesture and loads local Quasar sound samples. */
  async unlock() {
    if (!this.context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw new Error("Web Audio unavailable");
      this.context = new Context();
      this.master = this.context.createGain();
      this.master.gain.value = 0.48;
      this.master.connect(this.context.destination);
      this.loading = Promise.all(
        ["grab", "tick", "thunk", "whoosh"].map(async (name) => {
          try {
            const response = await fetch(
              new URL(`../assets/audio/${name}.wav`, import.meta.url),
            );
            if (response.ok)
              this.buffers.set(
                name,
                await this.context.decodeAudioData(
                  await response.arrayBuffer(),
                ),
              );
          } catch {
            /* A missing sample leaves the other audio available. */
          }
        }),
      );
    }
    if (this.context.state === "suspended") await this.context.resume();
  }

  /** Sets audio enabled state, unlocking the context from a user gesture. */
  async setEnabled(enabled) {
    this.enabled = enabled;
    try {
      if (enabled) {
        await this.unlock();
      } else {
        if (this.context) await this.context.suspend();
      }
    } catch {
      this.enabled = false;
    }
    return this.enabled;
  }

  /** Plays a brief sine bell at frequency with a decaying gain envelope. */
  tone(frequency, volume = 0.06, duration = 1.8) {
    if (!this.enabled || !this.context || document.hidden) return;
    const t = this.context.currentTime,
      oscillator = this.context.createOscillator(),
      gain = this.context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(t);
    oscillator.stop(t + duration);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }

  /** Plays an interaction sample, or a cascading match chord, from event detail. */
  play(name, detail = {}) {
    if (!this.enabled || !this.context || document.hidden) return;
    if (name === "match") {
      const multiplier = Math.min(detail.chain || 1, 6);
      [261.63, 329.63, 392].forEach((f) =>
        this.tone(f * (1 + (multiplier - 1) * 0.125), 0.07, 0.38),
      );
      return;
    }
    const now = this.context.currentTime;
    if (name === "tick" && now - this.lastTick < 0.018) return;
    if (name === "tick") this.lastTick = now;
    const buffer = this.buffers.get(name);
    if (!buffer || this.sources.size >= 24) return;
    const source = this.context.createBufferSource(),
      gain = this.context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = 0.96 + Math.random() * 0.08;
    gain.gain.value = name === "tick" ? 0.32 : name === "thunk" ? 0.6 : 0.45;
    source.connect(gain);
    gain.connect(this.master);
    this.sources.add(source);
    source.start();
    source.onended = () => {
      this.sources.delete(source);
      source.disconnect();
      gain.disconnect();
    };
  }
}
