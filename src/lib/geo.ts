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
  // The main road it uses, for telling alternatives apart.
  via?: string;
};

type PhotonFeature = {
  geometry: { coordinates: LngLat };
  properties: Record<string, string | undefined>;
};

type NominatimHit = {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  type?: string;
  address?: Record<string, string | undefined>;
};

// ---- Search ----
// Two free services built on OpenStreetMap: Photon is quick and good while you type; Nominatim is
// much better with street addresses ("10250 101 Street"), so it joins in when the text looks like one.

const searchCache = new Map<string, Place[]>();

// With a Geoapify key (free, from geoapify.com) search also uses their address database, which
// covers house numbers in many more places than OpenStreetMap alone.
let geoKey = "";
export function setGeoKey(key: string) {
  geoKey = key.trim();
  searchCache.clear();
}
export const hasGeoKey = () => geoKey !== "";

type GeoapifyProps = { formatted?: string; address_line1?: string; address_line2?: string; lat?: number; lon?: number; name?: string };

function geoapifyToPlaces(body: { features?: { properties: GeoapifyProps }[]; results?: GeoapifyProps[] }): Place[] {
  const list = body.results ?? body.features?.map((f) => f.properties) ?? [];
  return list
    .filter((r) => typeof r.lat === "number" && typeof r.lon === "number")
    .map((r) => ({
      label: r.address_line1 || r.name || r.formatted || "Place",
      detail: r.address_line2 || "",
      at: [r.lon as number, r.lat as number] as LngLat,
    }));
}

async function searchGeoapify(query: string, near: LngLat | null, signal: AbortSignal): Promise<Place[]> {
  const p = new URLSearchParams({ text: query, limit: "8", lang: "en", apiKey: geoKey });
  if (near) p.set("bias", `proximity:${near[0].toFixed(4)},${near[1].toFixed(4)}`);
  const res = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${p}`, { signal });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  return geoapifyToPlaces(await res.json());
}

// Used by the key check in the menu: returns an error message, or null if the key works.
export async function checkGeoKey(key: string): Promise<string | null> {
  try {
    const p = new URLSearchParams({ text: "10250 101 Street Edmonton", limit: "1", apiKey: key.trim() });
    const res = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${p}`, { signal: AbortSignal.timeout(8000) });
    if (res.status === 401 || res.status === 403) return "That key wasn't accepted. Check it and try again.";
    if (!res.ok) return `The search service answered ${res.status}.`;
    return geoapifyToPlaces(await res.json()).length ? null : "The key works, but the test search found nothing.";
  } catch {
    return "Couldn't reach the search service. Check your connection.";
  }
}
let lastNominatim = 0;

const looksLikeAddress = (q: string) => /^\d+[a-z]?\s+\S/i.test(q) && q.length >= 6;
const houseNumberOf = (q: string) => q.match(/^(\d+[a-z]?)\s/i)?.[1]?.toLowerCase() ?? null;

function dedupe(list: Place[]): Place[] {
  const seen = new Set<string>();
  return list.filter((p) => {
    const key = `${p.label.toLowerCase()}|${p.at[0].toFixed(4)}|${p.at[1].toFixed(4)}`;
    const near = `${p.at[0].toFixed(3)}|${p.at[1].toFixed(3)}|${p.label.toLowerCase().slice(0, 12)}`;
    if (seen.has(key) || seen.has(near)) return false;
    seen.add(key);
    seen.add(near);
    return true;
  });
}

