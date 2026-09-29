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

  // Ink outline around everything drawn, then a soft ground shadow under the bottom edge.
  finish() {
    const solid = this.cells.map((c) => c !== null);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (solid[y * this.w + x]) continue;
        const near =
          (x > 0 && solid[y * this.w + x - 1]) ||
          (x < this.w - 1 && solid[y * this.w + x + 1]) ||
          (y > 0 && solid[(y - 1) * this.w + x]) ||
          (y < this.h - 1 && solid[(y + 1) * this.w + x]);
        if (near) this.cells[y * this.w + x] = INK;
      }
    }
    for (const fn of this.later) fn();
    let lo = this.w;
    let hi = -1;
    for (let y = this.h - 5; y < this.h - 1; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y) !== null) {
          lo = Math.min(lo, x);
          hi = Math.max(hi, x);
        }
      }
    }
    if (hi >= lo) {
      for (let x = lo + 1; x < hi; x++) if (this.get(x, this.h - 1) === null) this.px(x, this.h - 1, SHADOW);
    }
  }
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
