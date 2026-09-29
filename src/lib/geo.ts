export type LngLat = [number, number];

export type Place = {
  label: string;
  detail: string;
  at: LngLat;
  // Set when this is one of your saved places, so it can show its pixel building.
  building?: string;
};

export type Step = {
  text: string;
  distance: number;
  at: LngLat;
  icon: string;
};

export type Route = {
  distance: number;
  duration: number;
  line: LngLat[];
  steps: Step[];
};

type PhotonFeature = {
  geometry: { coordinates: LngLat };
  properties: Record<string, string | undefined>;
};

// Photon (by Komoot) is a free search service built on OpenStreetMap data.
export async function searchPlaces(query: string, near: LngLat | null, signal: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ q: query, limit: "6", lang: "en" });
  if (near) {
    params.set("lon", near[0].toFixed(4));
    params.set("lat", near[1].toFixed(4));
  }
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, { signal });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const body = (await res.json()) as { features?: PhotonFeature[] };
  return (body.features ?? []).map(toPlace);
}

export async function reverseLookup(at: LngLat): Promise<Place> {
  const params = new URLSearchParams({ lon: String(at[0]), lat: String(at[1]), lang: "en" });
  try {
    const res = await fetch(`https://photon.komoot.io/reverse?${params}`);
    const body = (await res.json()) as { features?: PhotonFeature[] };
    const hit = body.features?.[0];
    if (hit) return { ...toPlace(hit), at };
  } catch {
    // Fall through to a plain label; the spot is still usable.
  }
  return { label: "Dropped pin", detail: `${at[1].toFixed(4)}, ${at[0].toFixed(4)}`, at };
}

function toPlace(feature: PhotonFeature): Place {
  const p = feature.properties;
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  const label = p.name || street || p.city || "Unnamed place";
  const detail = [p.name ? street : "", p.city, p.state, p.country]
    .filter((part) => part && part !== label)
    .join(", ");
  return { label, detail, at: feature.geometry.coordinates };
}

type OsrmStep = {
  distance: number;
  name: string;
  ref?: string;
  maneuver: { type: string; modifier?: string; location: LngLat; exit?: number };
};

// OSRM's public demo server: fine for a personal app, swap for a keyed service before a public launch.
export async function getRoute(from: LngLat, to: LngLat, signal: AbortSignal): Promise<Route> {
  const coords = `${from[0]},${from[1]};${to[0]},${to[1]}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Route failed (${res.status})`);
  const body = (await res.json()) as {
    code: string;
    routes?: {
      distance: number;
      duration: number;
      geometry: { coordinates: LngLat[] };
      legs: { steps: OsrmStep[] }[];
    }[];
  };
  const route = body.routes?.[0];
  if (body.code !== "Ok" || !route) throw new Error("No road route between those two places.");
  return {
    distance: route.distance,
    duration: route.duration,
    line: route.geometry.coordinates,
    steps: route.legs.flatMap((leg) => leg.steps).map(toStep),
  };
}

function toStep(step: OsrmStep): Step {
  const { type, modifier, exit } = step.maneuver;
  const road = step.name || step.ref || "";
  const onto = road ? ` onto ${road}` : "";
  const dir = modifier ?? "straight";
  let text: string;
  switch (type) {
    case "depart":
      text = road ? `Head out on ${road}` : "Head out";
      break;
    case "arrive":
      text = "You made it!";
      break;
    case "roundabout":
    case "rotary":
      text = exit ? `Roundabout, take exit ${exit}${onto}` : `Take the roundabout${onto}`;
      break;
    case "merge":
      text = `Merge${onto}`;
      break;
    case "on ramp":
      text = `Take the ramp${onto}`;
      break;
    case "off ramp":
      text = `Take the exit${onto}`;
      break;
    case "fork":
      text = `Keep ${dir.replace("slight ", "")}${onto}`;
      break;
    case "continue":
    case "new name":
      text = `Continue${onto}`;
      break;
    default:
      text = dir === "straight" ? `Go straight${onto}` : dir === "uturn" ? `Make a U-turn${onto}` : `Turn ${dir}${onto}`;
  }
  return { text, distance: step.distance, at: step.maneuver.location, icon: arrowFor(type, dir) };
}

function arrowFor(type: string, dir: string): string {
  if (type === "depart") return "▶";
  if (type === "arrive") return "★";
  if (type === "roundabout" || type === "rotary") return "↻";
  if (dir.includes("uturn")) return "↶";
  if (dir.includes("left")) return dir.includes("slight") ? "↖" : "←";
  if (dir.includes("right")) return dir.includes("slight") ? "↗" : "→";
  return "↑";
}

const usesMiles = () => /^en-(US|GB|LR|MM)$/i.test(navigator.language);

export function formatDistance(meters: number): string {
  if (usesMiles()) {
    const miles = meters / 1609.344;
    if (miles < 0.2) return `${Math.round(meters * 3.28084 / 10) * 10} ft`;
    return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
  }
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}
