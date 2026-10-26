import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MLMap, StyleSpecification } from "maplibre-gl";
import { PALETTE, retroStyle } from "./retroStyle";
import type { Feature, LineString } from "geojson";
import type { LngLat } from "../lib/geo";
import type { Theme } from "../lib/settings";
import classicJson from "./classicStyle.json";
import classicDarkJson from "./classicDarkStyle.json";
import workerUrl from "./maplibre-worker?worker&url";

maplibregl.setWorkerUrl(workerUrl);

// How many screen pixels each map pixel covers. 3 gives a clear chunky look
// while keeping streets readable.
export const CHUNK = 3;

const LABEL_LAYERS = new Set(["road-label", "water-label", "place-label"]);

// The classic style, its icons and the common Latin fonts ship inside the app (see
// scripts/make-classic-style.py), so the map doesn't wait on a chain of requests before it can draw.
const appBase = () => new URL("./", document.baseURI).href;

function classicStyle(dark: boolean): StyleSpecification {
  const style = structuredClone(dark ? classicDarkJson : classicJson) as unknown as StyleSpecification;
  style.sprite = `${appBase()}map/sprite/ofm`;
  return style;
}

const BUNDLED_RANGES = new Set(["0-255", "256-511", "8192-8447"]);
const BUNDLED_FONTS = new Set(["Noto-Sans-Regular", "Noto-Sans-Bold", "Noto-Sans-Italic"]);

// Fonts we ship are read locally; other alphabets still come from the internet when needed.
const transformRequest = (url: string, type?: string) => {
  if (type !== "Glyphs") return undefined;
  const m = url.match(/\/fonts\/([^/]+)\/(\d+-\d+)\.pbf/);
  if (!m) return undefined;
  const font = decodeURIComponent(m[1]).replace(/ /g, "-");
  if (!BUNDLED_RANGES.has(m[2]) || !BUNDLED_FONTS.has(font)) return undefined;
  return { url: `${appBase()}map/fonts/${font}/${m[2]}.pbf` };
};

export const CLASSIC_BLUE = "#1a73e8";

export type MapView = { center: LngLat; zoom: number };

