// One shared clock for every animated sprite, so 50 idle buildings cost almost nothing.
// Frames step in hard beats (no easing) on purpose, like an old game's sprite sheet.

type Listener = (frame: number) => void;

const TICK_MS = 100;
let tick = 0;
let timer: number | undefined;
const listeners = new Map<Listener, { every: number; last: number }>();

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function start() {
  if (timer !== undefined || reducedMotion()) return;
  timer = window.setInterval(() => {
    tick++;
    for (const [fn, state] of listeners) {
      const n = Math.floor(tick / state.every);
      if (n !== state.last) {
        state.last = n;
        fn(n % 4);
      }
    }
  }, TICK_MS);
}

function stop() {
  if (timer !== undefined) window.clearInterval(timer);
  timer = undefined;
}

// `every` is how many 100 ms ticks each frame lasts (3 = about 3 frames a second).
export function onFrame(fn: Listener, every = 3): () => void {
  listeners.set(fn, { every, last: Math.floor(tick / every) });
  start();
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) stop();
  };
}
