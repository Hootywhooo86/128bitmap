import { Grid, disc, gridToDataUrl, line, recolor, roof } from "./draw";

// 50 pixel buildings on 24x24 grids. Base row is 21 so the outline and shadow fit below.
// Each draw function gets the frame number (0-3) so buildings can flicker, smoke, spin and sway.

const K = {
  stone: "#9a97b5",
  stoneD: "#6f6b93",
  stoneL: "#c3c0d8",
  wood: "#a8703f",
  woodD: "#75471f",
  woodL: "#cf9a5c",
  red: "#e0475b",
  redD: "#a02a45",
  blue: "#4a86e8",
  blueD: "#2f57b0",
  green: "#4fbf5a",
  greenD: "#2f8a3e",
  greenL: "#8fe07a",
  yellow: "#ffd23f",
  yellowD: "#c9a020",
  orange: "#ff8c3a",
  orangeD: "#c96a25",
  white: "#fff6df",
  cream: "#f2e3bd",
  creamD: "#d8c496",
  purple: "#8a5ad8",
  purpleD: "#5a3aa0",
  teal: "#3ddcc8",
  tealD: "#2aa896",
  pink: "#ff8fb3",
  pinkD: "#e0608e",
  gray: "#7a7a90",
  grayD: "#56566e",
  grayL: "#a8a8be",
  dark: "#3a3560",
  night: "#15122b",
  glass: "#8fd8ff",
  glassD: "#4aa0d8",
  fire1: "#ff5a3a",
  fire2: "#ffb03a",
  fire3: "#ffe27a",
  brick: "#c0654a",
  brickD: "#96472f",
  gold: "#ffc83a",
  rock: "#8b7a6a",
  rockD: "#6a5a4c",
  water: "#3b7de0",
  waterL: "#7fb4ff",
  ice: "#cfe6f5",
};

export type ShelfId =
  | "homes"
  | "work"
  | "fitness"
  | "food"
  | "shopping"
  | "school"
  | "health"
  | "fun"
  | "travel"
  | "family";

export const SHELVES: { id: ShelfId; label: string }[] = [
  { id: "homes", label: "Homes" },
  { id: "work", label: "Work" },
  { id: "fitness", label: "Fitness" },
  { id: "food", label: "Food" },
  { id: "shopping", label: "Shops" },
  { id: "school", label: "School" },
  { id: "health", label: "Health" },
  { id: "fun", label: "Fun" },
  { id: "travel", label: "Travel" },
  { id: "family", label: "Family" },
];

export type Building = {
  id: string;
  name: string;
  shelf: ShelfId;
  draw: (g: Grid, f: number) => void;
};

// ---------- shared parts ----------

function win(g: Grid, x: number, y: number, lit = true, c = K.yellow) {
  g.rect(x, y, 2, 2, lit ? c : K.dark);
  if (!lit) g.px(x, y, K.blueD);
}

function door(g: Grid, x: number, y: number, w: number, h: number, c = K.woodD) {
  g.rect(x, y, w, h, c);
  g.px(x + w - 2, y + Math.floor(h / 2), K.yellow);
}

function flame(g: Grid, x: number, y: number, f: number) {
  const a = f % 2;
  g.rect(x, y + 1, 2, 2, K.fire2);
  g.hline(x, y + 2, 2, K.fire1);
  g.px(x + a, y, K.fire2);
  g.px(x + (1 - a), y + 1, K.fire3);
}

function smoke(g: Grid, x: number, y: number, f: number, c = K.white) {
  for (let k = 0; k < 3; k++) g.rect(x + ((k + (f >> 1)) % 2), y - 2 * k - (f & 1), 2, 1, c);
}

function flag(g: Grid, x: number, y: number, c: string, f: number, h = 6) {
  g.vline(x, y, h, K.woodD);
  g.rect(x + 1, y, 3, 2, c);
  if (f & 1) g.px(x + 4, y, c);
  else g.px(x + 4, y + 1, c);
}

function star(g: Grid, x: number, y: number, f: number, phase: number) {
  g.px(x, y, K.white);
  if ((f + phase) % 4 < 2) {
    g.px(x - 1, y, K.yellow);
    g.px(x + 1, y, K.yellow);
    g.px(x, y - 1, K.yellow);
    g.px(x, y + 1, K.yellow);
  }
}

function battle(g: Grid, x: number, y: number, w: number, c: string) {
  for (let i = 0; i < w; i += 2) g.px(x + i, y, c);
}

function columns(g: Grid, xs: number[], y: number, h: number, c: string, d: string) {
  for (const x of xs) {
    g.vline(x, y, h, c);
    g.vline(x + 1, y, h, d);
  }
}

function wheel(g: Grid, cx: number, cy: number, f: number) {
  disc(g, cx, cy, 2, K.night);
  g.px(cx, cy, K.grayL);
  const spokes: [number, number][] = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  const [sx, sy] = spokes[f % 4];
  g.px(cx + sx, cy + sy, K.gray);
}

const HASH = (a: number, b: number) => ((a * 73856093) ^ (b * 19349663)) >>> 0;

// ---------- homes ----------

function castle(g: Grid, f: number) {
  flag(g, 4, 0, K.red, f, 5);
  g.box(6, 10, 12, 12, K.stone, K.stoneD);
  g.box(2, 6, 5, 16, K.stone, K.stoneD);
  g.box(17, 6, 5, 16, K.stone, K.stoneD);
  battle(g, 2, 5, 5, K.stone);
  battle(g, 17, 5, 5, K.stone);
  battle(g, 6, 9, 12, K.stone);
  g.rect(4, 10, 1, 3, K.night);
  g.rect(19, 10, 1, 3, K.night);
  win(g, 8, 12);
  win(g, 14, 12);
  g.rect(9, 15, 6, 7, K.stoneD);
  g.rect(10, 16, 4, 6, K.woodD);
  const glow = f % 2 ? K.orange : K.yellow;
  for (const y of [16, 18, 20]) g.hline(10, y, 4, glow);
}

function cottage(g: Grid, f: number) {
  g.box(15, 3, 3, 8, K.stone, K.stoneD);
  smoke(g, 16, 2, f);
  g.box(4, 14, 16, 8, K.cream, K.creamD);
  roof(g, 3, 5, 18, K.red, K.redD);
  door(g, 10, 16, 4, 6);
  win(g, 5, 16);
  win(g, 16, 16);
  g.hline(5, 19, 2, K.green);
  g.px(5, 18, K.pink);
  g.px(6, 18, f % 2 ? K.yellow : K.pink);
}

function treehouse(g: Grid, f: number) {
  g.box(10, 17, 4, 5, K.wood, K.woodD);
  g.rect(8, 21, 8, 1, K.woodD);
  disc(g, 5, 13, 3, K.green);
  disc(g, 19, 13, 3, K.green);
  disc(g, 6, 15, 1, K.greenD);
  disc(g, 18, 15, 1, K.greenD);
  g.rect(4, 15, 16, 2, K.woodL);
  g.hline(4, 16, 16, K.wood);
  g.box(8, 9, 8, 6, K.woodL, K.wood);
  roof(g, 7, 4, 10, K.green, K.greenD);
  win(g, 10, 11, f < 3);
  g.rect(13, 12, 2, 3, K.woodD);
  for (let y = 17; y < 22; y += 2) g.px(6, y, K.cream);
  g.vline(6, 17, 5, K.woodD);
}

