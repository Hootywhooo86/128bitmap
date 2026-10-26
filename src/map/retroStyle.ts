import type { StyleSpecification } from "maplibre-gl";

// A small, bright palette in the spirit of 16/32/128-bit era overworld maps.
// Everything on the map is drawn from these colors so it reads as one piece of art.
export const PALETTE = {
  grass: "#8fd35f",
  meadow: "#a6e07a",
  town: "#c9e39a",
  forest: "#4f9e3f",
  park: "#6cc04a",
  sand: "#f2d98b",
  ice: "#e8f4ff",
  water: "#3b7de0",
  waterEdge: "#2a5fb8",
  river: "#4f8ff0",
  ink: "#232042",
  road: "#fff6df",
  major: "#ffd23f",
  highway: "#ff8c3a",
  rail: "#5b5680",
  building: "#e0916a",
  buildingEdge: "#9e5a45",
  runway: "#b8b3cf",
  label: "#232042",
  labelHalo: "#fff6df",
  border: "#7a4fd0",
} as const;

const FONT = ["Noto Sans Bold"];

const byZoom = (stops: [number, number][]) =>
  ["interpolate", ["exponential", 1.5], ["zoom"], ...stops.flat()] as unknown as number;

const roadClasses = {
  minor: ["minor", "service", "track"],
  major: ["secondary", "tertiary", "primary", "trunk"],
  highway: ["motorway"],
};

function roadPair(
  id: string,
  classes: string[],
  fill: string,
  widths: [number, number][],
  minzoom: number,
) {
  const filter = [
    "all",
    ["match", ["get", "class"], classes, true, false],
    ["!=", ["get", "brunnel"], "tunnel"],
  ];
  return [
    {
      id: `${id}-edge`,
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      minzoom,
      filter,
      layout: { "line-cap": "square", "line-join": "miter" },
      paint: {
        "line-color": PALETTE.ink,
        "line-width": byZoom(widths.map(([z, w]) => [z, w + 2.5])),
      },
    },
    {
      id,
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      minzoom,
      filter,
      layout: { "line-cap": "square", "line-join": "miter" },
      paint: { "line-color": fill, "line-width": byZoom(widths) },
    },
  ];
}

