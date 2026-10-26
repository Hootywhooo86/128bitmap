import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

// The Android-only half of guidance (see android/.../GuidancePlugin.java): a foreground service that
// keeps the phone's best GPS running with the screen off, a lock-screen notification, and spoken
// directions that keep going in the background.
type NativeFix = { lat: number; lng: number; accuracy: number; speed: number; heading: number; time: number };

type GuidancePlugin = {
  requestAccess(): Promise<{ location: boolean; notifications: boolean }>;
  start(options: { title: string; text: string; end: string }): Promise<void>;
  update(options: { title: string; text: string; short: string; percent: number; end: string }): Promise<void>;
  stop(): Promise<void>;
  speak(options: { text: string }): Promise<void>;
  hush(): Promise<void>;
  showOnLock(options: { on: boolean }): Promise<void>;
  addListener(name: "fix", cb: (fix: NativeFix) => void): Promise<PluginListenerHandle>;
  addListener(name: "end", cb: () => void): Promise<PluginListenerHandle>;
};

export const Guidance = registerPlugin<GuidancePlugin>("Guidance");

export const hasBackgroundGuidance = () => Capacitor.getPlatform() === "android";

// True while the background service is up, so speech goes through the phone's own voice
// (which keeps talking when the screen is off) instead of the web view's.
let serviceUp = false;
export const nativeVoice = () => serviceUp;
export const setServiceUp = (on: boolean) => {
  serviceUp = on;
};