function igloo(g: Grid, f: number) {
  disc(g, 11, 18, 9, K.white, { y1: 21 });
  recolor(g, 2, 9, 20, 13, (x, y, cur) => {
    if (cur !== K.white) return undefined;
    if (x >= 16) return "#dcebf5";
    if (y === 12 || y === 15 || y === 18) return K.ice;
    const off = (Math.floor(y / 3) % 2) * 3;
    if ((x + off) % 6 === 0) return K.ice;
    return undefined;
  });
  g.box(15, 16, 7, 6, K.white, K.ice);
  g.rect(16, 18, 4, 4, K.night);
  g.rect(17, 20, 2, 1, f % 2 ? K.orange : K.yellow);
  star(g, 4, 5, f, 0);
  star(g, 20, 7, f, 2);
}

function wizard(g: Grid, f: number) {
  g.box(8, 9, 8, 13, K.purple, K.purpleD);
  roof(g, 6, 1, 12, K.blue, K.blueD);
  g.rect(5, 7, 14, 2, K.blueD);
  g.px(12, 4, f % 2 ? K.yellow : K.white);
  g.px(12, 3, K.yellow);
  win(g, 11, 12, f < 3);
  g.rect(10, 17, 4, 5, K.night);
  g.rect(11, 16, 2, 1, K.night);
  star(g, 3, 4, f, 0);
  star(g, 20, 9, f, 2);
  star(g, 4, 15, f, 1);
}

// ---------- work ----------

function prison(g: Grid, f: number) {
  g.box(2, 10, 14, 12, K.gray, K.grayD);
  g.box(17, 8, 4, 14, K.grayD, K.night);
  g.box(16, 4, 6, 4, K.gray, K.grayD);
  g.rect(17, 5, 4, 2, K.yellow);
  g.hline(15, 3, 8, K.dark);
  for (const x of [4, 8, 12]) {
    g.rect(x, 12, 3, 4, K.night);
    g.vline(x + 1, 12, 4, K.grayL);
  }
  g.rect(6, 17, 4, 5, K.dark);
  g.vline(7, 17, 5, K.grayL);
  g.vline(9, 17, 5, K.grayL);
  for (let x = 2; x < 16; x += 2) {
    g.px(x, 9, K.grayL);
    g.px(x + 1, 8, K.grayL);
  }
  const targets: [number, number][] = [
    [3, 15],
    [1, 10],
    [3, 5],
    [1, 10],
  ];
  const [tx, ty] = targets[f % 4];
  g.late(() => {
    const beam = "#fff6a8aa";
    line(g, 16, 6, tx, ty, beam);
    line(g, 16, 5, tx, ty - 1, beam);
  });
}

function factory(g: Grid, f: number) {
  g.box(14, 2, 3, 10, K.stone, K.stoneD);
  g.box(18, 5, 3, 7, K.stone, K.stoneD);
  smoke(g, 15, 1, f);
  smoke(g, 19, 4, f + 2);
  g.box(2, 12, 19, 10, K.brick, K.brickD);
  for (let k = 0; k < 3; k++) {
    const x0 = 2 + k * 6;
    for (let i = 0; i < 3; i++) g.hline(x0, 9 + i, 2 + i * 2, K.gray);
    g.rect(x0, 9, 1, 3, K.grayD);
  }
  for (let i = 0; i < 3; i++) win(g, 4 + i * 5, 14, ((f + i) & 3) !== 0, K.orange);
  g.rect(9, 17, 6, 5, K.dark);
  g.hline(9, 19, 6, K.grayD);
  g.hline(2, 12, 19, K.brickD);
}

function office(g: Grid, f: number) {
  g.box(3, 13, 4, 9, K.gray, K.grayD);
  g.box(17, 11, 4, 11, K.gray, K.grayD);
  g.box(7, 3, 10, 19, K.glassD, K.blueD);
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 3; c++) {
      const lit = HASH(r * 3 + c, f >> 1) % 3 !== 0;
      g.rect(8 + c * 3, 5 + r * 3, 2, 2, lit ? K.fire3 : K.blueD);
    }
  }
  g.rect(11, 18, 3, 4, K.night);
  g.vline(12, 0, 3, K.grayL);
  g.px(12, 0, f % 2 ? K.red : K.redD);
  win(g, 4, 15, true);
  win(g, 18, 13, f < 2);
}

function mine(g: Grid, f: number) {
  roof(g, 2, 3, 20, K.rock, K.rockD);
  g.rect(2, 13, 20, 9, K.rock);
  g.rect(17, 13, 5, 9, K.rockD);
  g.rect(9, 14, 6, 8, K.night);
  g.vline(9, 14, 8, K.wood);
  g.vline(14, 14, 8, K.wood);
  g.hline(8, 13, 8, K.woodL);
  g.hline(9, 21, 6, K.grayL);
  const cartX = [10, 11, 12, 11][f % 4];
  g.rect(cartX, 18, 3, 2, K.gray);
  g.px(cartX, 17, K.yellow);
  g.px(cartX + 2, 17, K.yellow);
  g.px(12, 15, f % 2 ? K.yellow : K.orange);
  star(g, 6, 10, f, 0);
  g.px(17, 7, K.stoneL);
}

function lab(g: Grid, f: number) {
  g.box(4, 15, 16, 7, K.white, K.grayL);
  disc(g, 11, 15, 7, K.glass, { y1: 14 });
  recolor(g, 4, 8, 15, 7, (x) => (x >= 15 ? K.glassD : undefined));
  g.rect(9, 12, 4, 3, K.greenL);
  g.rect(10, 10, 2, 2, K.white);
  g.px(9 + (f % 3) * 2, 11 - (f >> 1), K.white);
  g.px(10 + (f % 2), 9, K.greenL);
  g.rect(9, 17, 6, 5, K.dark);
  g.vline(12, 17, 5, K.grayL);
  g.vline(20, 6, 10, K.grayL);
  g.px(20, 5, K.yellow);
  if (f % 2) {
    g.px(19, 6, K.yellow);
    g.px(21, 6, K.yellow);
  } else {
    g.px(19, 4, K.yellow);
    g.px(21, 4, K.yellow);
  }
}

// ---------- fitness ----------

function dungeon(g: Grid, f: number) {
  g.box(2, 9, 20, 13, K.stone, K.stoneD);
  battle(g, 2, 8, 20, K.stone);
  recolor(g, 2, 9, 20, 13, (x, y) => ((y % 4 === 0 && x % 5 !== 0) || (y % 4 === 2 && x % 5 === 2) ? K.stoneD : undefined));
  g.rect(8, 13, 8, 9, K.night);
  g.rect(9, 12, 6, 1, K.night);
  for (const x of [10, 12, 14]) g.vline(x, 13, 9, K.grayL);
  g.hline(8, 17, 8, K.gray);
  // barbell sign
  g.hline(9, 5, 6, K.grayL);
  g.rect(8, 3, 1, 5, K.gray);
  g.rect(15, 3, 1, 5, K.gray);
  g.rect(7, 4, 1, 3, K.grayD);
  g.rect(16, 4, 1, 3, K.grayD);
  g.vline(5, 13, 4, K.woodD);
  g.vline(18, 13, 4, K.woodD);
  flame(g, 4, 10, f);
  flame(g, 17, 10, f + 1);
}

