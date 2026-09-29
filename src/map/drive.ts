import * as maplibregl from "maplibre-gl";
import type { Map as MLMap, Marker } from "maplibre-gl";
import { onFrame } from "../pixel/anim";
import { carFrameUrl, CAR_H, CAR_W } from "../pixel/cars";
import type { LngLat } from "../lib/geo";

const EARTH = 6371000;

function meters(a: LngLat, b: LngLat) {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLng = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type DriveEvents = {
  onProgress: (fraction: number, metersLeft: number) => void;
  onArrive: () => void;
};

// Drives a pixel car along the route and keeps the camera on it. The trip is sped up so even a
// long drive takes under a minute. The car faces the way it's heading and tilts up or down hills.
export class Driver {
  private map: MLMap;
  private events: DriveEvents;
  private marker: Marker | null = null;
  private inner: HTMLDivElement | null = null;
  private img: HTMLImageElement | null = null;
  private raf = 0;
  private stopClock: (() => void) | null = null;
  private line: LngLat[] = [];
  private cum: number[] = [];
  private total = 0;
  private carId = "muscle";
  private facing = 1;
  private follow = true;
  private startTimer: number | undefined;
  private lastReport = 0;
  private scale = 3;

  constructor(map: MLMap, events: DriveEvents) {
    this.map = map;
    this.events = events;
  }

  private onUserDrag = () => {
    this.follow = false;
  };

  start(line: LngLat[], carId: string) {
    this.stop();
    if (line.length < 2) return;
    this.line = line;
    this.carId = carId;
    this.cum = [0];
    for (let i = 1; i < line.length; i++) this.cum.push(this.cum[i - 1] + meters(line[i - 1], line[i]));
    this.total = this.cum[this.cum.length - 1] || 1;
    this.follow = true;
    this.facing = line[line.length - 1][0] >= line[0][0] ? 1 : -1;
    this.scale = window.innerWidth < 760 || window.innerHeight < 520 ? 2 : 3;

    const wrap = document.createElement("div");
    wrap.className = "car-marker";
    const inner = document.createElement("div");
    inner.className = "car-inner";
    const img = document.createElement("img");
    img.className = "sprite";
    img.alt = "";
    img.draggable = false;
    img.width = CAR_W * this.scale;
    img.height = CAR_H * this.scale;
    img.src = carFrameUrl(carId, 0);
    inner.append(img);
    wrap.append(inner);
    this.inner = inner;
    this.img = img;
    this.marker = new maplibregl.Marker({ element: wrap, anchor: "center" }).setLngLat(line[0]).addTo(this.map);
    this.stopClock = onFrame((f) => {
      if (this.img) this.img.src = carFrameUrl(this.carId, f);
    }, 2);
    this.setHeading(line[0], line[Math.min(line.length - 1, 3)]);

    this.map.on("dragstart", this.onUserDrag);
    this.map.flyTo({ center: line[0], zoom: 15.5, duration: 900 });
    this.startTimer = window.setTimeout(() => this.run(), 950);
  }

  private run() {
    const duration = Math.min(45000, Math.max(8000, (this.total / 450) * 1000));
    const t0 = performance.now();
    let seg = 1;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const d = p * this.total;
      while (seg < this.cum.length - 1 && this.cum[seg] < d) seg++;
      const pos = this.at(d, seg);
      const ahead = this.at(Math.min(this.total, d + 25), seg);
      this.marker?.setLngLat(pos);
      if (ahead[0] !== pos[0] || ahead[1] !== pos[1]) this.setHeading(pos, ahead);
      if (this.follow) this.map.jumpTo({ center: pos });
      if (now - this.lastReport > 150 || p === 1) {
        this.lastReport = now;
        this.events.onProgress(p, this.total - d);
      }
      if (p < 1) this.raf = requestAnimationFrame(tick);
      else this.events.onArrive();
    };
    this.raf = requestAnimationFrame(tick);
  }

  private at(d: number, seg: number): LngLat {
    let i = Math.max(1, seg);
    while (i < this.cum.length - 1 && this.cum[i] < d) i++;
    while (i > 1 && this.cum[i - 1] > d) i--;
    const span = this.cum[i] - this.cum[i - 1] || 1;
    const t = Math.min(1, Math.max(0, (d - this.cum[i - 1]) / span));
    const a = this.line[i - 1];
    const b = this.line[i];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }

  private setHeading(from: LngLat, to: LngLat) {
    if (!this.inner) return;
    const dx = (to[0] - from[0]) * Math.cos((from[1] * Math.PI) / 180);
    const dy = -(to[1] - from[1]);
    if (Math.abs(dx) > Math.abs(dy) * 0.15) this.facing = dx >= 0 ? 1 : -1;
    const angle = (Math.atan2(dy, Math.abs(dx)) * 180) / Math.PI;
    // Tilt in hard 15 degree steps, like a sprite sheet, never more than about 35 degrees.
    const tilt = Math.round((angle * 0.4) / 15) * 15;
    this.inner.style.transform =
      this.facing === 1 ? `rotate(${tilt}deg)` : `rotate(${-tilt}deg) scaleX(-1)`;
  }

  setCar(id: string) {
    this.carId = id;
  }

  get active() {
    return this.marker !== null;
  }

  stop() {
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.startTimer);
    this.stopClock?.();
    this.stopClock = null;
    this.map.off("dragstart", this.onUserDrag);
    this.marker?.remove();
    this.marker = null;
    this.inner = null;
    this.img = null;
  }
}