export async function searchPlaces(
  query: string,
  near: LngLat | null,
  signal: AbortSignal,
  // Called as each service answers, so results appear as soon as the first one is back.
  onUpdate?: (places: Place[]) => void,
): Promise<Place[]> {
  const key = `${query.toLowerCase()}|${near ? near.map((n) => n.toFixed(1)).join() : ""}`;
  const cached = searchCache.get(key);
  if (cached) {
    onUpdate?.(cached);
    return cached;
  }
  const number = houseNumberOf(query);
  const rank = (list: Place[]) => {
    const score = (p: Place) => {
      let v = 0;
      // An address with the number you typed beats a lookalike with a different number.
      if (number) v += p.label.toLowerCase().startsWith(`${number} `) ? -2 : 0;
      if (near) v += Math.min(1, Math.hypot(p.at[0] - near[0], (p.at[1] - near[1]) * 1.6) / 2);
      return v;
    };
    return dedupe([...list].sort((a, b) => score(a) - score(b))).slice(0, 8);
  };

  let photon: Place[] = [];
  let nominatim: Place[] = [];
  let geoapify: Place[] = [];
  const publish = () => onUpdate?.(rank([...geoapify, ...nominatim, ...photon]));

  let nominatimAsked = false;
  const askNominatim = () => {
    if (nominatimAsked) return Promise.resolve();
    nominatimAsked = true;
    return searchNominatim(query, near, signal)
      .then((r) => {
        nominatim = r;
        publish();
      })
      .catch(() => {});
  };
  // Photon can hiccup or come back empty; Nominatim then fills in so there is always an answer.
  const askPhoton = async () => {
    try {
      photon = await searchPhoton(query, near, signal).catch(async (e) => {
        if (signal.aborted) throw e;
        await new Promise((r) => setTimeout(r, 350));
        return searchPhoton(query, near, signal);
      });
      publish();
    } catch (e) {
      if (signal.aborted) throw e;
    }
    if (photon.length === 0 && !signal.aborted) await askNominatim();
  };
  const tasks: Promise<void>[] = [askPhoton()];
  if (geoKey) {
    tasks.push(
      searchGeoapify(query, near, signal)
        .then((r) => {
          geoapify = r;
          publish();
        })
        .catch(() => {}),
    );
  }
  if (looksLikeAddress(query)) tasks.push(askNominatim());
  const [first] = await Promise.allSettled(tasks);
  if (first.status === "rejected") throw first.reason;
  const result = rank([...geoapify, ...nominatim, ...photon]);
  if (result.length) searchCache.set(key, result);
  return result;
}

async function searchPhoton(query: string, near: LngLat | null, signal: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ q: query, limit: "8", lang: "en" });
  if (near) {
    params.set("lon", near[0].toFixed(4));
    params.set("lat", near[1].toFixed(4));
  }
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, { signal });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const body = (await res.json()) as { features?: PhotonFeature[] };
  return (body.features ?? []).map(toPlace);
}

// The public Nominatim server asks for at most one request a second, so these are spaced out.
async function searchNominatim(query: string, near: LngLat | null, signal: AbortSignal): Promise<Place[]> {
  const wait = Math.max(0, lastNominatim + 1100 - Date.now());
  lastNominatim = Date.now() + wait;
  if (wait) await new Promise((r) => setTimeout(r, wait));
  if (signal.aborted) return [];
  const params = new URLSearchParams({ q: query, format: "jsonv2", addressdetails: "1", limit: "6", "accept-language": "en" });
  if (near) params.set("viewbox", `${near[0] - 0.7},${near[1] + 0.5},${near[0] + 0.7},${near[1] - 0.5}`);
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  return ((await res.json()) as NominatimHit[]).map(nominatimToPlace);
}

function nominatimToPlace(hit: NominatimHit): Place {
  const a = hit.address ?? {};
  const street = [a.house_number, a.road].filter(Boolean).join(" ");
  const label = hit.name && hit.name !== a.road ? hit.name : street || hit.display_name.split(",")[0];
  const city = a.city || a.town || a.village || a.municipality || a.suburb;
  const detail = [hit.name && street ? street : "", city, a.state].filter((part) => part && part !== label).join(", ");
  return { label, detail, at: [Number(hit.lon), Number(hit.lat)] };
}

