import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";
import App from "./App.tsx";

async function boot() {
  const root = createRoot(document.getElementById("root")!);
  if (import.meta.env.DEV && location.search.includes("sprites")) {
    const { SpriteSheet } = await import("./dev/SpriteSheet");
    root.render(<SpriteSheet />);
    return;
  }
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
