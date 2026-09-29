import { Capacitor } from "@capacitor/core";
import type { LngLat } from "./geo";

// The same code runs in a browser and inside the Android/iPhone app.
// Inside the app we use the phone's native location and share sheet, which are more reliable
// than the browser versions in a WebView.

export const isNative = () => Capacitor.isNativePlatform();

export async function currentPosition(): Promise<LngLat> {
  if (isNative()) {
    const { Geolocation } = await import("@capacitor/geolocation");
    const perm = await Geolocation.requestPermissions();
    if (perm.location === "denied") throw new Error("Location is off for this app. Turn it on in Settings.");
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
    return [pos.coords.longitude, pos.coords.latitude];
  }
  if (!navigator.geolocation) throw new Error("This device can't share its location.");
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.longitude, pos.coords.latitude]),
      () => reject(new Error("Location is blocked. Allow it in your browser settings.")),
      { enableHighAccuracy: true, timeout: 10000 },
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