function arena(g: Grid, f: number) {
  g.rect(2, 9, 20, 13, "#d9b98a");
  g.rect(18, 9, 4, 13, "#b89463");
  g.hline(1, 8, 22, "#e8d0a6");
  for (const y of [11, 16]) {
    for (const x of [4, 8, 12, 16]) {
      g.rect(x, y, 3, 4, K.night);
      g.px(x, y, "#d9b98a");
      g.px(x + 2, y, "#d9b98a");
    }
  }
  g.hline(2, 14, 20, "#b89463");
  flag(g, 5, 2, K.red, f, 6);
  flag(g, 12, 2, K.blue, f + 1, 6);
  flag(g, 18, 2, K.yellow, f, 6);
  for (let x = 2; x < 22; x += 2) g.px(x, 7, [K.red, K.blue, K.green, K.yellow][(x / 2 + f) % 4]);
}

function dojo(g: Grid, f: number) {
  g.box(6, 16, 12, 6, "#c95a4a", "#9a3a30");
  g.rect(10, 18, 4, 4, K.cream);
  g.vline(12, 18, 4, K.creamD);
  g.rect(3, 14, 18, 2, K.dark);
  g.px(2, 13, K.dark);
  g.px(21, 13, K.dark);
  g.box(8, 10, 8, 4, "#c95a4a", "#9a3a30");
  win(g, 11, 11, true, K.cream);
  g.rect(5, 8, 14, 2, K.dark);
  g.px(4, 7, K.dark);
  g.px(19, 7, K.dark);
  roof(g, 8, 2, 8, K.dark, K.night);
  g.px(12, 1, K.yellow);
  g.px(7, 18, f % 2 ? K.red : K.orange);
  g.px(16, 18, f % 2 ? K.orange : K.red);
}

function boxing(g: Grid, f: number) {
  g.box(2, 17, 20, 4, K.blue, K.blueD);
  g.hline(2, 16, 20, K.cream);
  g.vline(3, 8, 9, K.red);
  g.vline(20, 8, 9, K.blue);
  g.hline(3, 10, 18, K.red);
  g.hline(3, 12, 18, K.white);
  g.hline(3, 14, 18, K.blue);
  const punch = f % 2;
  // left fighter
  g.rect(7, 9, 2, 2, "#f2c9a0");
  g.rect(7, 11, 2, 3, K.red);
  g.rect(7, 14, 2, 2, K.dark);
  g.px(9 + punch, 12, K.red);
  g.px(10 + punch, 12, K.red);
  // right fighter
  g.rect(14, 9, 2, 2, "#c98f6a");
  g.rect(14, 11, 2, 3, K.yellow);
  g.rect(14, 14, 2, 2, K.dark);
  g.px(13 - (1 - punch), 12, K.yellow);
  g.px(12 - (1 - punch), 12, K.yellow);
  g.px(3, 6, f % 2 ? K.yellow : K.white);
}

function peak(g: Grid, f: number) {
  roof(g, 1, 5, 22, K.rock, K.rockD);
  g.rect(1, 16, 22, 5, K.rock);
  g.rect(15, 16, 8, 5, K.rockD);
  recolor(g, 1, 5, 22, 6, (x, y) => (y <= 8 + (x % 3 === 0 ? 1 : 0) ? (x >= 12 ? K.ice : K.white) : undefined));
  flag(g, 11, 0, K.red, f, 5);
  const climb: [number, number][] = [
    [6, 15],
    [7, 13],
    [8, 12],
    [9, 10],
  ];
  const [cx, cy] = climb[f % 4];
  g.px(cx, cy, K.red);
  g.px(cx, cy - 1, K.yellow);
  g.rect(3, 19, 3, 2, K.rockD);
}

// ---------- food ----------

function tavern(g: Grid, f: number) {
  g.box(16, 3, 3, 8, K.stone, K.stoneD);
  smoke(g, 17, 2, f);
  g.box(4, 14, 16, 8, K.wood, K.woodD);
  roof(g, 3, 5, 18, "#8a4a35", "#6a3625");
  const glow = f % 2 ? K.yellow : K.fire2;
  win(g, 6, 16, true, glow);
  win(g, 16, 16, true, glow);
  g.rect(10, 16, 4, 6, K.woodD);
  g.px(13, 19, K.yellow);
  // hanging mug sign
  g.hline(1, 14, 4, K.woodD);
  g.rect(1, 15, 3, 4, K.woodL);
  g.rect(2, 16, 1, 2, K.yellow);
  g.px(2, 15, K.white);
}

function pizzaCave(g: Grid, f: number) {
  disc(g, 11, 18, 9, "#c25b3a", { y1: 21 });
  recolor(g, 2, 9, 20, 13, (x, y, cur) => {
    if (cur !== "#c25b3a") return undefined;
    if (x >= 16) return "#9a4028";
    if (y % 3 === 0 && (x + y) % 4 !== 0) return "#8a3a25";
    return undefined;
  });
  g.rect(9, 15, 6, 7, K.night);
  g.rect(10, 14, 4, 1, K.night);
  flame(g, 10, 18, f);
  flame(g, 12, 18, f + 1);
  g.box(15, 5, 3, 5, "#8a3a25", "#6a2a1a");
  smoke(g, 16, 4, f);
  // pizza sign
  g.vline(5, 9, 6, K.woodD);
  disc(g, 5, 6, 3, K.gold);
  g.px(4, 5, K.red);
  g.px(6, 7, K.red);
  g.px(5, 6, K.red);
  g.px(4, 7, K.greenD);
}

function potion(g: Grid, f: number) {
  g.box(6, 13, 14, 9, K.purple, K.purpleD);
  roof(g, 5, 5, 16, K.greenD, "#1f6a2e");
  g.rect(6, 12, 14, 1, K.greenD);
  win(g, 8, 15, true, K.pink);
  win(g, 16, 15, true, K.teal);
  g.rect(11, 16, 4, 6, K.woodD);
  // bottle sign
  g.rect(2, 12, 2, 2, K.glass);
  g.rect(1, 14, 4, 5, K.pink);
  g.px(2 + (f % 2), 15, K.white);
  g.px(2, 17, K.white);
  // cauldron
  g.rect(19, 19, 4, 3, K.gray);
  g.hline(19, 18, 4, K.greenL);
  g.px(20 + (f % 3), 17 - (f >> 1), K.greenL);
}

function foodTruck(g: Grid, f: number) {
  smoke(g, 8, 6, f);
  g.box(2, 9, 15, 10, K.orange, K.orangeD);
  g.box(16, 12, 6, 7, K.orange, K.orangeD);
  g.rect(18, 13, 3, 3, K.glass);
  for (let i = 0; i < 14; i++) g.rect(3 + i, 10, 1, 2, i % 2 ? K.white : K.red);
  g.rect(4, 13, 10, 4, K.night);
  g.rect(5, 14, 8, 2, f % 2 ? K.fire3 : K.yellow);
  g.hline(3, 17, 12, K.woodL);
  g.px(6, 15, K.red);
  g.px(9, 15, K.greenD);
  wheel(g, 6, 19, f);
  wheel(g, 18, 19, f);
}

