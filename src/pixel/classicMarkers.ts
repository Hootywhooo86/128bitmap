// Plain map markers for the classic look: a teardrop pin and a round dot, as small SVGs.

const svg = (body: string, w: number, h: number) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`,
  )}`;

export const pinUrl = (fill: string) =>
  svg(
    `<path d="M14 1C6.8 1 1 6.7 1 13.8 1 23.6 14 39 14 39s13-15.4 13-25.2C27 6.7 21.2 1 14 1z" fill="${fill}" stroke="#fff" stroke-width="2"/><circle cx="14" cy="14" r="5" fill="#fff"/>`,
    28,
    40,
  );

export const dotUrl = (fill: string) =>
  svg(`<circle cx="11" cy="11" r="8" fill="${fill}" stroke="#fff" stroke-width="3"/>`, 22, 22);

export const PIN_SIZE = { w: 28, h: 40 };
export const DOT_SIZE = { w: 22, h: 22 };

export const CLASSIC_COLORS = {
  saved: "#1a73e8",
  from: "#188038",
  to: "#d93025",
  drop: "#5f6368",
};