export function retroStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      omt: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
    },
    layers: [
      { id: "land", type: "background", paint: { "background-color": PALETTE.grass, "background-pattern": "tex-grass" } },
      {
        id: "landuse-town",
        type: "fill",
        source: "omt",
        "source-layer": "landuse",
        filter: ["match", ["get", "class"], ["residential", "suburb", "neighbourhood", "commercial", "retail", "industrial"], true, false],
        paint: { "fill-color": PALETTE.town },
      },
      {
        id: "landcover-forest",
        type: "fill",
        source: "omt",
        "source-layer": "landcover",
        filter: ["==", ["get", "class"], "wood"],
        paint: { "fill-pattern": "tex-forest" },
      },
      {
        id: "landcover-grass",
        type: "fill",
        source: "omt",
        "source-layer": "landcover",
        filter: ["match", ["get", "class"], ["grass", "farmland", "wetland"], true, false],
        paint: { "fill-pattern": "tex-meadow" },
      },
      {
        id: "landcover-sand",
        type: "fill",
        source: "omt",
        "source-layer": "landcover",
        filter: ["==", ["get", "class"], "sand"],
        paint: { "fill-color": PALETTE.sand },
      },
      {
        id: "landcover-ice",
        type: "fill",
        source: "omt",
        "source-layer": "landcover",
        filter: ["==", ["get", "class"], "ice"],
        paint: { "fill-color": PALETTE.ice },
      },
      {
        id: "park",
        type: "fill",
        source: "omt",
        "source-layer": "park",
        paint: { "fill-pattern": "tex-park", "fill-outline-color": PALETTE.forest },
      },
      {
        id: "water-edge",
        type: "line",
        source: "omt",
        "source-layer": "water",
        paint: { "line-color": PALETTE.waterEdge, "line-width": 3 },
      },
      {
        id: "water",
        type: "fill",
        source: "omt",
        "source-layer": "water",
        filter: ["!=", ["get", "brunnel"], "tunnel"],
        paint: { "fill-pattern": "tex-water" },
      },
      {
        id: "river",
        type: "line",
        source: "omt",
        "source-layer": "waterway",
        filter: ["!=", ["get", "brunnel"], "tunnel"],
        paint: { "line-color": PALETTE.river, "line-width": byZoom([[8, 1], [14, 3], [18, 10]]) },
      },
      {
        id: "runway",
        type: "line",
        source: "omt",
        "source-layer": "aeroway",
        minzoom: 11,
        filter: ["match", ["get", "class"], ["runway", "taxiway"], true, false],
        paint: { "line-color": PALETTE.runway, "line-width": byZoom([[11, 2], [16, 24]]) },
      },
      {
        // A soft drop shadow so buildings stand off the ground.
        id: "building-shadow",
        type: "fill",
        source: "omt",
        "source-layer": "building",
        minzoom: 15,
        paint: { "fill-color": "#1f3a1f", "fill-opacity": 0.28, "fill-translate": [3, 3] },
      },
      {
        id: "building",
        type: "fill",
        source: "omt",
        "source-layer": "building",
        minzoom: 14,
        paint: { "fill-color": PALETTE.building, "fill-outline-color": PALETTE.buildingEdge },
      },
      {
        id: "building-3d",
        type: "fill-extrusion",
        source: "omt",
        "source-layer": "building",
        minzoom: 15,
        // Only shown while navigating, so the flat pixel buildings keep their outlines when browsing.
        layout: { visibility: "none" },
        paint: {
          "fill-extrusion-color": PALETTE.building,
          "fill-extrusion-height": ["max", 4, ["coalesce", ["get", "render_height"], 6]],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 1,
          "fill-extrusion-vertical-gradient": false,
        },
      },
      {
        id: "rail",
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        minzoom: 12,
        filter: ["match", ["get", "class"], ["rail", "transit"], true, false],
        paint: {
          "line-color": PALETTE.rail,
          "line-width": 2,
          "line-dasharray": [2, 2],
        },
      },
      ...roadPair("road-minor", roadClasses.minor, PALETTE.road, [[13, 1], [16, 6], [19, 22]], 13),
      ...roadPair("road-major", roadClasses.major, PALETTE.major, [[8, 1], [13, 3], [16, 10], [19, 30]], 8),
      ...roadPair("road-highway", roadClasses.highway, PALETTE.highway, [[5, 1], [10, 3], [14, 7], [19, 36]], 5),
      {
        id: "border",
        type: "line",
        source: "omt",
        "source-layer": "boundary",
        filter: ["all", ["<=", ["coalesce", ["get", "admin_level"], 99], 4], ["!=", ["coalesce", ["get", "maritime"], 0], 1]],
        paint: { "line-color": PALETTE.border, "line-width": 2, "line-dasharray": [3, 2] },
      },
      {
        id: "road-label",
        type: "symbol",
        source: "omt",
        "source-layer": "transportation_name",
        minzoom: 14,
        layout: {
          "symbol-placement": "line",
          "text-field": ["get", "name"],
          "text-font": FONT,
          "text-size": 13,
          "text-letter-spacing": 0.05,
        },
        paint: {
          "text-color": PALETTE.label,
          "text-halo-color": PALETTE.labelHalo,
          "text-halo-width": 2,
        },
      },
      {
        id: "water-label",
        type: "symbol",
        source: "omt",
        "source-layer": "water_name",
        layout: {
          "text-field": ["get", "name"],
          "text-font": FONT,
          "text-size": 13,
        },
        paint: { "text-color": PALETTE.ice, "text-halo-color": PALETTE.waterEdge, "text-halo-width": 2 },
      },
      {
        id: "place-label",
        type: "symbol",
        source: "omt",
        "source-layer": "place",
        filter: ["match", ["get", "class"], ["city", "town", "village", "suburb", "neighbourhood", "state", "country"], true, false],
        layout: {
          "text-field": ["upcase", ["get", "name"]],
          "text-font": FONT,
          "text-size": [
            "match",
            ["get", "class"],
            "country", 18,
            "state", 15,
            "city", 18,
            "town", 15,
            13,
          ],
          "text-letter-spacing": 0.1,
          "text-max-width": 8,
        },
        paint: {
          "text-color": PALETTE.label,
          "text-halo-color": PALETTE.labelHalo,
          "text-halo-width": 2.5,
        },
      },
    ],
  } as StyleSpecification;
}
