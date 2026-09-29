import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MLMap } from "maplibre-gl";
import { PALETTE, retroStyle } from "./retroStyle";
import type { Feature, LineString } from "geojson";
import type { LngLat } from "../lib/geo";
import workerUrl from "./maplibre-worker?worker&url";

maplibregl.setWorkerUrl(workerUrl);

// How many screen pixels each map pixel covers. 3 gives a clear chunky look
// while keeping streets readable.
export const CHUNK = 3;

const LABEL_LAYERS = new Set(["road-label", "water-label", "place-label"]);

// Two stacked maps that move together:
//  - the art map renders at 1/CHUNK resolution and is scaled up without smoothing,
//    which is what turns real streets into chunky pixels;
//  - the label map renders only text, at full sharpness, so names stay readable.
export function useRetroMap(start: { center: LngLat; zoom: number }) {
  const artHost = useRef<HTMLDivElement>(null);
  const labelHost = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MLMap | null>(null);

  useEffect(() => {
    if (!artHost.current || !labelHost.current) return;
    const style = retroStyle();

    const art = new maplibregl.Map({
      container: artHost.current,
      style: { ...style, layers: style.layers.filter((l) => !LABEL_LAYERS.has(l.id)) },
      center: start.center,
      zoom: start.zoom,
      pixelRatio: 1 / CHUNK,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      maxPitch: 0,
    });
    art.touchZoomRotate.disableRotation();

    const labels = new maplibregl.Map({
      container: labelHost.current,
      style: {
        ...style,
        layers: [
          { id: "clear", type: "background", paint: { "background-opacity": 0 } },
          ...style.layers.filter((l) => LABEL_LAYERS.has(l.id)),
        ],
      },
      center: start.center,
      zoom: start.zoom,
      interactive: false,
      attributionControl: false,
    });

    const sync = () => labels.jumpTo({ center: art.getCenter(), zoom: art.getZoom() });
    art.on("move", sync);

    art.on("load", () => {
      art.addSource("route", { type: "geojson", data: emptyLine() });
      art.addLayer({
        id: "route-edge",
        type: "line",
        source: "route",
        layout: { "line-join": "miter", "line-cap": "square" },
        paint: { "line-color": PALETTE.ink, "line-width": 11 },
      });
      art.addLayer({
        id: "route-fill",
        type: "line",
        source: "route",
        layout: { "line-join": "miter", "line-cap": "square" },
        paint: { "line-color": "#ff4d6d", "line-width": 7 },
      });
      art.addLayer({
        id: "route-dash",
        type: "line",
        source: "route",
        layout: { "line-join": "miter" },
        paint: { "line-color": "#fff6df", "line-width": 2, "line-dasharray": [2, 2] },
      });
      setMap(art);
    });

    return () => {
      art.remove();
      labels.remove();
      setMap(null);
    };
    // The map is created once; later center/zoom changes go through the map itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { artHost, labelHost, map };
}

export function emptyLine(): Feature<LineString> {
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } };
}
