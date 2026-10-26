// A tiny pixel-drawing toolkit. Every building and car is drawn in code with these
// helpers, so the whole set shares one look, stays crisp at any size, and needs no image files.

export const INK = "#232042";
export const SHADOW = "#23204255";

export type Color = string | null;

export class Grid {
  readonly w: number;
  readonly h: number;
  cells: Color[];
  private later: (() => void)[] = [];

  constructor(w = 24, h = 24) {
    this.w = w;
    this.h = h;
    this.cells = new Array(w * h).fill(null);
  }

  get(x: number, y: number): Color {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.cells[y * this.w + x];
  }

  px(x: number, y: number, c: Color) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.cells[y * this.w + x] = c;
  }

  rect(x: number, y: number, w: number, h: number, c: Color) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }

  hline(x: number, y: number, w: number, c: Color) {
    this.rect(x, y, w, 1, c);
  }

  vline(x: number, y: number, h: number, c: Color) {
    this.rect(x, y, 1, h, c);
  }

  // Filled block with a darker right-hand edge, which is all the shading the style needs.
  box(x: number, y: number, w: number, h: number, c: Color, d: Color = c) {
    this.rect(x, y, w, h, c);
    this.rect(x + w - 1, y, 1, h, d);
  }

  // Draw something after the outline pass, so glows and beams don't get an ink border.
  late(fn: () => void) {
    this.later.push(fn);
  }

  // The finished sprite at double resolution (set by finish()). Every sprite is designed on a small
  // grid, then redrawn on a grid twice as fine: diagonals and corners are smoothed, edges are lit
  // and shaded, and the ink outline is one fine pixel thick, so the art reads as detailed 128-bit
  // pixel art instead of chunky blocks.
  hd: Grid | null = null;

  finish(outline = true) {
    const base = this.cells.slice();
    const up = upscale2x(this);
    bevel(up);
    if (outline) inkOutline(up);
    // Glows and beams are drawn on the small grid, then laid over the outlined sprite.
    for (const fn of this.later) fn();
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = this.cells[y * this.w + x];
        if (c !== base[y * this.w + x] && c !== null) up.rect(x * 2, y * 2, 2, 2, c);
      }
    }
    this.cells = base;
    if (outline) groundShadow(up);
    this.hd = up;
  }
}

const hex = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i;

// Lighten (f > 0) or darken (f < 0) a colour; anything that isn't a plain hex colour is left alone.
export function shade(c: string, f: number): string {
  const m = hex.exec(c);
  if (!m) return c;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)));
  return `#${ch.map((v) => v.toString(16).padStart(2, "0")).join("")}${m[2] ?? ""}`;
}

// Scale2x: doubles the grid and rounds off the stair-steps on diagonals, keeping flat colours crisp.
function upscale2x(g: Grid): Grid {
  const out = new Grid(g.w * 2, g.h * 2);
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const p = g.get(x, y);
      const a = g.get(x, y - 1);
      const b = g.get(x + 1, y);
      const c = g.get(x - 1, y);
      const d = g.get(x, y + 1);
      const tl = c === a && c !== d && a !== b ? a : p;
      const tr = a === b && a !== c && b !== d ? b : p;
      const bl = d === c && d !== b && c !== a ? c : p;
      const br = b === d && b !== a && d !== c ? d : p;
      out.cells[(y * 2) * out.w + x * 2] = tl;
      out.cells[(y * 2) * out.w + x * 2 + 1] = tr;
      out.cells[(y * 2 + 1) * out.w + x * 2] = bl;
      out.cells[(y * 2 + 1) * out.w + x * 2 + 1] = br;
    }
  }
  return out;
}

// Light from the top left: lit top and left edges, shaded bottom and right edges, and a light
// checkerboard dither just above the bottom edge so surfaces fall into shadow gradually.
function bevel(g: Grid) {
  const src = g.cells.slice();
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= g.w || y >= g.h ? null : src[y * g.w + x]);
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const c = src[y * g.w + x];
      if (!c || c === INK) continue;
      let f = 0;
      if (!at(x, y - 1)) f += 0.2;
      else if (!at(x - 1, y)) f += 0.1;
      if (!at(x, y + 1)) f -= 0.22;
      else if (!at(x + 1, y)) f -= 0.12;
      else if (!at(x, y + 2) && (x + y) % 2 === 0) f -= 0.1;
      else if (!at(x, y + 3) && (x + y) % 2 === 0) f -= 0.05;
      if (f) g.cells[y * g.w + x] = shade(c, f);
    }
  }
}

function inkOutline(g: Grid) {
  const solid = g.cells.map((c) => c !== null);
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (solid[y * g.w + x]) continue;
      const near =
        (x > 0 && solid[y * g.w + x - 1]) ||
        (x < g.w - 1 && solid[y * g.w + x + 1]) ||
        (y > 0 && solid[(y - 1) * g.w + x]) ||
        (y < g.h - 1 && solid[(y + 1) * g.w + x]);
      if (near) g.cells[y * g.w + x] = INK;
    }
  }
}

// A soft shadow on the ground under the sprite.
function groundShadow(g: Grid) {
  let bottom = -1;
  let lo = g.w;
  let hi = -1;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.get(x, y) !== null) bottom = y;
  for (let y = Math.max(0, bottom - 8); y <= bottom; y++) {
    for (let x = 0; x < g.w; x++) {
      if (g.get(x, y) !== null) {
        lo = Math.min(lo, x);
        hi = Math.max(hi, x);
      }
    }
  }
  if (hi < lo) return;
  for (let y = bottom + 1; y <= bottom + 2 && y < g.h; y++) for (let x = lo + 2; x < hi - 1; x++) if (g.get(x, y) === null) g.px(x, y, SHADOW);
}

export function disc(
  g: Grid,
  cx: number,
  cy: number,
  r: number,
  c: Color,
  clip: { y0?: number; y1?: number } = {},
) {
  const y0 = clip.y0 ?? -999;
  const y1 = clip.y1 ?? 999;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (y >= y0 && y <= y1 && dx * dx + dy * dy <= r * r + r * 0.8) g.px(x, y, c);
    }
  }
}

export function line(g: Grid, x0: number, y0: number, x1: number, y1: number, c: Color) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    g.px(x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

// Pitched roof: w is the full width (even). Starts narrow at `top`, widens one pixel each side per row.
export function roof(g: Grid, x: number, top: number, w: number, c: Color, d: Color = c) {
  const half = w / 2;
  for (let i = 0; i < half; i++) {
    const left = x + half - 1 - i;
    const right = x + half + i;
    for (let px = left; px <= right; px++) g.px(px, top + i, px >= x + half ? d : c);
  }
}

// Change the colour of pixels that are already drawn inside a region.
export function recolor(
  g: Grid,
  x: number,
  y: number,
  w: number,
  h: number,
  fn: (x: number, y: number, current: string) => Color | undefined,
) {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) {
      const cur = g.get(i, j);
      if (cur === null) continue;
      const next = fn(i, j, cur);
      if (next !== undefined) g.px(i, j, next);
    }
  }
}

const cache = new Map<string, string>();

export function gridToDataUrl(g: Grid, key: string): string {
  const hit = cache.get(key);
  if (hit) return hit;
  g = g.hd ?? g;
  const canvas = document.createElement("canvas");
  canvas.width = g.w;
  canvas.height = g.h;
  const ctx = canvas.getContext("2d")!;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const c = g.cells[y * g.w + x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}
