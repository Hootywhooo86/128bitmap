import { Capacitor } from "@capacitor/core";
import type { LngLat } from "./geo";
import { Guidance, hasBackgroundGuidance, nativeVoice, setServiceUp } from "./guidance";

// The same code runs in a browser and inside the Android/iPhone app.
// Inside the app we use the phone's native location and share sheet, which are more reliable
// than the browser versions in a WebView.

export const isNative = () => Capacitor.isNativePlatform();

// A quick one-off position. `fast` accepts a recent, rougher fix (good for centring the map);
// turn-by-turn uses watchPosition, which asks for the best GPS.
export async function currentPosition(fast = true): Promise<LngLat> {
  if (isNative()) {
    const { Geolocation } = await import("@capacitor/geolocation");
    const perm = await Geolocation.requestPermissions();
    if (perm.location === "denied") throw new Error("Location is off for this app. Turn it on in Settings.");
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: !fast,
      timeout: 10000,
      maximumAge: fast ? 120000 : 0,
    });
    return [pos.coords.longitude, pos.coords.latitude];
  }
  if (!navigator.geolocation) throw new Error("This device can't share its location.");
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.longitude, pos.coords.latitude]),
      () => reject(new Error("Location is blocked. Allow it in your browser settings.")),
      { enableHighAccuracy: !fast, timeout: 10000, maximumAge: fast ? 120000 : 0 },
    );
  });
}

// Browser: download a file. App: write it and open the share sheet (save to Files, email, etc.).
export async function saveBackupFile(json: string, filename: string): Promise<void> {
  if (isNative()) {
    const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const written = await Filesystem.writeFile({
      path: filename,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: "128BITMAPS backup", url: written.uri, dialogTitle: "Save your backup" });
    return;
  }
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Android's back button: close whatever is open first, and only leave the app when nothing is.
export async function onBackButton(handler: () => boolean): Promise<() => void> {
  if (!isNative()) return () => {};
  const { App } = await import("@capacitor/app");
  const sub = await App.addListener("backButton", () => {
    if (!handler()) void App.exitApp();
  });
  return () => void sub.remove();
}

export type Fix = { at: LngLat; heading: number | null; speed: number | null; accuracy: number | null };

// Follows your position while navigating. Returns a function that stops following.
export async function watchPosition(
  onFix: (fix: Fix) => void,
  onError: (message: string) => void,
  background?: { title: string; text: string; end: string; onEnd: () => void },
): Promise<() => void> {
  const toFix = (c: { latitude: number; longitude: number; heading?: number | null; speed?: number | null; accuracy?: number }): Fix => ({
    at: [c.longitude, c.latitude],
    heading: typeof c.heading === "number" && !Number.isNaN(c.heading) ? c.heading : null,
    speed: typeof c.speed === "number" && !Number.isNaN(c.speed) ? c.speed : null,
    accuracy: typeof c.accuracy === "number" ? c.accuracy : null,
  });
  // Android: a foreground service with the fused (best available) GPS, which keeps going with the
  // screen off and shows the next turn on the lock screen.
  if (isNative() && hasBackgroundGuidance() && background) {
    try {
      const access = await Guidance.requestAccess();
      if (!access.location) {
        onError("Location is off for this app. Turn it on in Settings to get directions as you move.");
        return () => {};
      }
      const fixHandle = await Guidance.addListener("fix", (f) =>
        onFix({
          at: [f.lng, f.lat],
          heading: f.heading >= 0 ? f.heading : null,
          speed: f.speed >= 0 ? f.speed : null,
          accuracy: f.accuracy >= 0 ? f.accuracy : null,
        }),
      );
      const endHandle = await Guidance.addListener("end", background.onEnd);
      await Guidance.start({ title: background.title, text: background.text, end: background.end });
      setServiceUp(true);
      void Guidance.showOnLock({ on: true });
      return () => {
        setServiceUp(false);
        void fixHandle.remove();
        void endHandle.remove();
        void Guidance.stop();
      };
    } catch {
      // Fall through to the ordinary location watch below.
    }
  }
  if (isNative()) {
    const { Geolocation } = await import("@capacitor/geolocation");
    const perm = await Geolocation.requestPermissions();
    if (perm.location === "denied") {
      onError("Location is off for this app. Turn it on in Settings to get directions as you move.");
      return () => {};
    }
    const id = await Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 15000 }, (pos, err) => {
      if (pos) onFix(toFix(pos.coords));
      else if (err) onError("Can't find your position right now.");
    });
    return () => void Geolocation.clearWatch({ id });
  }
  if (!navigator.geolocation) {
    onError("This device can't share its location.");
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => onFix(toFix(pos.coords)),
    (err) =>
      onError(
        err.code === err.PERMISSION_DENIED
          ? "Location is blocked. Allow it in your browser settings to get directions as you move."
          : "Can't find your position right now.",
      ),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

// Spoken directions use the device's own voice, so they work offline and cost nothing.
export function speak(text: string) {
  if (nativeVoice()) {
    void Guidance.speak({ text });
    return;
  }
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  } catch {
    // Speech is a nice extra; never let it break navigation.
  }
}

export function stopSpeaking() {
  if (nativeVoice()) void Guidance.hush();
  try {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  } catch {
    // Nothing to stop.
  }
}

// Keeps the screen on while you're being guided, where the device allows it.
export function keepScreenAwake(): () => void {
  type Lock = { release: () => Promise<void> };
  const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<Lock> } };
  if (!nav.wakeLock) return () => {};
  let lock: Lock | null = null;
  let stopped = false;
  const grab = () => {
    nav.wakeLock?.request("screen").then((l) => {
      if (stopped) void l.release();
      else lock = l;
    }, () => {});
  };
  const onVisible = () => {
    if (document.visibilityState === "visible" && !stopped) grab();
  };
  grab();
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    stopped = true;
    document.removeEventListener("visibilitychange", onVisible);
    void lock?.release();
  };
}
