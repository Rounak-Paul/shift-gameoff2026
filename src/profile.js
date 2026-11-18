import { LEVELS } from "./levels.js";

const KEY = "shift.profile.v1";

/** Reads validated local preferences and completed level IDs; blocked storage uses defaults. */
export function loadProfile(storage) {
  let saved;
  try { saved = JSON.parse((storage ?? globalThis.localStorage).getItem(KEY)); } catch {}
  saved = saved && typeof saved === "object" ? saved : {};
  return {
    sound: typeof saved.sound === "boolean" ? saved.sound : true,
    volume: typeof saved.volume === "number" && Number.isFinite(saved.volume) ? Math.max(0, Math.min(1, saved.volume)) : 0.5,
    motion: ["system", "reduced", "full"].includes(saved.motion) ? saved.motion : "system",
    particles: typeof saved.particles === "boolean" ? saved.particles : true,
    completed: Array.isArray(saved.completed) ? [...new Set(saved.completed.filter((id) => Number.isInteger(id) && LEVELS.some((level) => level.id === id)))] : [],
  };
}

/** Persists profile when storage is available; returns whether the write succeeded. */
export function saveProfile(profile, storage) {
  try {
    (storage ?? globalThis.localStorage).setItem(KEY, JSON.stringify(profile));
    return true;
  } catch { return false; }
}
