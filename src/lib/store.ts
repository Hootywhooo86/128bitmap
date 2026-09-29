import { getBuilding, hasBuilding } from "../pixel/buildings";
import { hasCar } from "../pixel/cars";
import type { LngLat, Place } from "./geo";

export type SavedPlace = {
  id: string;
  name: string;
  building: string;
  at: LngLat;
};

const PLACES_KEY = "128bitmaps.places";
const CAR_KEY = "128bitmaps.car";
export const DEFAULT_CAR = "muscle";

export function newId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function asPlace(value: unknown): SavedPlace | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const at = v.at;
  if (typeof v.id !== "string" || !v.id || typeof v.name !== "string") return null;
  if (!Array.isArray(at) || typeof at[0] !== "number" || typeof at[1] !== "number") return null;
  if (!(Math.abs(at[0]) <= 180 && Math.abs(at[1]) <= 90)) return null;
  const name = v.name.trim().slice(0, 60);
  if (!name) return null;
  const building = typeof v.building === "string" && hasBuilding(v.building) ? v.building : "cottage";
  return { id: v.id.slice(0, 40), name, building, at: [at[0], at[1]] };
}

export function loadPlaces(): SavedPlace[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(PLACES_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.map(asPlace).filter((p): p is SavedPlace => p !== null) : [];
  } catch {
    return [];
  }
}

export function savePlaces(places: SavedPlace[]) {
  try {
    localStorage.setItem(PLACES_KEY, JSON.stringify(places));
  } catch {
    // Storage can be blocked (private mode); the app still works for this visit.
  }
}

export function loadCar(): string {
  try {
    const id = localStorage.getItem(CAR_KEY);
    return id && hasCar(id) ? id : DEFAULT_CAR;
  } catch {
    return DEFAULT_CAR;
  }
}

export function saveCar(id: string) {
  try {
    localStorage.setItem(CAR_KEY, id);
  } catch {
    // Same as above.
  }
}

// ---- Backup and restore ----

export function makeBackup(places: SavedPlace[], car: string): string {
  return JSON.stringify(
    { app: "128bitmaps", version: 1, exportedAt: new Date().toISOString(), car, places },
    null,
    2,
  );
}

export type Restored = { places: SavedPlace[]; car: string | null; skipped: number };

export function readBackup(text: string): Restored {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't a 128BITMAPS backup.");
  }
  const obj = data as { app?: unknown; places?: unknown; car?: unknown } | null;
  if (!obj || obj.app !== "128bitmaps" || !Array.isArray(obj.places)) {
    throw new Error("That file isn't a 128BITMAPS backup.");
  }
  const places = obj.places.map(asPlace).filter((p): p is SavedPlace => p !== null);
  return {
    places,
    car: typeof obj.car === "string" && hasCar(obj.car) ? obj.car : null,
    skipped: obj.places.length - places.length,
  };
}

// Restoring adds and updates; it never deletes places that are only on this device.
export function mergePlaces(current: SavedPlace[], incoming: SavedPlace[]): SavedPlace[] {
  const byId = new Map(current.map((p) => [p.id, p]));
  for (const place of incoming) byId.set(place.id, place);
  return [...byId.values()];
}

export function samePlace(a: LngLat, b: LngLat) {
  return Math.abs(a[0] - b[0]) < 0.00008 && Math.abs(a[1] - b[1]) < 0.00008;
}

// A saved place, shaped like a searched place so it can be used as a From or To.
export function savedToPlace(s: SavedPlace): Place {
  return { label: s.name, detail: getBuilding(s.building).name, at: s.at, building: s.building };
}
