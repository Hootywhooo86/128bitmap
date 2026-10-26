import * as maplibregl from "maplibre-gl";
import type { Map as MLMap, Marker } from "maplibre-gl";
import { usesMiles, type LngLat, type Mode, type Route } from "../lib/geo";
import { keepScreenAwake, speak, stopSpeaking, watchPosition, type Fix } from "../lib/platform";
import { carRearUrl } from "../pixel/cars";
import { angleDiff, cumulative, easeAngle, pointAt, routeBearing, snapToRoute } from "./geometry";

export type NavState = {
  phase: "waiting" | "active" | "arrived";
  pos: LngLat | null;
  heading: number | null;
  nextText: string;
  nextIcon: string;
  nextDist: number;
  thenText: string | null;
  remainingMeters: number;
  remainingSeconds: number;
  etaAt: number;
  offRoute: boolean;
  rerouting: boolean;
  following: boolean;
  // Metres per second, smoothed.
  speed: number;
  // Tilted 3D chase view, or flat map.
  tilt: boolean;
  // A simulated drive along the route instead of real GPS.
  demo: boolean;
  error: string | null;
};

export type NavEvents = {
  onState: (state: NavState) => void;
  onReroute: (route: Route) => void;
  getRoute: (from: LngLat, to: LngLat, signal: AbortSignal) => Promise<Route>;
  // Called when the trip is set up, so speeds and announcement distances suit walking or cycling.
  mode: () => Mode;
  // Which pixel car to show in the retro look.
  car: () => string;
};

// Distances read out loud, in the units the person's device uses.
export function sayDistance(meters: number): string {
  if (usesMiles()) {
    const feet = meters * 3.281;
    if (feet < 1000) return `${Math.max(50, Math.round(feet / 50) * 50)} feet`;
    const miles = meters / 1609.344;
    return miles < 1.2 ? `${Math.round(miles * 4) / 4 || 0.25} miles`.replace("0.5 miles", "half a mile") : `${miles.toFixed(1)} miles`;
  }
  if (meters < 1000) return `${Math.max(50, Math.round(meters / 50) * 50)} meters`;
  return `${(meters / 1000).toFixed(1)} kilometers`;
}

const ARRIVE_WITHIN = 25;
const TILT = 60;
const FRAME_MS = 33;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Guides you along a route using your real position. GPS only arrives about once a second, so the
// car is moved every frame between fixes: it is held on the road (map-matched), nudged forward by
// your speed, and the camera trails behind it, tilted, turned to face the way the road goes.
export class Navigator {
  private map: MLMap;
  private ev: NavEvents;
  private retro: boolean;
  private route: Route | null = null;
  private dest: LngLat = [0, 0];
  private cum: number[] = [];
  private stepAlong: number[] = [];
  private stopWatch: (() => void) | null = null;
  private stopAwake: (() => void) | null = null;
  private stopSim: (() => void) | null = null;
  private marker: Marker | null = null;
  private el: HTMLDivElement | null = null;
  private img: HTMLImageElement | null = null;
  private frameId = 0;
  private lastTick = 0;
  private lastRender = 0;
  private lastEmit = 0;
  private lastKey = "";
  private lastSprite = "";

  // Where we know you are (from the last fix) and what we show.
  private targetAlong = 0;
  private dispAlong = 0;
  private fixTime = 0;
  private lastGoodAt = 0;
  private speed = 0;
  private raw: LngLat | null = null;
  private dispPos: LngLat | null = null;
  private gpsHeading: number | null = null;
  private dispHeading = 0;
  private offRoute = false;

  // The camera.
  private camBearing = 0;
  private camZoom = 17;
  private camPitch = 0;
  private camPad = 0;
  private zoomBias = 0;
  private lastSetZoom = -1;
  private introAt = 0;
  private introFrom: LngLat = [0, 0];

  private offCount = 0;
  private rerouting = false;
  private following = true;
  private tilt = true;
  private demo = false;
  private voice = true;
  private mode: Mode = "drive";
  private finished = false;
  private gotFirstFix = false;
  private stages = new Map<number, number>();
  private abort: AbortController | null = null;
  private state: NavState;

  constructor(map: MLMap, events: NavEvents, retro: boolean) {
    this.map = map;
    this.ev = events;
    this.retro = retro;
    this.state = this.blank();
  }