function candy(g: Grid, f: number) {
  g.box(4, 14, 16, 8, "#b8733f", "#8a5228");
  roof(g, 3, 5, 18, K.pink, K.pinkD);
  for (let x = 5; x < 20; x += 3) g.px(x, 13, K.white);
  g.px(7, 10, K.yellow);
  g.px(12, 8, K.teal);
  g.px(15, 11, K.white);
  g.px(10, 12, K.green);
  g.rect(10, 16, 4, 6, K.purpleD);
  win(g, 5, 16);
  win(g, 17, 16);
  for (let y = 16; y < 22; y++) {
    g.px(8, y, y % 2 ? K.white : K.red);
    g.px(15, y, y % 2 ? K.red : K.white);
  }
  // lollipop
  g.vline(21, 13, 8, K.cream);
  disc(g, 21, 11, 2, K.pink);
  recolor(g, 19, 9, 5, 5, (x, y, cur) => (cur === K.pink && (x + y + f) % 2 ? K.white : undefined));
}

// ---------- shopping ----------

function marketStall(g: Grid, f: number) {
  g.vline(4, 9, 13, K.woodD);
  g.vline(19, 9, 13, K.woodD);
  for (let i = 0; i < 18; i++) g.rect(3 + i, 6, 1, 4, Math.floor(i / 3) % 2 ? K.cream : K.red);
  for (let x = 3; x < 21; x += 3) g.px(x + 1, 10, K.red);
  g.box(4, 16, 16, 6, K.wood, K.woodD);
  g.hline(4, 16, 16, K.woodL);
  const fruit = [K.red, K.orange, K.green, K.yellow];
  for (let i = 0; i < 6; i++) g.px(5 + i * 2, 15, fruit[i % 4]);
  // vendor
  g.rect(11, 11, 2, 2, "#f2c9a0");
  g.rect(11, 13, 2, 3, K.blue);
  g.px(13, f % 2 ? 12 : 13, "#f2c9a0");
  g.px(12, 9, f % 2 ? K.yellow : K.orange);
}

