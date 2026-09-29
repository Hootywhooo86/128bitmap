import { BUILDINGS } from "../pixel/buildings";
import { CARS } from "../pixel/cars";
import { frameUrl } from "../pixel/frames";

// Developer-only contact sheet (open the dev server with ?sprites&f=0..3).
export function SpriteSheet() {
  const f = Number(new URLSearchParams(location.search).get("f") ?? 0);
  return (
    <div style={{ background: "#8fd35f", minHeight: "100vh", padding: 8, overflow: "auto", height: "100vh" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 120px)", gap: 4 }}>
        {BUILDINGS.map((b) => (
          <div key={b.id} style={{ textAlign: "center", font: "14px monospace", color: "#232042" }}>
            <img src={frameUrl("building", b.id, f)} width={96} height={96} style={{ imageRendering: "pixelated" }} />
            <div>{b.name}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 240px)", gap: 4, marginTop: 8 }}>
        {CARS.map((c) => (
          <div key={c.id} style={{ textAlign: "center", font: "14px monospace", color: "#232042" }}>
            <img src={frameUrl("car", c.id, f)} width={192} height={112} style={{ imageRendering: "pixelated" }} />
            <div>{c.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