  private blank(): NavState {
    return {
      phase: "waiting",
      pos: null,
      heading: null,
      nextText: "Finding your position…",
      nextIcon: "◎",
      nextDist: 0,
      thenText: null,
      remainingMeters: 0,
      remainingSeconds: 0,
      etaAt: Date.now(),
      offRoute: false,
      rerouting: false,
      following: true,
      speed: 0,
      tilt: this.tilt,
      demo: this.demo,
      error: null,
    };
  }

  private emit(patch: Partial<NavState> = {}) {
    this.state = { ...this.state, ...patch };
    this.ev.onState(this.state);
  }

  private onDrag = () => {
    this.following = false;
    this.emit({ following: false });
  };

  async start(route: Route, dest: LngLat, voice: boolean, demo = false) {
    this.stop();
    this.finished = false;
    this.gotFirstFix = false;
    this.voice = voice;
    this.demo = demo;
    this.mode = this.ev.mode();
    this.dest = dest;
    this.following = true;
    this.offCount = 0;
    this.speed = 0;
    this.raw = null;
    this.dispPos = null;
    this.gpsHeading = null;
    this.offRoute = false;
    this.zoomBias = 0;
    this.lastSetZoom = -1;
    this.lastGoodAt = 0;
    this.lastKey = "";
    this.state = this.blank();
    this.setRoute(route);
    this.emit();
    // A first spoken word inside the tap that started navigation lets the phone speak later.
    if (voice) speak(demo ? "Starting preview" : "Starting navigation");

    const el = document.createElement("div");
    this.el = el;
    if (this.retro) {
      el.className = "nav-car";
      const img = document.createElement("img");
      img.alt = "";
      img.draggable = false;
      el.append(img);
      this.img = img;
    } else {
      el.className = "nav-chevron";
      el.innerHTML =
        '<svg viewBox="0 0 48 48" width="46" height="46" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="rgba(26,115,232,.18)"/>' +
        '<path d="M24 5 38 40 24 33 10 40z" fill="#1a73e8" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/></svg>';
    }
    this.map.on("dragstart", this.onDrag);
    this.show3d(true);
    this.camBearing = this.map.getBearing();
    this.camZoom = this.map.getZoom();
    this.camPitch = this.map.getPitch();
    this.camPad = 0;
    this.lastTick = performance.now();
    this.frameId = requestAnimationFrame(this.tick);
    this.stopAwake = keepScreenAwake();
    if (demo) {
      this.stopSim = this.simulate();
      return;
    }
    const stop = await watchPosition(this.onFix, (message) => this.emit({ error: message }));
    // If navigation was stopped while the position prompt was open, stop following at once.
    if (this.finished || this.el !== el) stop();
    else this.stopWatch = stop;
  }

  private setRoute(route: Route) {
    this.route = route;
    this.cum = cumulative(route.line);
    this.stepAlong = [];
    let from = 0;
    for (const step of route.steps) {
      const snap = snapToRoute(route.line, this.cum, step.at, { from: from - 5, to: this.cum[this.cum.length - 1] });
      from = Math.max(from, snap.along);
      this.stepAlong.push(from);
    }
    this.targetAlong = 0;
    this.dispAlong = 0;
    this.stages.clear();
    // The new route may start anywhere near you, so the next fix may search all of it.
    this.gotFirstFix = false;
  }

  // A pretend GPS that drives the route, so the whole thing can be tried sitting at home.
  private simulate() {
    const route = this.route!;
    const total = this.cum[this.cum.length - 1] || 1;
    const pace = clamp(total / 150, 10, 30);
    let along = 0;
    const timer = window.setInterval(() => {
      if (this.finished || this.rerouting) return;
      // Slow down for the end of the trip so it feels like pulling in.
      const slow = clamp((total - along) / 120, 0.3, 1);
      along = Math.min(total, along + pace * slow);
      const p = pointAt(route.line, this.cum, along);
      const jitter = () => (Math.random() - 0.5) * 5e-5;
      this.onFix({ at: [p[0] + jitter(), p[1] + jitter()], heading: null, speed: pace * slow, accuracy: 6 });
    }, 1000);
    return () => window.clearInterval(timer);
  }

