import * as maplibregl from "maplibre-gl";
import type { Map as MLMap, Marker } from "maplibre-gl";
import { usesMiles, type LngLat, type Mode, type Route } from "../lib/geo";
import { keepScreenAwake, speak, stopSpeaking, watchPosition, type Fix } from "../lib/platform";
import { bearing, cumulative, metersBetween, snapToRoute } from "./geometry";

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
  error: string | null;
};

export type NavEvents = {
  onState: (state: NavState) => void;
  onReroute: (route: Route) => void;
  getRoute: (from: LngLat, to: LngLat, signal: AbortSignal) => Promise<Route>;
  // Called when the trip is set up, so speeds and announcement distances suit walking or cycling.
  mode: () => Mode;
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
const FOLLOW_ZOOM = 17;

// Guides you along a route using your real position: follows you on the map, works out the next
// turn and how far away it is, tells you out loud, and finds a new route if you leave this one.
export class Navigator {
  private map: MLMap;
  private ev: NavEvents;
  private rotate: boolean;
  private route: Route | null = null;
  private dest: LngLat = [0, 0];
  private cum: number[] = [];
  private stepAlong: number[] = [];
  private stopWatch: (() => void) | null = null;
  private stopAwake: (() => void) | null = null;
  private marker: Marker | null = null;
  private dot: HTMLDivElement | null = null;
  private along = 0;
  private lastPos: LngLat | null = null;
  private heading: number | null = null;
  private offCount = 0;
  private rerouting = false;
  private following = true;
  private voice = true;
  private mode: Mode = "drive";
  private finished = false;
  private gotFirstFix = false;
  private zoomed = false;
  private spoken = new Set<string>();
  private abort: AbortController | null = null;
  private state: NavState;

  constructor(map: MLMap, events: NavEvents, rotate: boolean) {
    this.map = map;
    this.ev = events;
    this.rotate = rotate;
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

  async start(route: Route, dest: LngLat, voice: boolean) {
    this.stop();
    this.finished = false;
    this.gotFirstFix = false;
    this.zoomed = false;
    this.voice = voice;
    this.mode = this.ev.mode();
    this.dest = dest;
    this.following = true;
    this.offCount = 0;
    this.along = 0;
    this.lastPos = null;
    this.heading = null;
    this.spoken.clear();
    this.state = this.blank();
    this.setRoute(route);
    this.emit();
    // A first spoken word inside the tap that started navigation lets the phone speak later.
    if (voice) speak("Starting navigation");

    const el = document.createElement("div");
    el.className = "nav-dot no-heading";
    el.innerHTML = '<span class="nav-pulse"></span><span class="nav-arrow"></span><span class="nav-core"></span>';
    this.dot = el;
    this.map.on("dragstart", this.onDrag);
    this.stopAwake = keepScreenAwake();
    const stop = await watchPosition(this.onFix, (message) => this.emit({ error: message }));
    // If navigation was stopped while the position prompt was open, stop following at once.
    if (this.finished || this.dot !== el) stop();
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
    this.along = 0;
    this.spoken.clear();
  }

  private onFix = (fix: Fix) => {
    const route = this.route;
    if (this.finished || !route) return;
    const pos = fix.at;

    if (fix.heading !== null && (fix.speed ?? 0) > 1) this.heading = fix.heading;
    else if (this.lastPos && metersBetween(this.lastPos, pos) > 6) this.heading = bearing(this.lastPos, pos);
    if (!this.lastPos || metersBetween(this.lastPos, pos) > 6) this.lastPos = pos;

    const total = this.cum[this.cum.length - 1] || 1;
    // Only look near where you were: a parallel street must not make you jump ahead on the route.
    // The very first fix may be anywhere, so it searches the whole route.
    let snap = snapToRoute(route.line, this.cum, pos, { from: this.along - 150, to: this.along + 1200 });
    if (!this.gotFirstFix && snap.off > 60) {
      const global = snapToRoute(route.line, this.cum, pos);
      if (global.off < snap.off) snap = global;
    }
    const limit = Math.max(50, (fix.accuracy ?? 0) * 1.5);
    const off = snap.off > limit;

    if (!this.gotFirstFix) {
      this.gotFirstFix = true;
      // Starting somewhere other than the route's start: plan from where you actually are.
      if (off && snap.off > 150) this.offCount = 3;
    }

    if (off) {
      this.offCount++;
      if (this.offCount >= 3 && !this.rerouting) void this.reroute(pos);
    } else {
      this.offCount = 0;
      this.along = snap.along;
    }

    const remaining = Math.max(0, total - this.along);
    const last = route.steps.length - 1;
    let next = last;
    for (let i = 1; i < last; i++) {
      if (this.stepAlong[i] > this.along + 8) {
        next = i;
        break;
      }
    }
    const nextStep = route.steps[next];
    const nextDist = Math.max(0, (this.stepAlong[next] ?? total) - this.along);
    const after = route.steps[next + 1];
    const then =
      after && next < last && (this.stepAlong[next + 1] ?? total) - (this.stepAlong[next] ?? 0) < 400
        ? next + 1 === last
          ? "Then arrive"
          : `Then ${after.text.charAt(0).toLowerCase()}${after.text.slice(1)}`
        : null;

    this.emit({
      phase: "active",
      pos,
      heading: this.heading,
      nextText: next === last ? "Arrive at your destination" : nextStep.text,
      nextIcon: nextStep.icon,
      nextDist,
      thenText: then,
      remainingMeters: remaining,
      remainingSeconds: route.duration * (remaining / total),
      etaAt: Date.now() + route.duration * (remaining / total) * 1000,
      offRoute: off,
      error: null,
    });

    this.placeDot(pos);
    this.follow(pos);
    if (!off) this.announce(next, nextDist, fix.speed, next === last ? "Arrive at your destination" : nextStep.text);

    if (remaining <= ARRIVE_WITHIN && !this.rerouting) this.arrive();
  };

  private placeDot(pos: LngLat) {
    if (!this.dot) return;
    if (!this.marker) this.marker = new maplibregl.Marker({ element: this.dot, anchor: "center", rotationAlignment: "viewport", pitchAlignment: "viewport" }).setLngLat(pos).addTo(this.map);
    this.marker.setLngLat(pos);
    if (this.heading !== null) {
      this.dot.classList.remove("no-heading");
      this.marker.setRotation(this.heading - this.map.getBearing());
    }
  }

  private follow(pos: LngLat) {
    if (!this.following) return;
    const first = !this.zoomed;
    this.zoomed = true;
    this.map.easeTo({
      center: pos,
      ...(first ? { zoom: FOLLOW_ZOOM } : {}),
      bearing: this.rotate && this.heading !== null ? this.heading : this.rotate ? this.map.getBearing() : 0,
      duration: 900,
      easing: (t) => t,
      essential: true,
    });
  }

  private announce(index: number, dist: number, speed: number | null, text: string) {
    if (!this.voice) return;
    if (!this.spoken.has("__started")) {
      this.spoken.add("__started");
      speak(`${text} in ${sayDistance(dist)}`);
      this.spoken.add(`${index}:far`);
      return;
    }
    const typical = this.mode === "drive" ? 8 : this.mode === "bike" ? 4 : 1.4;
    const far = Math.min(900, Math.max(this.mode === "drive" ? 250 : 60, (speed ?? typical) * 20));
    const near = this.mode === "drive" ? 90 : 30;
    if (dist <= far && dist > near && !this.spoken.has(`${index}:far`)) {
      this.spoken.add(`${index}:far`);
      speak(`In ${sayDistance(dist)}, ${text}`);
    } else if (dist <= near && !this.spoken.has(`${index}:near`)) {
      this.spoken.add(`${index}:near`);
      this.spoken.add(`${index}:far`);
      speak(text);
    }
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
    this.stopWatch?.();
    this.stopWatch = null;
    this.stopAwake?.();
    this.stopAwake = null;
    this.emit({ phase: "arrived", nextText: "You have arrived", nextIcon: "★", nextDist: 0, thenText: null, remainingMeters: 0, remainingSeconds: 0 });
    if (this.voice) speak("You have arrived");
  }

  setVoice(on: boolean) {
    this.voice = on;
    if (!on) stopSpeaking();
  }

  recenter() {
    this.following = true;
    this.emit({ following: true });
    if (this.state.pos) this.follow(this.state.pos);
  }

  get active() {
    return this.dot !== null;
  }

  stop() {
    this.finished = true;
    this.abort?.abort();
    this.stopWatch?.();
    this.stopWatch = null;
    this.stopAwake?.();
    this.stopAwake = null;
    stopSpeaking();
    this.map.off("dragstart", this.onDrag);
    if (this.marker) {
      this.marker.remove();
      this.marker = null;
      this.map.easeTo({ bearing: 0, pitch: 0, duration: 500 });
    }
    this.dot = null;
    this.route = null;
  }
}
