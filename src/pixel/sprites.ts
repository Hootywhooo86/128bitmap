// Pixel sprites are written as text grids: one character per pixel, "." is transparent.
// This keeps every piece of art in code, crisp at any size, and easy to add more of later.

export type Sprite = {
  grid: string[];
  colors: Record<string, string>;
};

const INK = "#232042";

export const START_FLAG: Sprite = {
  colors: { k: INK, g: "#3ddc6a", G: "#1f9e46", w: "#fff6df", s: "#00000055" },
  grid: [
    "..kk............",
    "..kwkkkkkkk.....",
    "..kwgggggggkk...",
    "..kwggGggggggk..",
    "..kwgGGGgggggk..",
    "..kwggGggggggk..",
    "..kwgggggggkk...",
    "..kwkkkkkkk.....",
    "..kw............",
    "..kw............",
    "..kw............",
    "..kw............",
    "..kw............",
    ".kkkk...........",
    "kwwwwk..........",
    ".ssss...........",
  ],
};

export const GOAL_FLAG: Sprite = {
  colors: { k: INK, w: "#fff6df", b: INK, r: "#ff4d6d", s: "#00000055" },
  grid: [
    "..kk............",
    "..kwkkkkkkkk....",
    "..kwwbwbwbwbk...",
    "..kwbwbwbwbwk...",
    "..kwwbwbwbwbk...",
    "..kwbwbwbwbwk...",
    "..kwkkkkkkkk....",
    "..kw............",
    "..kw............",
    "..kw............",
    "..kw............",
    "..kw............",
    "..kw............",
    ".kkkk...........",
    "krrrrk..........",
    ".ssss...........",
  ],
};

export const YOU_DOT: Sprite = {
  colors: { k: INK, w: "#fff6df", c: "#3fd0ff", C: "#1a8fd6" },
  grid: [
    "...kkkk...",
    "..kwwwwk..",
    ".kwccccwk.",
    "kwccCCccwk",
    "kwcCCCCcwk",
    "kwcCCCCcwk",
    "kwccCCccwk",
    ".kwccccwk.",
    "..kwwwwk..",
    "...kkkk...",
  ],
};

export const DROP_PIN: Sprite = {
  colors: { k: INK, p: "#b17cff", P: "#7a4fd0", w: "#fff6df" },
  grid: [
    "..kkkkk..",
    ".kpppppk.",
    "kppwwwPPk",
    "kppwwwPPk",
    "kpppppPPk",
    ".kPPPPPk.",
    "..kPPPk..",
    "...kPk...",
    "....k....",
  ],
};

export function spriteToCanvas(sprite: Sprite, scale: number): HTMLCanvasElement {
  const h = sprite.grid.length;
  const w = Math.max(...sprite.grid.map((row) => row.length));
  const canvas = document.createElement("canvas");
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext("2d")!;
  sprite.grid.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = sprite.colors[ch];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    });
  });
  return canvas;
}

export function spriteToImageData(sprite: Sprite, scale: number): ImageData {
  const canvas = spriteToCanvas(sprite, scale);
  return canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
}

export function spriteToDataUrl(sprite: Sprite, scale: number): string {
  return spriteToCanvas(sprite, scale).toDataURL();
}
