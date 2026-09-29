import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Relative paths, so the same build works at a site root, in a GitHub Pages subfolder,
  // and inside the Android and iPhone apps.
  base: "./",
  plugins: [react()],
  worker: { format: "es" },
  build: { chunkSizeWarningLimit: 1500 },
});
