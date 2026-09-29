import { Grid, disc, gridToDataUrl } from "./draw";

// 10 pixel cars on 24x14 grids, all facing right. Wheels turn and bodies bounce with the frame number.

const C = {
  night: "#15122b",
  gray: "#7a7a90",
  grayL: "#a8a8be",
  grayD: "#56566e",
  white: "#fff6df",
  glass: "#8fd8ff",
  glassD: "#2b3a70",
  red: "#e0475b",
  redD: "#a02a45",
  yellow: "#ffd23f",
  yellowD: "#c9a020",
  blue: "#4a86e8",
  blueD: "#2f57b0",
  green: "#4fbf5a",
  greenD: "#2f8a3e",
  orange: "#ff8c3a",
  orangeD: "#c96a25",
  teal: "#3ddcc8",
  tealD: "#2aa896",
  pink: "#ff5ea8",
  pinkD: "#c93a80",
  purple: "#8a5ad8",
  purpleD: "#5a3aa0",
  fire: "#ffb03a",
  fire3: "#ffe27a",
};

export type Car = {
  id: string;
  name: string;
  draw: (g: Grid, f: number) => void;
};

function wheel(g: Grid, cx: number, cy: number, f: number, r = 2) {
  disc(g, cx, cy, r, C.night);
  g.px(cx, cy, C.grayL);
  if (r >= 3) g.px(cx, cy, C.gray);
  const spokes: [number, number][] = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  const [sx, sy] = spokes[f % 4];
  g.px(cx + sx, cy + sy, C.grayL);
}

function headlights(g: Grid, x: number, y: number, c = C.fire3) {
  g.px(x, y, c);
}

function muscle(g: Grid, f: number) {
  const b = f % 2;
  g.rect(2, 7 + b, 20, 3, C.red);
  g.rect(16, 7 + b, 6, 3, C.redD);
  g.rect(6, 4 + b, 10, 3, C.red);
  g.rect(8, 3 + b, 6, 1, C.red);
  g.rect(8, 4 + b, 3, 3, C.glassD);
  g.rect(12, 4 + b, 3, 3, C.glassD);
  g.px(9, 4 + b, C.glass);
  g.hline(2, 8 + b, 20, C.white);
  headlights(g, 21, 8 + b);
  g.px(2, 8 + b, C.redD);
  g.hline(1, 10 + b, 1, C.grayL);
  wheel(g, 6, 10, f);
  wheel(g, 17, 10, f);
}

function taxi(g: Grid, f: number) {
  const b = f % 2;
  g.rect(3, 7 + b, 19, 3, C.yellow);
  g.rect(6, 4 + b, 11, 3, C.yellow);
  g.rect(9, 2 + b, 5, 2, C.white);
  g.px(11, 2 + b, C.night);
  g.rect(7, 4 + b, 4, 3, C.glassD);
  g.rect(12, 4 + b, 4, 3, C.glassD);
  for (let x = 3; x < 22; x += 2) g.px(x, 8 + b, x % 4 === 3 ? C.night : C.white);
  g.rect(19, 7 + b, 3, 3, C.yellowD);
  headlights(g, 21, 8 + b);
  g.px(3, 8 + b, C.red);
  wheel(g, 7, 10, f);
  wheel(g, 17, 10, f);
}

function van(g: Grid, f: number) {
  const b = f % 2;
  g.rect(2, 3 + b, 20, 7, C.white);
  g.rect(2, 8 + b, 20, 2, C.blue);
  g.hline(2, 7 + b, 20, C.blueD);
  g.rect(15, 4 + b, 6, 3, C.glassD);
  g.px(16, 4 + b, C.glass);
  g.rect(19, 7 + b, 3, 3, C.blueD);
  g.rect(4, 4 + b, 8, 3, C.blue);
  g.px(5, 5 + b, C.white);
  g.px(6, 5 + b, C.white);
  headlights(g, 21, 8 + b);
  wheel(g, 6, 10, f);
  wheel(g, 17, 10, f);
}

function monster(g: Grid, f: number) {
  const b = f % 2;
  g.rect(4, 5 + b, 17, 3, C.green);
  g.rect(8, 2 + b, 8, 3, C.green);
  g.rect(9, 3 + b, 6, 2, C.glassD);
  g.px(10, 3 + b, C.glass);
  g.hline(4, 6 + b, 17, C.greenD);
  g.rect(18, 5 + b, 3, 3, C.greenD);
  headlights(g, 20, 6 + b);
  g.px(2, 8 + b, C.grayL);
  g.px(2, 5 + b, C.orange);
  wheel(g, 6, 10, f, 3);
  wheel(g, 18, 10, f, 3);
  g.hline(3, 8, 1, C.gray);
}

function kart(g: Grid, f: number) {
  const b = f % 2;
  g.rect(4, 8 + b, 15, 2, C.orange);
  g.rect(16, 7 + b, 5, 3, C.orangeD);
  g.rect(9, 6 + b, 4, 3, C.blue);
  disc(g, 10, 4 + b, 1, C.red);
  g.px(11, 4 + b, C.glass);
  g.rect(2, 8 + b, 3, 1, C.gray);
  g.px(1 - (f % 2), 9, C.grayL);
  g.px(0, 8, f % 2 ? C.grayL : C.gray);
  headlights(g, 20, 8 + b);
  wheel(g, 6, 10, f, 1);
  wheel(g, 17, 10, f, 1);
  g.rect(5, 9, 3, 3, C.night);
  g.rect(16, 9, 3, 3, C.night);
  g.px(6, 10, C.grayL);
  g.px(17, 10, C.grayL);
}

