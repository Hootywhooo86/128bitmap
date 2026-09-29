import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // The app's permanent store ID. Change it BEFORE you first publish; it can't change afterwards.
  appId: "app.bitmaps128.map",
  appName: "128BITMAPS",
  webDir: "dist",
  backgroundColor: "#2b2750",
  android: { backgroundColor: "#2b2750" },
  ios: { backgroundColor: "#2b2750", contentInset: "never" },
};

export default config;