  private onFix = (fix: Fix) => {
    const route = this.route;
    if (this.finished || !route) return;
    const now = performance.now();
    const pos = fix.at;
    const acc = fix.accuracy ?? 15;
    // A wild fix (tunnel, tall buildings) should not drag the car away when we had a good one just now.
    if (acc > 60 && this.lastGoodAt && now - this.lastGoodAt < 8000) return;
    if (acc <= 60) this.lastGoodAt = now;

    this.raw = this.raw ? [this.raw[0] + (pos[0] - this.raw[0]) * 0.6, this.raw[1] + (pos[1] - this.raw[1]) * 0.6] : pos;
    if (fix.heading !== null && (fix.speed ?? 0) > 1.5) this.gpsHeading = fix.heading;

    const total = this.cum[this.cum.length - 1] || 1;
    // Only look near where you were: a parallel street must not make you jump ahead on the route.
    // The first fix on a route may be anywhere, so it searches the whole route.
    let snap = snapToRoute(route.line, this.cum, pos, { from: this.targetAlong - 150, to: this.targetAlong + 1200 });
    if (!this.gotFirstFix && snap.off > 60) {
      const global = snapToRoute(route.line, this.cum, pos);
      if (global.off < snap.off) snap = global;
    }
    const limit = Math.max(50, acc * 1.5);
    const off = snap.off > limit;

    if (!this.gotFirstFix) {
      this.gotFirstFix = true;
      this.introAt = now;
      this.introFrom = this.map.getCenter().toArray() as LngLat;
      // Starting somewhere other than the route's start: plan from where you actually are.
      if (off && snap.off > 150) this.offCount = 3;
    }

    if (off) {
      this.offCount++;
      if (this.offCount >= 3 && !this.rerouting) void this.reroute(pos);
    } else {
      this.offCount = 0;
      // GPS wobble must never make you drive backwards along the route.
      const gain = snap.along - this.targetAlong;
      const dt = this.fixTime ? clamp((now - this.fixTime) / 1000, 0.2, 5) : 1;
      this.targetAlong = gain < 0 && gain > -40 ? this.targetAlong : snap.along;
      const measured = fix.speed ?? Math.max(0, gain) / dt;
      const sp = measured < 0.8 ? 0 : measured;
      this.speed = this.fixTime ? this.speed * 0.5 + sp * 0.5 : sp;
    }
    if (off) this.speed = fix.speed ?? this.speed;
    this.offRoute = off;
    this.fixTime = now;

    if (this.state.phase === "waiting" || this.state.pos === null) {
      this.dispAlong = this.targetAlong;
      this.dispPos = off ? this.raw : pointAt(route.line, this.cum, this.targetAlong);
      this.dispHeading = off ? (this.gpsHeading ?? 0) : routeBearing(route.line, this.cum, this.targetAlong);
      this.camBearing = this.dispHeading;
      this.emitNow(true);
    }
    if (total - this.targetAlong <= ARRIVE_WITHIN && !this.rerouting && !off) this.arrive();
  };

  // Frame loop: glide the car along the route, steer the camera, refresh the countdown.
  private tick = (now: number) => {
    if (this.finished) return;
    this.frameId = requestAnimationFrame(this.tick);
    const route = this.route;
    if (!route || this.dispPos === null) {
      this.lastTick = now;
      return;
    }
    const dt = clamp((now - this.lastTick) / 1000, 0, 0.25);
    this.lastTick = now;
    const total = this.cum[this.cum.length - 1] || 1;

    // Between fixes, keep moving at your current speed.
    const since = Math.min(1.5, (now - this.fixTime) / 1000);
    const predicted = Math.min(total, this.targetAlong + this.speed * since);
    const diff = predicted - this.dispAlong;
    this.dispAlong = Math.abs(diff) > 60 ? predicted : this.dispAlong + diff * Math.min(1, dt * 5);

    const wanted = this.offRoute && this.raw ? this.raw : pointAt(route.line, this.cum, this.dispAlong);
    const k = Math.min(1, dt * 14);
    this.dispPos = [this.dispPos[0] + (wanted[0] - this.dispPos[0]) * k, this.dispPos[1] + (wanted[1] - this.dispPos[1]) * k];

    const look = clamp(this.speed * 1.5, 15, 60);
    const headTo = this.offRoute ? (this.gpsHeading ?? this.dispHeading) : routeBearing(route.line, this.cum, this.dispAlong, look);
    this.dispHeading = easeAngle(this.dispHeading, headTo, dt * 4);

    if (now - this.lastRender >= FRAME_MS) {
      this.lastRender = now;
      this.render(now, dt);
    }
    if (now - this.lastEmit >= 250) {
      this.lastEmit = now;
      this.emitNow(false);
    }
  };