// Two looks share one hook:
//  - classic: a normal, clean street map with a blue route line, like any maps app;
//  - retro: two stacked maps that move together. The art map renders at 1/CHUNK resolution and is
//    scaled up without smoothing (chunky pixels); the label map draws only text, at full
//    sharpness, so names stay readable.
// Switching look rebuilds the map in the same place.
export function useAppMap(theme: Theme, dark: boolean, start: MapView) {
  const artHost = useRef<HTMLDivElement>(null);
  const labelHost = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MLMap | null>(null);
  const view = useRef<MapView>(start);

  useEffect(() => {
    if (!artHost.current || !labelHost.current) return;
    const retro = theme === "retro";
    const style = retro ? retroStyle() : null;

    const art = new maplibregl.Map({
      container: artHost.current,
      style: style
        ? { ...style, layers: style.layers.filter((l) => !LABEL_LAYERS.has(l.id)) }
        : classicStyle(dark),
      transformRequest,
      center: view.current.center,
      zoom: view.current.zoom,
      // Phones can have 3x screens; drawing 2x is far lighter and still sharp.
      pixelRatio: retro ? 1 / CHUNK : Math.min(window.devicePixelRatio || 1, 2),
      fadeDuration: retro ? 300 : 120,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      maxPitch: 60,
    });
    art.touchZoomRotate.disableRotation();
    art.touchPitch.disable();
    art.on("moveend", () => {
      const c = art.getCenter();
      view.current = { center: [c.lng, c.lat], zoom: art.getZoom() };
    });

    let labels: maplibregl.Map | null = null;
    if (style) {
      labels = new maplibregl.Map({
        container: labelHost.current,
        style: {
          ...style,
          layers: [
            { id: "clear", type: "background", paint: { "background-opacity": 0 } },
            ...style.layers.filter((l) => LABEL_LAYERS.has(l.id)),
          ],
        },
        center: view.current.center,
        zoom: view.current.zoom,
        interactive: false,
        attributionControl: false,
        transformRequest,
      });
      const shadow = labels;
      art.on("move", () =>
        shadow.jumpTo({
          center: art.getCenter(),
          zoom: art.getZoom(),
          bearing: art.getBearing(),
          pitch: art.getPitch(),
          padding: art.getPadding(),
        }),
      );
    }

    art.on("load", () => {
      art.addSource("route", { type: "geojson", data: line([]) });
      art.addSource("route-alt", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      if (retro) {
        art.addLayer({
          id: "route-alt-line",
          type: "line",
          source: "route-alt",
          layout: { "line-join": "miter", "line-cap": "square" },
          paint: { "line-color": "#8c86b8", "line-width": 9, "line-dasharray": [2, 1.4] },
        });
        art.addLayer({
          id: "route-glow",
          type: "line",
          source: "route",
          layout: { "line-join": "miter", "line-cap": "square" },
          paint: { "line-color": PULSE[0].glow, "line-width": PULSE[0].width, "line-opacity": 0.75 },
        });
        art.addLayer({
          id: "route-edge",
          type: "line",
          source: "route",
          layout: { "line-join": "miter", "line-cap": "square" },
          paint: { "line-color": PALETTE.ink, "line-width": 13 },
        });
        art.addLayer({
          id: "route-fill",
          type: "line",
          source: "route",
          layout: { "line-join": "miter", "line-cap": "square" },
          paint: { "line-color": PULSE[0].fill, "line-width": 8 },
        });
        art.addLayer({
          id: "route-dash",
          type: "line",
          source: "route",
          layout: { "line-join": "miter" },
          paint: { "line-color": "#fff6df", "line-width": 4, "line-dasharray": MARCH[0] },
        });
      } else {
        const width = ["interpolate", ["linear"], ["zoom"], 8, 4, 14, 8, 18, 14] as unknown as number;
        const casing = ["interpolate", ["linear"], ["zoom"], 8, 7, 14, 12, 18, 19] as unknown as number;
        // Under the labels and places, like a real maps app, so names stay readable on the route.
        const under = art.getStyle().layers.find((l) => l.type === "symbol")?.id;
        art.addLayer(
          {
            id: "route-alt-line",
            type: "line",
            source: "route-alt",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": dark ? "#5f8fd6" : "#8ab0e8", "line-width": width },
          },
          under,
        );
        art.addLayer(
          {
            id: "route-casing",
            type: "line",
            source: "route",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#0b4aa8", "line-width": casing },
          },
          under,
        );
        art.addLayer(
          {
            id: "route-line",
            type: "line",
            source: "route",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": CLASSIC_BLUE, "line-width": width },
          },
          under,
        );
      }
      // Dots for "what's around me" results, on top of everything.
      art.addSource("nearby", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      art.addLayer({
        id: "nearby-dots",
        type: "circle",
        source: "nearby",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 5, 16, 9],
          "circle-color": retro ? PALETTE.ink : "#ea4335",
          "circle-stroke-color": retro ? "#ffd23f" : "#ffffff",
          "circle-stroke-width": retro ? 3 : 2.5,
        },
      });
      setMap(art);
    });

    const stopPulse = retro ? animateRoute(art) : () => {};

    return () => {
      stopPulse();
      art.remove();
      labels?.remove();
      setMap(null);
    };
  }, [theme, dark]);

  return { artHost, labelHost, map };
}

// The route pulses like an old game's path marker: the glow throbs in a few hard
// steps and white dashes march from start to finish. Stepped on purpose, no smooth easing.
const PULSE = [
  { glow: "#ff4d6d", width: 15, fill: "#ff4d6d" },
  { glow: "#ff8fa3", width: 22, fill: "#ff4d6d" },
  { glow: "#ffffff", width: 29, fill: "#ff7a8f" },
  { glow: "#ff8fa3", width: 22, fill: "#ff4d6d" },
];

// Dash patterns that shift the gap forward a little each frame, so dashes appear to travel.
const MARCH: number[][] = [
  [0, 4, 3],
  [0.5, 4, 2.5],
  [1, 4, 2],
  [1.5, 4, 1.5],
  [2, 4, 1],
  [2.5, 4, 0.5],
  [3, 4, 0],
  [0, 0.5, 3, 3.5],
  [0, 1, 3, 3],
  [0, 1.5, 3, 2.5],
  [0, 2, 3, 2],
  [0, 2.5, 3, 1.5],
  [0, 3, 3, 1],
  [0, 3.5, 3, 0.5],
];

