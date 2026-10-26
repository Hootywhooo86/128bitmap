import type { Mode } from "./geo";

// Small user settings, kept on the device.
export type Theme = "classic" | "retro";

const THEME_KEY = "128bitmaps.theme";
const VOICE_KEY = "128bitmaps.voice";

export function loadTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === "retro" ? "retro" : "classic";
  } catch {
    return "classic";
  }
}

export function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Not remembered in private mode.
  }
}

export function loadVoice(): boolean {
  try {
    return localStorage.getItem(VOICE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function saveVoice(on: boolean) {
  try {
    localStorage.setItem(VOICE_KEY, on ? "on" : "off");
  } catch {
    // Not remembered in private mode.
  }
}

const MODE_KEY = "128bitmaps.mode";

export function loadMode(): Mode {
  try {
    const m = localStorage.getItem(MODE_KEY);
    return m === "walk" || m === "bike" ? m : "drive";
  } catch {
    return "drive";
  }
}

export function saveMode(mode: Mode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Not remembered in private mode.
  }
}

// Day or night look for the classic map. "auto" follows the phone's dark mode.
export type Appearance = "auto" | "light" | "dark";
const APPEARANCE_KEY = "128bitmaps.appearance";

export function loadAppearance(): Appearance {
  try {
    const v = localStorage.getItem(APPEARANCE_KEY);
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}

export function saveAppearance(value: Appearance) {
  try {
    localStorage.setItem(APPEARANCE_KEY, value);
  } catch {
    // Not remembered in private mode.
  }
}