  private render(now: number, dt: number) {
    const pos = this.dispPos!;
    this.placeMarker(pos, now);
    if (!this.following) {
      this.lastSetZoom = -1;
      return;
    }
    const map = this.map;
    // If you pinched the map, remember that and keep your zoom instead of fighting it.
    if (this.lastSetZoom >= 0) {
      const moved = map.getZoom() - this.lastSetZoom;
      if (Math.abs(moved) > 0.01) this.zoomBias = clamp(this.zoomBias + moved, -2.5, 2);
    }
    const drive = this.mode === "drive";
    const v = this.speed;
    let zoom = drive ? 17.6 - clamp(v, 0, 32) * 0.055 : this.mode === "bike" ? 17.8 - clamp(v, 0, 10) * 0.05 : 18.2;
    if (drive && this.state.nextDist < 160 && this.state.phase === "active") zoom += 0.45;
    const pitch = this.tilt ? TILT : 0;
    const pad = (map.getContainer().clientHeight || 600) * (this.tilt ? 0.42 : 0.26);

    this.camZoom += (zoom - this.camZoom) * Math.min(1, dt * 1.6);
    this.camPitch += (pitch - this.camPitch) * Math.min(1, dt * 3);
    this.camPad += (pad - this.camPad) * Math.min(1, dt * 3);
    this.camBearing = easeAngle(this.camBearing, this.dispHeading, dt * 3.2);

    // On the first fix glide in from wherever the map was; after that stay locked on the car.
    const w = clamp((now - this.introAt) / 1200, 0, 1);
    const e = w * w * (3 - 2 * w);
    const center: LngLat = [this.introFrom[0] + (pos[0] - this.introFrom[0]) * e, this.introFrom[1] + (pos[1] - this.introFrom[1]) * e];
    const finalZoom = this.camZoom + this.zoomBias;
    map.jumpTo({ center, zoom: finalZoom, bearing: this.camBearing, pitch: this.camPitch, padding: { top: this.camPad, bottom: 0, left: 0, right: 0 } });
    this.lastSetZoom = map.getZoom();
  }

  private placeMarker(pos: LngLat, now: number) {
    if (!this.el) return;
    if (!this.marker) {
      this.marker = new maplibregl.Marker(
        this.retro
          ? { element: this.el, anchor: "bottom", rotationAlignment: "viewport", pitchAlignment: "viewport" }
          : { element: this.el, anchor: "center", rotationAlignment: "map", pitchAlignment: "map" },
      )
        .setLngLat(pos)
        .addTo(this.map);
    }
    this.marker.setLngLat(pos);
    if (this.retro) {
      // The car is seen from behind: it stays upright while the camera follows, and only turns if you look around.
      this.marker.setRotation(this.following ? 0 : angleDiff(this.map.getBearing(), this.dispHeading));
      const id = this.ev.car();
      const src = carRearUrl(id, Math.floor(now / 140));
      if (src !== this.lastSprite && this.img) {
        this.lastSprite = src;
        this.img.src = src;
      }
    } else {
      this.marker.setRotation(this.dispHeading);
    }
  }

  private nextStep() {
    const route = this.route!;
    const total = this.cum[this.cum.length - 1] || 1;
    const last = route.steps.length - 1;
    let next = last;
    for (let i = 1; i < last; i++) {
      if (this.stepAlong[i] > this.dispAlong + 8) {
        next = i;
        break;
      }
    }
    return { next, last, total };
  }

  private emitNow(force: boolean) {
    const route = this.route;
    if (!route || this.finished || !this.dispPos) return;
    const { next, last, total } = this.nextStep();
    const remaining = Math.max(0, total - this.dispAlong);
    const step = route.steps[next];
    const nextDist = Math.max(0, (this.stepAlong[next] ?? total) - this.dispAlong);
    const after = route.steps[next + 1];
    const then =
      after && next < last && (this.stepAlong[next + 1] ?? total) - (this.stepAlong[next] ?? 0) < 400
        ? next + 1 === last
          ? "Then arrive"
          : `Then ${after.text.charAt(0).toLowerCase()}${after.text.slice(1)}`
        : null;
    const text = next === last ? "Arrive at your destination" : step.text;
    const left = route.duration * (remaining / total);
    const key = [text, then, Math.round(nextDist / 5), Math.round(left / 15), Math.round(this.speed * 3.6), this.offRoute && this.offCount >= 2, this.rerouting].join("|");
    if (!force && key === this.lastKey) {
      this.speakStages(next, nextDist, text, then);
      return;
    }
    this.lastKey = key;
    this.emit({
      phase: this.state.phase === "arrived" ? "arrived" : "active",
      pos: this.dispPos,
      heading: this.dispHeading,
      nextText: text,
      nextIcon: step.icon,
      nextDist,
      thenText: then,
      remainingMeters: remaining,
      remainingSeconds: left,
      etaAt: Date.now() + left * 1000,
      offRoute: this.offRoute && this.offCount >= 2,
      speed: this.speed,
      error: null,
    });
    this.speakStages(next, nextDist, text, then);
  }

