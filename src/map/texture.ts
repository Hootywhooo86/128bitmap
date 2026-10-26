import { shade } from "../pixel/draw";
import { PALETTE } from "./retroStyle";

// Tiny pixel textures that tile across the retro map, so grass, trees and water have detail
// instead of flat fills. Each is 16x16 and is added to the map the first time a layer asks for it.
type Recipe = { base: string; dots: [number, number, string][] };


const lite = (c: string) => shade(c, 0.3);
const dark = (c: string) => shade(c, -0.2);

type Dot = [number, number, string];

// A little grass tuft: three pixels in a V.
const tuft = (x: number, y: number, c: string): Dot[] => [[x, y, c], [x - 1, y - 1, c], [x + 1, y - 1, c]];
// A two-pixel dash, used for light on water and on grass.
const dash = (x: number, y: number, c: string): Dot[] => [[x, y, c], [x + 1, y, c]];

const RECIPES: Record<string, Recipe> = {
  "tex-grass": {
    base: PALETTE.grass,
    dots: [
      ...tuft(3, 4, dark(PALETTE.grass)), ...tuft(11, 3, dark(PALETTE.grass)), ...tuft(7, 10, dark(PALETTE.grass)), ...tuft(14, 13, dark(PALETTE.grass)),
      ...dash(9, 7, lite(PALETTE.grass)), ...dash(1, 12, lite(PALETTE.grass)),
    ],
  },
  "tex-meadow": {
    base: PALETTE.meadow,
    dots: [
      ...tuft(4, 5, dark(PALETTE.meadow)), ...tuft(12, 11, dark(PALETTE.meadow)),
      ...dash(9, 3, lite(PALETTE.meadow)), ...dash(2, 13, lite(PALETTE.meadow)),
      [8, 8, "#ffe27a"], [14, 5, "#fff6df"], [1, 9, "#ffe27a"],
    ],
  },
  "tex-park": {
    base: PALETTE.park,
    dots: [
      ...tuft(3, 4, dark(PALETTE.park)), ...tuft(12, 12, dark(PALETTE.park)), ...tuft(9, 6, dark(PALETTE.park)),
      ...dash(1, 11, lite(PALETTE.park)), ...dash(13, 2, lite(PALETTE.park)),
      [7, 14, "#ff8fb3"], [2, 8, "#ffe27a"], [14, 8, "#fff6df"], [6, 1, "#ff8fb3"],
    ],
  },
  "tex-forest": {
    base: PALETTE.forest,
    dots: treeDots(4, 4).concat(treeDots(12, 11)),
  },
  "tex-water": {
    base: PALETTE.water,
    dots: [
      ...dash(2, 4, lite(PALETTE.water)), [4, 4, lite(PALETTE.water)],
      ...dash(10, 11, lite(PALETTE.water)), [12, 11, lite(PALETTE.water)],
      ...dash(6, 8, dark(PALETTE.water)), ...dash(13, 2, dark(PALETTE.water)),
    ],
  },
};

// A small tree: darker crown with a light top-left highlight.
function treeDots(cx: number, cy: number): [number, number, string][] {
  const c = dark(PALETTE.forest);
  const h = lite(PALETTE.forest);
  return [
    [cx, cy - 1, c], [cx + 1, cy - 1, c], [cx - 1, cy, c], [cx, cy, h], [cx + 1, cy, c], [cx + 2, cy, c],
    [cx - 1, cy + 1, c], [cx, cy + 1, c], [cx + 1, cy + 1, c], [cx + 2, cy + 1, c], [cx, cy + 2, c], [cx + 1, cy + 2, c],
  ];
}

export function textureIds(): string[] {
  return Object.keys(RECIPES);
}

export function makeTexture(id: string): ImageData | null {
  const r = RECIPES[id];
  if (!r) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = r.base;
  ctx.fillRect(0, 0, 16, 16);
  for (const [x, y, c] of r.dots) {
    ctx.fillStyle = c;
    ctx.fillRect(((x % 16) + 16) % 16, ((y % 16) + 16) % 16, 1, 1);
  }
  return ctx.getImageData(0, 0, 16, 16);
}
