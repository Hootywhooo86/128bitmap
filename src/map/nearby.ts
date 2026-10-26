import type { GeoJSONSource, Map as MLMap } from "maplibre-gl";
import type { Feature, FeatureCollection, Point } from "geojson";
import type { LngLat, Place } from "../lib/geo";
import { metersBetween } from "../nav/geometry";

// "What's around me" shortcuts. They read the places already drawn on the map (the map data is
// in memory), so the answer is instant and needs no search service.
export type Category = { id: string; label: string; glyph: string; classes: string[] };

export const CATEGORIES: Category[] = [
  { id: "food", label: "Restaurants", glyph: "🍴", classes: ["restaurant", "fast_food"] },
  { id: "coffee", label: "Coffee", glyph: "☕", classes: ["cafe", "bakery"] },
  { id: "gas", label: "Gas", glyph: "⛽", classes: ["fuel"] },
  { id: "grocery", label: "Groceries", glyph: "🛒", classes: ["grocery", "supermarket"] },
  { id: "parking", label: "Parking", glyph: "🅿", classes: ["parking"] },
  { id: "atm", label: "ATMs & banks", glyph: "💵", classes: ["atm", "bank"] },
  { id: "health", label: "Pharmacy & health", glyph: "✚", classes: ["pharmacy", "hospital", "dentist", "doctors"] },
  { id: "hotel", label: "Hotels", glyph: "🛏", classes: ["lodging"] },
  { id: "bar", label: "Bars & pubs", glyph: "🍺", classes: ["bar", "beer", "alcohol_shop"] },
  { id: "shops", label: "Shopping", glyph: "🛍", classes: ["shop", "clothing_store", "department_store", "mall"] },
  { id: "transit", label: "Transit", glyph: "🚌", classes: ["bus", "railway"] },
  { id: "parks", label: "Parks", glyph: "🌳", classes: ["park", "playground", "dog_park"] },
  { id: "wc", label: "Washrooms", glyph: "🚻", classes: ["toilets"] },
];

export type Nearby = { place: Place; dist: number };

const FALLBACK: Record<string, string> = {
  fuel: "Gas station",
  parking: "Parking",
  atm: "ATM",
  toilets: "Washroom",
  bus: "Bus stop",
  railway: "Station",
};

const pretty = (s: string) => {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

// Places of one kind in the loaded map, nearest first.
export function findNearby(map: MLMap, source: string, cat: Category, origin: LngLat, limit = 25): Nearby[] {
  const features = map.querySourceFeatures(source, {
    sourceLayer: "poi",
    filter: ["match", ["get", "class"], cat.classes, true, false],
  });
  const seen = new Set<string>();
  const out: Nearby[] = [];
  for (const f of features) {
    if (f.geometry.type !== "Point" && f.geometry.type !== "MultiPoint") continue;
    const coords = f.geometry.type === "Point" ? f.geometry.coordinates : f.geometry.coordinates[0];
    const at: LngLat = [coords[0], coords[1]];
    const props = f.properties ?? {};
    const name = String(props.name_en || props.name || "");
    const cls = String(props.class ?? "");
    const kind = FALLBACK[cls] ?? pretty(String(props.subclass || cls));
    // The same place appears in neighbouring map tiles; keep one.
    const key = `${name}|${at[0].toFixed(4)}|${at[1].toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!name && !FALLBACK[cls]) continue;
    out.push({ place: { label: name || kind, detail: name ? kind : "", at }, dist: metersBetween(origin, at) });
  }
  return out.sort((a, b) => a.dist - b.dist).slice(0, limit);
}

export function setNearby(map: MLMap, items: Nearby[] | null) {
  const source = map.getSource("nearby") as GeoJSONSource | undefined;
  const data: FeatureCollection<Point> = {
    type: "FeatureCollection",
    features: (items ?? []).map<Feature<Point>>((n, i) => ({
      type: "Feature",
      properties: { i },
      geometry: { type: "Point", coordinates: n.place.at },
    })),
  };
  source?.setData(data);
}