  // Three calls per turn, timed by how fast you are going: a heads-up, a reminder, and "now".
  private speakStages(index: number, dist: number, text: string, then: string | null) {
    if (!this.voice || this.offRoute || this.rerouting) return;
    const drive = this.mode === "drive";
    const v = Math.max(this.speed, drive ? 6 : this.mode === "bike" ? 3 : 1.2);
    const far = drive ? clamp(v * 35, 400, 1600) : clamp(v * 30, 80, 300);
    const mid = drive ? clamp(v * 12, 140, 500) : clamp(v * 12, 40, 120);
    const now = drive ? clamp(v * 4, 35, 110) : clamp(v * 4, 12, 30);
    const stage = dist <= now ? 3 : dist <= mid ? 2 : dist <= far ? 1 : 0;
    const seen = this.stages.get(index);
    if (seen === undefined) {
      // The first time we see a turn, speak it only if it is already close or this is the very first one.
      this.stages.set(index, stage);
      if (this.stages.size === 1) {
        speak(`${text} in ${sayDistance(dist)}`);
      } else if (stage >= 1) {
        speak(stage === 3 ? text : `In ${sayDistance(dist)}, ${text}`);
      }
      return;
    }
    if (stage <= seen) return;
    this.stages.set(index, stage);
    if (stage === 3) speak(text);
    else if (stage === 2) speak(`In ${sayDistance(dist)}, ${text}${then && drive ? `. ${then}` : ""}`);
    else speak(`In ${sayDistance(dist)}, ${text}`);
  }

  private async reroute(from: LngLat) {
    this.rerouting = true;
    this.emit({ rerouting: true });
    if (this.voice) speak("Rerouting");
    this.abort?.abort();
    const ctrl = new AbortController();
    this.abort = ctrl;
    try {
      const route = await this.ev.getRoute(from, this.dest, ctrl.signal);
      if (this.finished || ctrl.signal.aborted) return;
      this.setRoute(route);
      this.offCount = 0;
      this.offRoute = false;
      this.ev.onReroute(route);
      if (this.voice) speak("New route found");
    } catch {
      // Keep the old route and try again after a few more position updates.
      this.offCount = -6;
    } finally {
      this.rerouting = false;
      if (!this.finished) this.emit({ rerouting: false });
    }
  }

  private arrive() {
    if (this.finished) return;
    this.finished = true;
    cancelAnimationFrame(this.frameId);
    this.stopWatch?.();
    this.stopWatch = null;
    this.stopSim?.();
    this.stopSim = null;
    this.stopAwake?.();
    this.stopAwake = null;
    // Pull the car up to the destination and hold the view there.
    const end = this.route ? pointAt(this.route.line, this.cum, this.cum[this.cum.length - 1]) : null;
    if (end) this.marker?.setLngLat(end);
    this.emit({ phase: "arrived", nextText: "You have arrived", nextIcon: "★", nextDist: 0, thenText: null, remainingMeters: 0, remainingSeconds: 0, speed: 0 });
    if (this.voice) speak("You have arrived");
  }

  setVoice(on: boolean) {
    this.voice = on;
    if (!on) stopSpeaking();
  }

  private show3d(on: boolean) {
    if (this.map.getLayer("building-3d")) this.map.setLayoutProperty("building-3d", "visibility", on ? "visible" : "none");
  }

  setTilt(on: boolean) {
    this.tilt = on;
    this.emit({ tilt: on });
  }

  recenter() {
    this.following = true;
    this.introAt = performance.now();
    this.introFrom = this.map.getCenter().toArray() as LngLat;
    this.camBearing = this.map.getBearing();
    this.emit({ following: true });
  }

  get active() {
    return this.el !== null;
  }

  stop() {
    this.finished = true;
    cancelAnimationFrame(this.frameId);
    this.abort?.abort();
    this.stopWatch?.();
    this.stopWatch = null;
    this.stopSim?.();
    this.stopSim = null;
    this.stopAwake?.();
    this.stopAwake = null;
    stopSpeaking();
    this.map.off("dragstart", this.onDrag);
    this.show3d(false);
    if (this.marker) {
      this.marker.remove();
      this.marker = null;
      this.map.easeTo({ bearing: 0, pitch: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 600 });
    }
    this.el = null;
    this.img = null;
    this.lastSprite = "";
    this.route = null;
    this.dispPos = null;
    this.fixTime = 0;
  }
}