const MARCH_MS = 70;
const PULSE_MS = 180;

function animateRoute(map: MLMap): () => void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  let frame = 0;
  let lastMarch = -1;
  let lastPulse = -1;
  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    if (!map.getLayer("route-dash") || !hasRoute(map)) return;
    const march = Math.floor(now / MARCH_MS) % MARCH.length;
    const pulse = Math.floor(now / PULSE_MS) % PULSE.length;
    if (march !== lastMarch) {
      lastMarch = march;
      map.setPaintProperty("route-dash", "line-dasharray", MARCH[march]);
    }
    if (pulse !== lastPulse) {
      lastPulse = pulse;
      map.setPaintProperty("route-glow", "line-color", PULSE[pulse].glow);
      map.setPaintProperty("route-glow", "line-width", PULSE[pulse].width);
      map.setPaintProperty("route-fill", "line-color", PULSE[pulse].fill);
    }
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

// Maps that currently show a route; the pulse skips redraws otherwise so an idle map saves battery.
const routeShown = new WeakSet<MLMap>();

function hasRoute(map: MLMap): boolean {
  return routeShown.has(map);
}

// The other ways to get there, drawn paler under the chosen route.
export function setAltLines(map: MLMap, routes: { line: LngLat[] }[], selected: number) {
  const source = map.getSource("route-alt") as maplibregl.GeoJSONSource | undefined;
  source?.setData({
    type: "FeatureCollection",
    features: routes
      .map((r, i) => ({ type: "Feature" as const, properties: { i }, geometry: { type: "LineString" as const, coordinates: r.line } }))
      .filter((_, i) => i !== selected),
  });
}

export function setRouteLine(map: MLMap, coordinates: LngLat[] | null) {
  const source = map.getSource("route") as maplibregl.GeoJSONSource | undefined;
  source?.setData(coordinates ? line(coordinates) : line([]));
  if (coordinates?.length) routeShown.add(map);
  else routeShown.delete(map);
}

function line(coordinates: LngLat[]): Feature<LineString> {
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } };
}

// ---- Satellite view: real imagery under the roads and names ----

const originals = new WeakMap<MLMap, Map<string, [string, unknown][]>>();

export function setSatellite(map: MLMap, on: boolean) {
  if (!map.getLayer("satellite")) return;
  const setPaint = (id: string, prop: string, value: unknown) =>
    (map.setPaintProperty as (id: string, prop: string, value: unknown) => void).call(map, id, prop, value);
  let saved = originals.get(map);
  if (!saved) {
    saved = new Map();
    originals.set(map, saved);
  }
  const store = saved;
  const keep = (id: string, props: string[]) => {
    if (!store.has(id)) store.set(id, props.map((p) => [p, (map.getPaintProperty as (id: string, p: string) => unknown).call(map, id, p)]));
  };
  const restore = (id: string) => {
    for (const [prop, value] of store.get(id) ?? []) setPaint(id, prop, value);
  };
  for (const layer of map.getStyle().layers) {
    const id = layer.id;
    if (id === "satellite" || id.startsWith("route-")) continue;
    if (layer.type === "fill" || layer.type === "fill-extrusion" || layer.type === "background" || layer.type === "raster") {
      map.setLayoutProperty(id, "visibility", on ? "none" : "visible");
    } else if (layer.type === "line" && /^(waterway|park_outline)/.test(id)) {
      map.setLayoutProperty(id, "visibility", on ? "none" : "visible");
    } else if (layer.type === "line" && /^(road|bridge|tunnel)_/.test(id) && !/rail|arrow/.test(id)) {
      keep(id, ["line-opacity"]);
      if (on) setPaint(id, "line-opacity", 0.55);
      else restore(id);
    } else if (layer.type === "symbol" && layer.layout && "text-field" in layer.layout) {
      keep(id, ["text-color", "text-halo-color"]);
      if (on) {
        setPaint(id, "text-color", "#ffffff");
        setPaint(id, "text-halo-color", "rgba(0,0,0,0.8)");
      } else restore(id);
    }
  }
  map.setLayoutProperty("satellite", "visibility", on ? "visible" : "none");
}
