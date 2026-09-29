import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MLMap } from "maplibre-gl";
import { PALETTE, retroStyle } from "./retroStyle";
import type { Feature, LineString } from "geojson";
import type { LngLat } from "../lib/geo";
import type { Theme } from "../lib/settings";
import workerUrl from "./maplibre-worker?worker&url";

maplibregl.setWorkerUrl(workerUrl);

// How many screen pixels each map pixel covers. 3 gives a clear chunky look
// while keeping streets readable.
export const CHUNK = 3;

const LABEL_LAYERS = new Set(["road-label", "water-label", "place-label"]);

export const CLASSIC_STYLE = "https://tiles.openfreemap.org/styles/liberty";
export const CLASSIC_BLUE = "#1a73e8";

export type MapView = { center: LngLat; zoom: number };

// Two looks share one hook:
//  - classic: a normal, clean street map with a blue route line, like any maps app;
//  - retro: two stacked maps that move together. The art map renders at 1/CHUNK resolution and is
//    scaled up without smoothing (chunky pixels); the label map draws only text, at full
//    sharpness, so names stay readable.
// Switching look rebuilds the map in the same place.
export function useAppMap(theme: Theme, start: MapView) {
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
        : CLASSIC_STYLE,
      center: view.current.center,
      zoom: view.current.zoom,
      ...(retro ? { pixelRatio: 1 / CHUNK } : {}),
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      maxPitch: 0,
    });
    art.touchZoomRotate.disableRotation();
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
      });
      const shadow = labels;
      art.on("move", () => shadow.jumpTo({ center: art.getCenter(), zoom: art.getZoom() }));
    }

    art.on("load", () => {
      art.addSource("route", { type: "geojson", data: line([]) });
      if (retro) {
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
        art.addLayer({
          id: "route-casing",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#0b4aa8", "line-width": ["+", width, 4] as unknown as number },
        });
        art.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": CLASSIC_BLUE, "line-width": width },
        });
      }
      setMap(art);
    });

    const stopPulse = retro ? animateRoute(art) : () => {};

    return () => {
      stopPulse();
      art.remove();
      labels?.remove();
      setMap(null);
    };
  }, [theme]);

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

export function setRouteLine(map: MLMap, coordinates: LngLat[] | null) {
  const source = map.getSource("route") as maplibregl.GeoJSONSource | undefined;
  source?.setData(coordinates ? line(coordinates) : line([]));
  if (coordinates?.length) routeShown.add(map);
  else routeShown.delete(map);
}

function line(coordinates: LngLat[]): Feature<LineString> {
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } };
}