export async function reverseLookup(at: LngLat): Promise<Place> {
  if (geoKey) {
    try {
      const q = new URLSearchParams({ lat: String(at[1]), lon: String(at[0]), format: "json", lang: "en", apiKey: geoKey });
      const res = await fetch(`https://api.geoapify.com/v1/geocode/reverse?${q}`, { signal: AbortSignal.timeout(3500) });
      const hit = geoapifyToPlaces(await res.json())[0];
      if (res.ok && hit) return { ...hit, at };
    } catch {
      // Fall back to the free services below.
    }
  }
  const params = new URLSearchParams({ lon: String(at[0]), lat: String(at[1]), lang: "en" });
  const photon = fetch(`https://photon.komoot.io/reverse?${params}`)
    .then((r) => r.json() as Promise<{ features?: PhotonFeature[] }>)
    .then((body) => {
      const hit = body.features?.[0];
      return hit ? { place: { ...toPlace(hit), at }, hasNumber: !!hit.properties.housenumber } : null;
    })
    .catch(() => null);
  const first = await photon;
  if (first?.hasNumber) return first.place;
  // Photon often only knows the street; Nominatim can find the exact house number.
  try {
    const q = new URLSearchParams({ lon: String(at[0]), lat: String(at[1]), format: "jsonv2", addressdetails: "1", zoom: "18", "accept-language": "en" });
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${q}`, { signal: AbortSignal.timeout(2500) });
    const hit = (await res.json()) as NominatimHit & { error?: string };
    if (!hit.error && hit.lat) {
      const place = nominatimToPlace(hit);
      if (hit.address?.house_number || !first) return { ...place, at };
    }
  } catch {
    // Keep what Photon found.
  }
  if (first) return first.place;
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

export type Mode = "drive" | "walk" | "bike";

export const MODES: { id: Mode; label: string }[] = [
  { id: "drive", label: "Drive" },
  { id: "walk", label: "Walk" },
  { id: "bike", label: "Bike" },
];

const PROFILE: Record<Mode, string> = { drive: "routed-car", walk: "routed-foot", bike: "routed-bike" };

type OsrmRoute = {
  distance: number;
  duration: number;
  geometry: { coordinates: LngLat[] };
  legs: { steps: OsrmStep[] }[];
};

// Routes come from the free FOSSGIS OSRM servers (car, foot and bike profiles). Fine for personal
// use; swap for a keyed routing service before a big public launch. If the main server is slow
// for driving, the public OSRM demo server is asked too and whichever answers first wins.
async function fetchOsrm(base: string, coords: string, signal: AbortSignal, alternatives: boolean): Promise<Route[]> {
  const alt = alternatives ? "&alternatives=3" : "";
  const res = await fetch(`${base}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true${alt}`, { signal });
  if (!res.ok) throw new Error(`Route failed (${res.status})`);
  const body = (await res.json()) as { code: string; routes?: OsrmRoute[] };
  if (body.code !== "Ok" || !body.routes?.length) throw new Error("No road route between those two places.");
  return body.routes.map(toRoute);
}

function toRoute(route: OsrmRoute): Route {
  const steps = route.legs.flatMap((leg) => leg.steps);
  // The road you spend the longest on names the route ("via 170 Street NW").
  const longest = [...steps].filter((st) => st.name).sort((x, y) => y.distance - x.distance)[0];
  return {
    distance: route.distance,
    duration: route.duration,
    line: route.geometry.coordinates,
    steps: steps.map(toStep),
    via: longest?.name,
  };
}

export async function getRoutes(from: LngLat, to: LngLat, signal: AbortSignal, mode: Mode = "drive", alternatives = true): Promise<Route[]> {
  const coords = `${from[0]},${from[1]};${to[0]},${to[1]}`;
  const main = fetchOsrm(`https://routing.openstreetmap.de/${PROFILE[mode]}`, coords, signal, alternatives);
  if (mode !== "drive") return main;
  const backup = new Promise<Route[]>((resolve, reject) => {
    const timer = setTimeout(() => {
      fetchOsrm("https://router.project-osrm.org", coords, signal, alternatives).then(resolve, reject);
    }, 2200);
    signal.addEventListener("abort", () => clearTimeout(timer));
  });
  // The first good answer wins; if both fail, report the main server's problem.
  return Promise.any([main, backup]).catch((e: AggregateError) => {
    throw e.errors?.[0] ?? e;
  });
}

export async function getRoute(from: LngLat, to: LngLat, signal: AbortSignal, mode: Mode = "drive"): Promise<Route> {
  return (await getRoutes(from, to, signal, mode, false))[0];
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

export const usesMiles = () => /^en-(US|GB|LR|MM)$/i.test(navigator.language);

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


// Hands a trip to the real Google Maps app (or site), for anything this app can't do.
export function googleMapsUrl(from: LngLat | null, to: LngLat, mode: Mode): string {
  const p = new URLSearchParams({ api: "1", destination: `${to[1]},${to[0]}`, travelmode: mode === "drive" ? "driving" : mode === "walk" ? "walking" : "bicycling" });
  if (from) p.set("origin", `${from[1]},${from[0]}`);
  return `https://www.google.com/maps/dir/?${p}`;
}

export function googlePlaceUrl(at: LngLat, label: string): string {
  return `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: label ? `${label} ${at[1]},${at[0]}` : `${at[1]},${at[0]}` })}`;
}