function vault(g: Grid, f: number) {
  g.box(3, 11, 18, 11, "#8f8bb0", K.stoneD);
  roof(g, 4, 3, 16, K.stoneL, K.stone);
  g.rect(3, 11, 18, 1, K.stoneL);
  disc(g, 11, 7, 2, K.gold);
  columns(g, [5, 17], 12, 9, K.white, K.grayL);
  disc(g, 11, 17, 4, K.gold);
  disc(g, 11, 17, 2, K.yellowD);
  const spokes: [number, number][][] = [
    [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ],
    [
      [-1, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
    ],
  ];
  for (const [dx, dy] of spokes[f % 2]) g.px(11 + dx, 17 + dy, K.white);
  g.px(11, 17, K.night);
  g.rect(6, 20, 3, 2, K.gold);
  g.px(7, 19, K.gold);
  g.px(6, 19, f % 2 ? K.white : K.gold);
}

function blacksmith(g: Grid, f: number) {
  g.box(13, 3, 3, 8, K.stone, K.stoneD);
  smoke(g, 14, 2, f, K.grayL);
  g.box(3, 12, 13, 10, "#7a5a3f", "#5a4028");
  roof(g, 2, 5, 14, K.dark, K.night);
  g.rect(6, 15, 6, 7, K.night);
  flame(g, 7, 17, f);
  flame(g, 9, 18, f + 1);
  g.hline(6, 21, 6, K.fire1);
  // anvil
  g.rect(17, 19, 5, 2, K.grayD);
  g.rect(18, 18, 3, 1, K.gray);
  g.px(16, 18, K.gray);
  g.rect(19, 21, 1, 1, K.night);
  if (f % 2) {
    g.px(18, 16, K.yellow);
    g.px(20, 15, K.fire3);
  } else {
    g.px(19, 16, K.yellow);
    g.px(21, 17, K.fire3);
  }
}

function bazaar(g: Grid, f: number) {
  roof(g, 2, 4, 20, K.red, K.redD);
  g.rect(3, 14, 18, 8, K.red);
  recolor(g, 2, 4, 20, 18, (x, _y, cur) => (Math.floor(x / 2) % 2 === 0 && (cur === K.red || cur === K.redD) ? K.cream : undefined));
  g.rect(9, 15, 6, 7, K.night);
  g.rect(10, 14, 4, 1, K.night);
  g.vline(12, 0, 4, K.woodD);
  g.rect(13, 0, 3, 2, K.yellow);
  g.px(16, f % 2, K.yellow);
  for (let i = 0; i < 4; i++) {
    g.px(5 + i * 2, 11 - i + (f + i) % 2, [K.yellow, K.blue, K.green, K.pink][i]);
    g.px(18 - i * 2, 11 - i + (f + i) % 2, [K.blue, K.yellow, K.pink, K.green][i]);
  }
  g.rect(7, 21, 10, 1, K.purple);
}

function arcade(g: Grid, f: number) {
  g.box(3, 8, 18, 14, K.dark, K.night);
  g.hline(3, 7, 18, K.pink);
  g.rect(5, 10, 14, 4, K.night);
  const neon = [K.pink, K.teal, K.yellow, K.greenL];
  for (let i = 0; i < 7; i++) g.rect(6 + i * 2, 11, 1, 2, neon[(i + f) % 4]);
  g.rect(10, 16, 4, 6, K.blueD);
  g.px(11, 17, K.glass);
  g.px(11, 18, K.glass);
  g.rect(4, 16, 4, 6, K.red);
  g.rect(5, 17, 2, 2, f % 2 ? K.greenL : K.teal);
  g.rect(16, 16, 4, 6, K.blue);
  g.rect(17, 17, 2, 2, f % 2 ? K.yellow : K.pink);
  star(g, 21, 5, f, 0);
}

// ---------- school ----------

function library(g: Grid, f: number) {
  g.box(3, 13, 18, 9, "#e8dcc0", "#c9bb98");
  roof(g, 3, 4, 18, "#bfb6d6", "#9c93bc");
  g.rect(9, 8, 6, 4, K.red);
  g.vline(11, 8, 4, K.white);
  g.px(11 + (f % 2) * 2, 9, K.white);
  g.hline(3, 13, 18, K.creamD);
  columns(g, [4, 7, 15, 18], 14, 7, K.white, K.grayL);
  g.rect(10, 15, 4, 7, K.woodD);
  g.hline(2, 21, 20, K.stoneL);
}

function academy(g: Grid, f: number) {
  g.box(3, 14, 18, 8, "#b25a4a", "#8a4236");
  g.box(9, 4, 6, 10, "#c96a55", "#a04a3a");
  roof(g, 8, 0, 8, K.dark, K.night);
  disc(g, 11, 8, 2, K.white);
  const tips: [number, number][] = [
    [11, 6],
    [13, 8],
    [11, 10],
    [9, 8],
  ];
  g.px(11, 8, K.night);
  g.px(tips[f % 4][0], tips[f % 4][1], K.night);
  g.px(12, 4, K.yellow);
  win(g, 5, 16);
  win(g, 17, 16);
  win(g, 8, 16);
  win(g, 14, 16);
  g.rect(10, 17, 4, 5, K.woodD);
  g.hline(3, 14, 18, "#8a4236");
}

function observatory(g: Grid, f: number) {
  g.box(5, 13, 14, 9, "#e8dcc0", "#c9bb98");
  disc(g, 11, 13, 7, "#8f8bb0", { y1: 12 });
  recolor(g, 4, 6, 15, 7, (x) => (x >= 15 ? K.stoneD : undefined));
  const slit = [11, 9, 11, 13][f % 4];
  g.rect(slit, 6, 2, 7, K.night);
  g.px(slit + (f < 2 ? 2 : -1), 7, K.grayL);
  g.rect(10, 17, 4, 5, K.woodD);
  win(g, 6, 16);
  win(g, 16, 16);
  star(g, 3, 3, f, 0);
  star(g, 20, 5, f, 2);
  star(g, 21, 1, f, 1);
}

function schoolhouse(g: Grid, f: number) {
  g.box(10, 2, 4, 5, K.cream, K.creamD);
  g.px(11 + (f % 2), 4, K.yellow);
  g.box(4, 15, 14, 7, "#d94a4a", "#a83232");
  roof(g, 3, 7, 16, K.dark, K.night);
  g.rect(10, 17, 4, 5, K.woodD);
  g.vline(12, 17, 5, K.wood);
  win(g, 6, 17);
  win(g, 15, 17);
  g.px(12, 12, K.white);
  flag(g, 20, 3, K.blue, f, 9);
}

function kindergarten(g: Grid, f: number) {
  const glyph = (x: number, y: number, rows: string[], c: string) =>
    rows.forEach((row, j) => [...row].forEach((ch, i) => ch === "X" && g.px(x + i, y + j, c)));
  g.box(3, 14, 8, 8, K.red, K.redD);
  g.box(12, 14, 8, 8, K.blue, K.blueD);
  glyph(5, 16, [".X.", "X.X", "XXX", "X.X", "X.X"], K.white);
  glyph(14, 16, ["XX.", "X.X", "XX.", "X.X", "XX."], K.white);
  const bob = f === 1 || f === 2 ? 1 : 0;
  g.box(7, 6 - bob, 8, 8, K.yellow, K.yellowD);
  glyph(9, 8 - bob, [".XX", "X..", "X..", "X..", ".XX"], K.night);
  star(g, 20, 8, f, 1);
  star(g, 3, 9, f, 3);
}

// ---------- health ----------

function temple(g: Grid, f: number) {
  g.box(4, 13, 16, 9, K.white, "#d8d0b8");
  roof(g, 3, 4, 18, K.white, "#d8d0b8");
  const glow = f % 2 ? "#a8ffbe" : K.greenL;
  g.rect(11, 6, 2, 5, glow);
  g.rect(9, 8, 6, 2, glow);
  columns(g, [5, 8, 15, 18], 14, 7, K.white, K.grayL);
  g.rect(10, 16, 4, 6, glow);
  g.hline(2, 21, 20, K.stoneL);
  star(g, 2, 8, f, 0);
  star(g, 21, 10, f, 2);
}

function hospital(g: Grid, f: number) {
  g.box(3, 8, 18, 14, K.white, "#d0d0e0");
  g.rect(3, 6, 18, 2, K.gray);
  g.px(12, 5, f % 2 ? K.red : K.blue);
  const c = f % 2 ? K.red : K.pink;
  g.rect(11, 10, 2, 6, c);
  g.rect(9, 12, 6, 2, c);
  for (const x of [5, 8, 15, 18]) win(g, x, 17, true, K.glass);
  g.rect(10, 18, 4, 4, K.glassD);
  g.vline(12, 18, 4, K.white);
  win(g, 5, 10, true, K.glass);
  win(g, 17, 10, true, K.glass);
}

function herbHut(g: Grid, f: number) {
  g.box(15, 3, 3, 8, K.stone, K.stoneD);
  smoke(g, 16, 2, f, "#a8ffbe");
  g.box(5, 13, 14, 9, K.wood, K.woodD);
  roof(g, 3, 5, 18, "#d9b04a", "#b8902a");
  recolor(g, 3, 5, 18, 9, (x, y, cur) => ((x + y) % 3 === 0 && (cur === "#d9b04a" || cur === "#b8902a") ? "#f0d078" : undefined));
  g.rect(10, 16, 4, 6, K.woodD);
  win(g, 7, 16, true, "#a8ffbe");
  for (let y = 15; y < 18; y++) g.px(9, y, K.greenD);
  g.px(9, 18, K.green);
  g.px(20, 20, K.green);
  g.px(20, 19, f % 2 ? K.pink : K.yellow);
  g.px(22, 21, K.green);
  g.px(22, 20, f % 2 ? K.yellow : K.pink);
  star(g, 3, 8, f, 0);
}

function pharmacy(g: Grid, f: number) {
  g.box(4, 9, 16, 13, K.green, K.greenD);
  for (let i = 0; i < 16; i++) g.rect(4 + i, 9, 1, 3, i % 4 < 2 ? K.white : K.green);
  g.rect(8, 2, 8, 6, K.white);
  const c = f % 2 ? K.greenD : K.greenL;
  g.rect(11, 3, 2, 4, c);
  g.rect(10, 4, 4, 2, c);
  g.rect(5, 13, 6, 5, K.glass);
  g.px(6, 16, K.red);
  g.px(8, 16, K.yellow);
  g.px(9, 15, K.blue);
  g.rect(13, 13, 5, 9, K.glassD);
  g.vline(15, 13, 9, K.glass);
  g.px(14, 18, K.yellow);
}

function hotSpring(g: Grid, f: number) {
  disc(g, 4, 18, 3, K.rock);
  disc(g, 19, 18, 3, K.rock);
  disc(g, 8, 20, 3, K.rock);
  disc(g, 15, 20, 3, K.rock);
  disc(g, 11, 17, 6, K.rockD, { y0: 14 });
  g.rect(6, 16, 12, 4, "#5ad8ff");
  g.hline(7, 15, 10, "#5ad8ff");
  g.px(8 + (f % 3) * 3, 17, K.white);
  g.px(9 + ((f + 1) % 3) * 3, 18, K.waterL);
  smoke(g, 7, 13, f, "#e8f4ff");
  smoke(g, 13, 12, f + 2, "#e8f4ff");
  g.vline(21, 12, 6, K.woodD);
  g.rect(19, 12, 3, 2, K.woodL);
}

// ---------- fun ----------

function haunted(g: Grid, f: number) {
  g.box(4, 14, 16, 8, "#4a3a6a", "#33284f");
  roof(g, 3, 5, 18, K.night, "#0b0919");
  const flash = f === 2;
  win(g, 6, 16, true, flash ? K.white : K.greenL);
  win(g, 16, 16, f !== 1, K.yellow);
  g.rect(10, 16, 4, 6, K.night);
  g.px(12, 15, K.night);
  const b = [0, 1, 0, -1][f % 4];
  g.rect(18, 5 + b, 3, 4, K.white);
  g.px(18, 9 + b, f % 2 ? K.white : null);
  g.px(20, 9 + b, f % 2 ? null : K.white);
  g.px(18, 6 + b, K.night);
  g.px(20, 6 + b, K.night);
  g.px(3, 3, K.night);
  g.px(4, 4, K.night);
  g.px(2, 4, K.night);
  disc(g, 3, 8, 1, K.yellow);
  if (flash) {
    g.late(() => {
      line(g, 6, 0, 4, 3, K.fire3);
      line(g, 4, 3, 6, 5, K.fire3);
    });
  }
}

function carnival(g: Grid, f: number) {
  line(g, 11, 10, 5, 21, K.grayD);
  line(g, 12, 10, 18, 21, K.grayD);
  line(g, 12, 10, 6, 21, K.gray);
  line(g, 11, 10, 17, 21, K.gray);
  const cars = [K.red, K.yellow, K.blue, K.green, K.pink, K.teal, K.orange, K.purple];
  for (let a = 0; a < 360; a += 15) {
    const rad = (a * Math.PI) / 180;
    g.px(11.5 + Math.cos(rad) * 8, 10 + Math.sin(rad) * 8, K.grayL);
  }
  for (let k = 0; k < 4; k++) {
    const rad = (k * 45 * Math.PI) / 180 + (f * 11.25 * Math.PI) / 180;
    line(g, 11.5 - Math.cos(rad) * 8, 10 - Math.sin(rad) * 8, 11.5 + Math.cos(rad) * 8, 10 + Math.sin(rad) * 8, K.grayL);
  }
  for (let k = 0; k < 8; k++) {
    const rad = (k * 45 * Math.PI) / 180 + (f * 11.25 * Math.PI) / 180;
    const x = Math.round(11.5 + Math.cos(rad) * 8);
    const y = Math.round(10 + Math.sin(rad) * 8);
    g.rect(x - 1, y, 3, 2, cars[k]);
  }
  disc(g, 11, 10, 1, K.yellow);
  g.hline(3, 21, 18, K.woodD);
}

function pirateShip(g: Grid, f: number) {
  flag(g, 11, 0, K.night, f, 4);
  g.vline(11, 4, 12, K.woodD);
  const sway = f % 2;
  g.rect(5, 5, 12, 6, K.white);
  g.hline(5, 11, 12, K.cream);
  g.px(11, 7, K.night);
  g.px(10, 8, K.night);
  g.px(12, 8, K.night);
  g.rect(4, 14 + sway, 1, 1, K.white);
  for (let i = 0; i < 6; i++) g.hline(12, 8 + i, Math.max(1, 8 - i), K.cream);
  g.rect(3, 15, 18, 2, K.wood);
  g.rect(4, 17, 16, 2, K.woodD);
  g.rect(6, 19, 12, 1, K.woodD);
  for (const x of [6, 9, 12, 15]) g.px(x, 16, K.night);
  g.hline(2, 20, 20, K.water);
  g.hline(2, 21, 20, K.blueD);
  for (let x = 2 + (f % 3); x < 22; x += 3) g.px(x, 20, K.waterL);
}

function stadium(g: Grid, f: number) {
  g.box(2, 10, 20, 11, "#8f8bb0", K.stoneD);
  g.rect(5, 14, 14, 5, K.green);
  g.vline(12, 14, 5, K.white);
  g.px(12, 16, K.white);
  for (let x = 2; x < 22; x++) {
    g.px(x, 11, [K.red, K.yellow, K.blue, K.white][(x + f) % 4]);
    g.px(x, 12, [K.blue, K.white, K.red, K.yellow][(x + f) % 4]);
  }
  g.vline(3, 3, 7, K.grayD);
  g.vline(20, 3, 7, K.grayD);
  const lamp = f % 2 ? K.fire3 : K.white;
  g.rect(2, 2, 3, 2, lamp);
  g.rect(19, 2, 3, 2, lamp);
  g.rect(9, 5, 6, 3, K.night);
  g.px(10, 6, f % 2 ? K.greenL : K.green);
  g.px(13, 6, f % 2 ? K.green : K.greenL);
  g.px(8 + ((f * 3) % 8), 17 - (f % 2), K.white);
}

function theater(g: Grid, f: number) {
  g.box(3, 10, 18, 12, "#8a2a45", "#5c1a2e");
  g.hline(3, 9, 18, K.gold);
  g.rect(4, 5, 16, 4, K.night);
  for (let x = 4; x < 20; x += 2) {
    const c = (x / 2 + f) % 2 ? K.yellow : K.white;
    g.px(x, 5, c);
    g.px(x, 8, c);
  }
  g.px(4, 6, K.yellow);
  g.px(19, 6, K.yellow);
  g.px(4, 7, K.white);
  g.px(19, 7, K.white);
  star(g, 12, 7, f, 0);
  disc(g, 6, 14, 1, K.white);
  g.px(6, 15, K.night);
  disc(g, 17, 14, 1, K.white);
  g.px(17, 15, K.night);
  g.rect(9, 15, 6, 7, K.gold);
  g.vline(12, 15, 7, K.yellowD);
  g.rect(3, 20, 4, 2, K.dark);
}

// ---------- travel ----------

function airship(g: Grid, f: number) {
  const b = [0, 1, 1, 0][f % 4];
  g.box(15, 9, 4, 13, "#8f8bb0", K.stoneD);
  g.hline(14, 8, 6, K.dark);
  g.box(2, 16, 9, 6, K.creamD, "#b8a878");
  g.rect(4, 18, 2, 4, K.woodD);
  // blimp
  disc(g, 8, 6 + b, 5, K.red);
  g.rect(3, 5 + b, 11, 3, K.red);
  g.hline(3, 6 + b, 11, K.white);
  g.rect(6, 11 + b, 5, 2, K.dark);
  g.px(2, 3 + b, K.redD);
  g.px(2, 9 + b, K.redD);
  g.px(1, 6 + b, f % 2 ? K.grayL : K.night);
  g.px(1, 5 + b + (f % 2), K.grayL);
  g.hline(13, 7 + b, 3, K.woodL);
  flag(g, 20, 2, K.orange, f, 6);
}

function trainStation(g: Grid, f: number) {
  g.box(4, 8, 16, 7, "#c96a55", "#a04a3a");
  g.hline(3, 7, 18, K.dark);
  g.box(10, 2, 4, 6, "#c96a55", "#a04a3a");
  disc(g, 11, 4, 1, K.white);
  g.px(11, 4, K.night);
  g.px(11 + (f % 2), 3 + ((f >> 1) & 1), K.night);
  win(g, 5, 10);
  win(g, 8, 10);
  win(g, 14, 10);
  win(g, 17, 10);
  smoke(g, 4, 12, f);
  g.box(3, 15, 9, 5, K.dark, K.night);
  g.rect(4, 13, 2, 2, K.dark);
  g.rect(7, 16, 3, 2, K.fire2);
  g.box(12, 15, 9, 5, K.red, K.redD);
  win(g, 14, 16, true, K.fire3);
  win(g, 18, 16, true, K.fire3);
  g.hline(2, 21, 20, K.gray);
  for (const x of [4, 6, 9, 14, 17, 19]) g.px(x, 20, K.night);
}

function pitStop(g: Grid, f: number) {
  g.rect(9, 2, 6, 4, K.night);
  const digits = ["1.79", "1.80", "1.81", "1.79"][f % 4];
  digits.split("").forEach((ch, i) => {
    if (ch !== ".") g.px(9 + i * 2 - (i > 1 ? 1 : 0) + 1, 4, K.fire3);
  });
  g.px(11, 3, K.red);
  g.rect(2, 7, 20, 3, K.red);
  g.hline(2, 8, 20, K.white);
  g.vline(4, 10, 12, K.grayL);
  g.vline(19, 10, 12, K.grayL);
  for (const x of [8, 13]) {
    g.box(x, 14, 3, 8, K.red, K.redD);
    g.rect(x + 1, 15, 1, 2, K.glass);
    g.px(x + 3, 17, K.night);
    g.px(x + 3, 18, K.night);
  }
  g.hline(2, 21, 20, K.stone);
  disc(g, 21, 19, 1, K.night);
  g.px(21, 17, K.gold);
  g.px(3, 6, f % 2 ? K.yellow : K.white);
}

function lighthouse(g: Grid, f: number) {
  disc(g, 11, 20, 7, K.rock, { y0: 18, y1: 21 });
  roof(g, 10, 1, 4, K.red, K.redD);
  g.rect(10, 3, 4, 3, K.yellow);
  g.hline(9, 6, 6, K.dark);
  for (let y = 7; y < 22; y++) {
    const half = y < 11 ? 2 : y < 16 ? 3 : 4;
    const band = Math.floor((y - 7) / 3) % 2 ? K.white : K.red;
    g.rect(12 - half, y, half * 2, 1, band);
    g.px(12 + half - 1, y, band === K.white ? K.grayL : K.redD);
  }
  g.rect(11, 18, 2, 3, K.woodD);
  g.hline(2, 21, 20, K.water);
  for (let x = 2 + (f % 3); x < 22; x += 3) g.px(x, 21, K.waterL);
  const beam: [number, number][] = [
    [22, 4],
    [20, 8],
    [1, 4],
    [3, 8],
  ];
  const [tx, ty] = beam[f % 4];
  g.late(() => {
    line(g, 12, 4, tx, ty, "#fff6a8bb");
    line(g, 12, 5, tx, ty + 1, "#fff6a8bb");
  });
}

function motel(g: Grid, f: number) {
  g.box(2, 12, 20, 10, K.pink, K.pinkD);
  g.hline(2, 11, 20, K.purple);
  for (const x of [8, 12, 16]) {
    g.rect(x, 16, 3, 6, K.woodD);
    g.px(x + 1, 15, K.yellow);
  }
  win(g, 4, 14, true, K.fire3);
  win(g, 19, 14, f % 2 === 0, K.fire3);
  g.rect(1, 1, 9, 5, K.night);
  const neon = [K.pink, K.teal, K.yellow];
  for (let i = 0; i < 4; i++) g.rect(2 + i * 2, 2, 1, 2, neon[(i + f) % 3]);
  g.hline(2, 4, 7, f % 2 ? K.red : K.redD);
  g.vline(4, 6, 6, K.grayD);
  g.hline(1, 21, 22, K.stone);
}

// ---------- family & friends ----------

function fort(g: Grid, f: number) {
  g.box(3, 10, 18, 12, K.wood, K.woodD);
  for (let x = 3; x < 21; x += 2) {
    g.vline(x, 10, 12, K.woodD);
    g.px(x, 9, K.wood);
  }
  g.box(3, 5, 5, 8, K.woodL, K.wood);
  roof(g, 2, 1, 7, K.wood, K.woodD);
  g.px(5 + (f >> 1), 4, "#f2c9a0");
  flag(g, 5, -2, K.red, f, 4);
  g.rect(9, 15, 6, 7, "#5a3a1f");
  g.vline(12, 15, 7, K.woodD);
  g.hline(9, 18, 6, K.woodD);
  g.rect(17, 13, 2, 2, K.night);
}

function cabin(g: Grid, f: number) {
  g.box(16, 4, 3, 8, K.stone, K.stoneD);
  smoke(g, 17, 3, f);
  g.box(4, 15, 16, 7, K.wood, K.woodD);
  for (const y of [16, 18, 20]) g.hline(4, y, 16, K.woodD);
  roof(g, 3, 6, 18, "#7a4a2a", "#5a3a1f");
  recolor(g, 3, 6, 18, 2, () => K.white);
  g.rect(10, 16, 4, 6, K.woodD);
  win(g, 5, 17, true, f % 2 ? K.yellow : K.fire2);
  win(g, 16, 17, true, f % 2 ? K.fire2 : K.yellow);
  g.rect(21, 19, 2, 3, K.woodL);
  g.px(21, 18, K.grayL);
  g.px(20, 18, K.grayL);
}

function farm(g: Grid, f: number) {
  g.box(2, 11, 12, 11, K.red, K.redD);
  roof(g, 1, 5, 14, "#7a4a2a", "#5a3a1f");
  g.rect(5, 15, 6, 7, K.cream);
  line(g, 5, 15, 10, 21, K.red);
  line(g, 10, 15, 5, 21, K.red);
  g.rect(6, 8, 4, 2, K.night);
  g.box(15, 8, 3, 14, K.grayL, K.gray);
  disc(g, 16, 8, 1, K.gray);
  g.box(19, 12, 3, 10, K.cream, K.creamD);
  g.px(20, 11, K.woodD);
  if (f % 2) {
    line(g, 18, 9, 22, 13, K.woodL);
    line(g, 22, 9, 18, 13, K.woodL);
  } else {
    g.hline(18, 11, 5, K.woodL);
    g.vline(20, 9, 5, K.woodL);
  }
}

function camp(g: Grid, f: number) {
  for (let i = 0; i < 16; i++) {
    const half = Math.floor(1 + i * 0.6);
    g.hline(8 - half, 6 + i, half * 2, K.blue);
    g.px(8 + half - 1, 6 + i, K.blueD);
  }
  g.rect(7, 16, 3, 6, K.night);
  g.vline(8, 6, 1, K.yellow);
  g.hline(15, 21, 6, K.woodD);
  g.hline(16, 20, 4, K.wood);
  const b = f % 2;
  g.rect(17, 18, 2, 2, K.fire1);
  g.rect(17 + b, 16, 2, 2, K.fire2);
  g.px(18 - b, 15, K.fire3);
  g.px(18 + b * 2, 13 - (f >> 1), K.fire3);
  star(g, 19, 5, f, 0);
  star(g, 4, 3, f, 2);
  disc(g, 14, 4, 1, K.yellow);
}

function partyHouse(g: Grid, f: number) {
  g.box(4, 13, 16, 9, K.pink, K.pinkD);
  roof(g, 3, 4, 18, K.teal, K.tealD);
  const flash = [K.yellow, K.teal, K.pink, K.blue];
  win(g, 6, 16, true, flash[f % 4]);
  win(g, 16, 16, true, flash[(f + 2) % 4]);
  g.rect(10, 16, 4, 6, K.purple);
  g.px(13, 19, K.yellow);
  for (let x = 4; x < 20; x++) g.px(x, 13, [K.red, K.yellow, K.blue, K.green][x % 4]);
  const bob = f % 2;
  for (const [x, c] of [
    [5, K.red],
    [9, K.yellow],
    [19, K.blue],
  ] as [number, string][]) {
    disc(g, x, 2 + bob, 1, c);
    g.vline(x, 4 + bob, 3, K.grayL);
  }
  g.px(3 + f, 8 + f, K.yellow);
  g.px(20 - f, 9 + f * 2, K.pink);
}

export const BUILDINGS: Building[] = [
  { id: "castle", name: "Castle", shelf: "homes", draw: castle },
  { id: "cottage", name: "Cottage", shelf: "homes", draw: cottage },
  { id: "treehouse", name: "Treehouse", shelf: "homes", draw: treehouse },
  { id: "igloo", name: "Igloo", shelf: "homes", draw: igloo },
  { id: "wizard", name: "Wizard Tower", shelf: "homes", draw: wizard },

  { id: "prison", name: "Prison", shelf: "work", draw: prison },
  { id: "factory", name: "Factory", shelf: "work", draw: factory },
  { id: "office", name: "Office Tower", shelf: "work", draw: office },
  { id: "mine", name: "Mine", shelf: "work", draw: mine },
  { id: "lab", name: "Lab", shelf: "work", draw: lab },

  { id: "dungeon", name: "Dungeon", shelf: "fitness", draw: dungeon },
  { id: "arena", name: "Arena", shelf: "fitness", draw: arena },
  { id: "dojo", name: "Dojo", shelf: "fitness", draw: dojo },
  { id: "boxing", name: "Boxing Ring", shelf: "fitness", draw: boxing },
  { id: "peak", name: "Climbing Peak", shelf: "fitness", draw: peak },

  { id: "tavern", name: "Tavern", shelf: "food", draw: tavern },
  { id: "pizza", name: "Pizza Cave", shelf: "food", draw: pizzaCave },
  { id: "potion", name: "Potion Bar", shelf: "food", draw: potion },
  { id: "foodtruck", name: "Food Truck", shelf: "food", draw: foodTruck },
  { id: "candy", name: "Candy House", shelf: "food", draw: candy },

  { id: "stall", name: "Market Stall", shelf: "shopping", draw: marketStall },
  { id: "vault", name: "Treasure Vault", shelf: "shopping", draw: vault },
  { id: "smith", name: "Blacksmith", shelf: "shopping", draw: blacksmith },
  { id: "bazaar", name: "Bazaar", shelf: "shopping", draw: bazaar },
  { id: "arcade", name: "Arcade", shelf: "shopping", draw: arcade },

  { id: "library", name: "Library", shelf: "school", draw: library },
  { id: "academy", name: "Academy", shelf: "school", draw: academy },
  { id: "observatory", name: "Observatory", shelf: "school", draw: observatory },
  { id: "schoolhouse", name: "Schoolhouse", shelf: "school", draw: schoolhouse },
  { id: "kinder", name: "Kindergarten", shelf: "school", draw: kindergarten },

  { id: "temple", name: "Healing Temple", shelf: "health", draw: temple },
  { id: "hospital", name: "Hospital", shelf: "health", draw: hospital },
  { id: "herbs", name: "Herb Hut", shelf: "health", draw: herbHut },
  { id: "pharmacy", name: "Pharmacy", shelf: "health", draw: pharmacy },
  { id: "spring", name: "Hot Spring", shelf: "health", draw: hotSpring },

  { id: "haunted", name: "Haunted House", shelf: "fun", draw: haunted },
  { id: "carnival", name: "Ferris Wheel", shelf: "fun", draw: carnival },
  { id: "pirate", name: "Pirate Ship", shelf: "fun", draw: pirateShip },
  { id: "stadium", name: "Stadium", shelf: "fun", draw: stadium },
  { id: "theater", name: "Theater", shelf: "fun", draw: theater },

  { id: "airship", name: "Airship Dock", shelf: "travel", draw: airship },
  { id: "station", name: "Train Station", shelf: "travel", draw: trainStation },
  { id: "pitstop", name: "Pit Stop", shelf: "travel", draw: pitStop },
  { id: "lighthouse", name: "Lighthouse", shelf: "travel", draw: lighthouse },
  { id: "motel", name: "Motel", shelf: "travel", draw: motel },

  { id: "fort", name: "Fort", shelf: "family", draw: fort },
  { id: "cabin", name: "Log Cabin", shelf: "family", draw: cabin },
  { id: "farm", name: "Farm", shelf: "family", draw: farm },
  { id: "camp", name: "Campsite", shelf: "family", draw: camp },
  { id: "party", name: "Party House", shelf: "family", draw: partyHouse },
];

const byId = new Map(BUILDINGS.map((b) => [b.id, b]));

export function getBuilding(id: string): Building {
  return byId.get(id) ?? byId.get("cottage")!;
}

export function hasBuilding(id: string): boolean {
  return byId.has(id);
}

export function buildingsOnShelf(shelf: ShelfId): Building[] {
  return BUILDINGS.filter((b) => b.shelf === shelf);
}

const urls = new Map<string, string>();

export function buildingFrameUrl(id: string, frame: number): string {
  const b = getBuilding(id);
  const f = ((frame % 4) + 4) % 4;
  const key = `b:${b.id}:${f}`;
  const hit = urls.get(key);
  if (hit) return hit;
  const g = new Grid(24, 24);
  b.draw(g, f);
  g.finish();
  const url = gridToDataUrl(g, key);
  urls.set(key, url);
  return url;
}

// A best guess at a fun building from a real place's name, so saving is one tap.
const HINTS: [RegExp, string][] = [
  [/\b(gym|fitness|crossfit|yoga|planet fitness|goodlife|anytime|barbell|weights?)\b/i, "dungeon"],
  [/\b(jail|prison|penitentiary|correctional)\b/i, "prison"],
  [/\b(hospital|emergency|urgent care|clinic|medical)\b/i, "hospital"],
  [/\b(pharmacy|drug ?store|shoppers|walgreens|cvs)\b/i, "pharmacy"],
  [/\b(spa|hot spring|sauna)\b/i, "spring"],
  [/\b(library)\b/i, "library"],
  [/\b(university|college|academy|institute)\b/i, "academy"],
  [/\b(elementary|school|junior high|high school)\b/i, "schoolhouse"],
  [/\b(daycare|day care|kindergarten|preschool)\b/i, "kinder"],
  [/\b(pizza)\b/i, "pizza"],
  [/\b(pub|bar|tavern|restaurant|grill|diner|cafe|coffee|bistro|kitchen|brew)/i, "tavern"],
  [/\b(candy|bakery|ice cream|dessert|donut)/i, "candy"],
  [/\b(gas|petro|fuel|esso|shell|husky|fas gas|co-?op gas|chevron)\b/i, "pitstop"],
  [/\b(airport|airfield|heliport)\b/i, "airship"],
  [/\b(station|transit|train|lrt|terminal)\b/i, "station"],
  [/\b(hotel|motel|inn|suites|resort)\b/i, "motel"],
  [/\b(mall|market|store|shop|centre|center|walmart|costco|superstore)\b/i, "stall"],
  [/\b(bank|credit union|atm)\b/i, "vault"],
  [/\b(arcade|casino|game)/i, "arcade"],
  [/\b(theat(er|re)|cinema|movie)\b/i, "theater"],
  [/\b(stadium|arena|rink|field|coliseum)\b/i, "stadium"],
  [/\b(park|playground|zoo|fair|carnival|amusement)\b/i, "carnival"],
  [/\b(camp|campground|trail)\b/i, "camp"],
  [/\b(farm|ranch|barn)\b/i, "farm"],
  [/\b(factory|plant|warehouse|industrial|mill)\b/i, "factory"],
  [/\b(office|tower|work|corp|inc|ltd|building)\b/i, "office"],
  [/\b(mom|dad|grandma|grandpa|nana|family|aunt|uncle|cousin)\b/i, "fort"],
  [/\b(home|house|apartment|condo|residence)\b/i, "castle"],
  [/\b(church|temple|chapel|cathedral|mosque|shrine)\b/i, "temple"],
  [/\b(observatory|planetarium|science)\b/i, "observatory"],
  [/\b(dojo|martial|karate|judo|taekwondo|jiu)/i, "dojo"],
  [/\b(boxing|mma|fight)/i, "boxing"],
];

export function suggestBuilding(name: string): string {
  for (const [pattern, id] of HINTS) if (pattern.test(name)) return id;
  return "cottage";
}