function delivery(g: Grid, f: number) {
  const b = f % 2;
  g.rect(2, 2 + b, 14, 8, C.white);
  g.rect(2, 8 + b, 14, 2, C.grayL);
  g.rect(5, 4 + b, 8, 2, C.red);
  g.rect(16, 5 + b, 6, 5, C.red);
  g.rect(18, 5 + b, 3, 3, C.glassD);
  g.px(19, 5 + b, C.glass);
  g.rect(16, 9 + b, 6, 1, C.redD);
  headlights(g, 21, 8 + b);
  wheel(g, 6, 10, f);
  wheel(g, 12, 10, f);
  wheel(g, 19, 10, f);
}

function hover(g: Grid, f: number) {
  const b = [0, 1, 1, 0][f % 4];
  g.rect(3, 6 + b, 19, 3, C.teal);
  g.rect(16, 6 + b, 6, 3, C.tealD);
  g.rect(7, 3 + b, 9, 3, C.teal);
  g.rect(9, 3 + b, 6, 3, C.glassD);
  g.px(10, 3 + b, C.glass);
  g.hline(3, 8 + b, 19, C.purple);
  headlights(g, 21, 7 + b, C.white);
  g.rect(2, 5 + b, 2, 1, C.purpleD);
  g.rect(2, 4 + b, 1, 1, C.purple);
  g.late(() => {
    const glow = f % 2 ? "#ff5ea8cc" : "#3ddcc8cc";
    g.hline(5, 10 + b, 15, glow);
    g.hline(7, 11 + b, 11, glow);
    g.hline(9, 12 + b, 7, "#fff6df66");
  });
}

function bus(g: Grid, f: number) {
  const b = f % 2;
  g.rect(1, 2 + b, 22, 8, C.yellow);
  g.rect(1, 8 + b, 22, 2, C.yellowD);
  for (let x = 3; x < 20; x += 4) g.rect(x, 4 + b, 3, 3, C.glassD);
  g.rect(20, 4 + b, 3, 4, C.glass);
  g.hline(1, 3 + b, 22, C.orange);
  headlights(g, 22, 8 + b);
  g.px(1, 8 + b, C.red);
  wheel(g, 6, 10, f);
  wheel(g, 17, 10, f);
}

function sports(g: Grid, f: number) {
  const b = f % 2;
  g.rect(2, 8 + b, 20, 2, C.pink);
  g.rect(17, 8 + b, 5, 2, C.pinkD);
  g.rect(7, 5 + b, 9, 3, C.pink);
  g.rect(9, 4 + b, 5, 1, C.pink);
  g.rect(9, 5 + b, 6, 3, C.glassD);
  g.px(10, 5 + b, C.glass);
  g.rect(1, 6 + b, 4, 1, C.night);
  g.vline(2, 7 + b, 2, C.night);
  g.hline(3, 9 + b, 18, C.night);
  headlights(g, 21, 8 + b);
  g.px(4, 8 + b, C.white);
  wheel(g, 6, 10, f);
  wheel(g, 17, 10, f);
}

function pickup(g: Grid, f: number) {
  const b = f % 2;
  g.rect(2, 6 + b, 10, 4, C.blueD);
  g.hline(2, 5 + b, 10, C.blueD);
  g.rect(3, 7 + b, 8, 3, C.blue);
  g.rect(12, 5 + b, 9, 5, C.green);
  g.rect(13, 3 + b, 5, 2, C.green);
  g.rect(14, 3 + b, 3, 3, C.glassD);
  g.px(15, 3 + b, C.glass);
  g.rect(18, 7 + b, 3, 3, C.greenD);
  g.hline(12, 9 + b, 9, C.greenD);
  headlights(g, 21, 8 + b);
  g.px(5, 5 + b, C.orange);
  g.px(8, 5 + b, C.red);
  wheel(g, 6, 10, f);
  wheel(g, 17, 10, f);
}

export const CARS: Car[] = [
  { id: "muscle", name: "Muscle", draw: muscle },
  { id: "taxi", name: "Taxi", draw: taxi },
  { id: "van", name: "Van", draw: van },
  { id: "monster", name: "Monster", draw: monster },
  { id: "kart", name: "Go-Kart", draw: kart },
  { id: "delivery", name: "Delivery", draw: delivery },
  { id: "hover", name: "Hover", draw: hover },
  { id: "bus", name: "Bus", draw: bus },
  { id: "sports", name: "Sports", draw: sports },
  { id: "pickup", name: "Pickup", draw: pickup },
];

const byId = new Map(CARS.map((c) => [c.id, c]));

export function getCar(id: string): Car {
  return byId.get(id) ?? CARS[0];
}

export function hasCar(id: string): boolean {
  return byId.has(id);
}

const urls = new Map<string, string>();

export function carFrameUrl(id: string, frame: number): string {
  const car = getCar(id);
  const f = ((frame % 4) + 4) % 4;
  const key = `c:${car.id}:${f}`;
  const hit = urls.get(key);
  if (hit) return hit;
  const g = new Grid(24, 14);
  car.draw(g, f);
  g.finish();
  const url = gridToDataUrl(g, key);
  urls.set(key, url);
  return url;
}

export const CAR_W = 24;
export const CAR_H = 14;
