#!/usr/bin/env python3
"""Builds the classic map style from OpenFreeMap's Liberty style.

It restyles it (more places shown much earlier, brighter colours, clearer roads, 3D buildings),
adds a satellite layer, and saves the map icons and the common Latin glyph ranges into public/map
so the map doesn't have to fetch them from the internet on every launch.

Run:  python3 scripts/make-classic-style.py
"""
import json
import os
import subprocess

ROOT = os.path.join(os.path.dirname(__file__), "..")
OFM = "https://tiles.openfreemap.org"


def get(url: str) -> bytes:
    return subprocess.run(["curl", "-sfL", "--max-time", "60", url], check=True, capture_output=True).stdout


style = json.loads(get(f"{OFM}/styles/liberty"))
layers = {l["id"]: l for l in style["layers"]}


def paint(layer_id: str, **props):
    layers[layer_id].setdefault("paint", {}).update(props)


# ---- land, water, parks ----
paint("background", **{"background-color": "#f4f1ea"})
paint("park", **{"fill-color": "#c8e8b2", "fill-outline-color": "#b3d99b"})
paint("park_outline", **{"line-color": "#b3d99b"})
paint("landcover_wood", **{"fill-color": "hsla(100,55%,68%,0.75)"})
paint("landcover_grass", **{"fill-color": "#d2eabd"})
paint("landuse_residential", **{"fill-color": "#ece8df"})
paint("landuse_hospital", **{"fill-color": "#f8dcdc"})
paint("landuse_school", **{"fill-color": "#f1ecd0"})
paint("landuse_cemetery", **{"fill-color": "#cfe3c3"})
paint("landuse_pitch", **{"fill-color": "#bfe3b2"})
paint("landuse_track", **{"fill-color": "#bfe3b2"})
paint("landcover_sand", **{"fill-color": "#f6ebc3"})
paint("aeroway_fill", **{"fill-color": "#e3e0da"})
paint("water", **{"fill-color": "#9ccbf8"})
for wid in ("waterway_river", "waterway_other", "waterway_tunnel"):
    paint(wid, **{"line-color": "#9ccbf8"})

# ---- roads: clear hierarchy, yellow and orange highways, white streets ----
ROADS = [
    ("motorway", "#f8c35f", "#dc9524"),
    ("trunk_primary", "#fbd98f", "#e0ab45"),
    ("secondary_tertiary", "#fff2c8", "#e2c173"),
    ("link", "#fff2c8", "#e2c173"),
    ("minor", "#ffffff", "#d9d5cc"),
    ("street", "#ffffff", "#d9d5cc"),
    ("service_track", "#ffffff", "#d9d5cc"),
]
for lid, layer in layers.items():
    if layer["type"] != "line" or not lid.startswith(("road_", "bridge_", "tunnel_")):
        continue
    if "rail" in lid or "pedestrian" in lid or "arrow" in lid or "area" in lid:
        continue
    casing = lid.endswith("_casing")
    for key, fill, edge in ROADS:
        if key in lid:
            if lid.startswith("tunnel_") and not casing:
                fill = "#f3efe6"
            layer.setdefault("paint", {})["line-color"] = edge if casing else fill
            break

# ---- buildings: footprints early, 3D up close ----
paint("building", **{
    "fill-color": "#e6e0d3",
    "fill-outline-color": ["interpolate", ["linear"], ["zoom"], 13, "hsla(35,10%,74%,0.3)", 15, "#d3ccbd"],
})
layers["building"]["minzoom"] = 13
b3d = layers["building-3d"]
b3d["minzoom"] = 15.2
b3d["paint"] = {
    "fill-extrusion-color": ["interpolate", ["linear"], ["get", "render_height"], 0, "#ede7dc", 60, "#dad3c6", 200, "#c9c2b5"],
    "fill-extrusion-height": ["get", "render_height"],
    "fill-extrusion-base": ["get", "render_min_height"],
    "fill-extrusion-opacity": 0.92,
    "fill-extrusion-vertical-gradient": True,
}

# ---- places appear much earlier, coloured by kind ----
layers["poi_r1"]["minzoom"] = 12.4
layers["poi_r7"]["minzoom"] = 13.6
layers["poi_r20"]["minzoom"] = 14.8
layers["poi_transit"]["minzoom"] = 12.0
layers["highway-name-major"]["minzoom"] = 11.6
layers["highway-name-minor"]["minzoom"] = 14.4

GROUPS = {
    "#c4601a": "restaurant fast_food cafe bar pub bakery ice_cream beer food_court biergarten",
    "#3a70c8": "shop grocery clothing_store convenience department_store mall furniture florist jewelry bank post atm",
    "#2f7d3a": "park garden playground zoo campsite pitch stadium golf swimming dog_park natural",
    "#c2413a": "hospital doctors pharmacy dentist clinic veterinary",
    "#7a4fb0": "school college university library museum theatre cinema art_gallery place_of_worship",
    "#1f6fb8": "bus rail railway airport harbor ferry_terminal subway tram",
}
match = ["match", ["get", "class"]]
for color, names in GROUPS.items():
    match += [names.split(), color]
match.append("#5b6068")
for lid in ("poi_r1", "poi_r7", "poi_r20", "poi_transit"):
    lay = layers[lid]
    lay["layout"]["text-font"] = ["Noto Sans Regular"]
    lay["layout"]["text-size"] = 12
    lay["layout"]["icon-size"] = 1.05
    lay["paint"].update({"text-color": match, "text-halo-color": "rgba(255,255,255,0.95)", "text-halo-width": 1.6, "text-halo-blur": 0.3})

# ---- labels: dark text, clean white halo ----
for lid, layer in layers.items():
    if layer["type"] != "symbol" or "text-field" not in layer.get("layout", {}) or lid.startswith("poi_"):
        continue
    p = layer.setdefault("paint", {})
    p["text-halo-color"] = "rgba(255,255,255,0.95)"
    p["text-halo-width"] = 1.6
    if lid.startswith(("water_", "waterway")):
        p["text-color"] = "#3b78c4"
    elif lid.startswith("highway-name"):
        p["text-color"] = "#4a4f57"
    else:
        p["text-color"] = "#2b2f36"

# ---- house numbers on buildings when zoomed in close ----
style["layers"].append({
    "id": "housenumber",
    "type": "symbol",
    "source": "openmaptiles",
    "source-layer": "housenumber",
    "minzoom": 16.6,
    "layout": {
        "text-field": ["get", "housenumber"],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 16.6, 10, 19, 13],
        "text-padding": 2,
    },
    "paint": {"text-color": "#6b6f76", "text-halo-color": "rgba(255,255,255,0.9)", "text-halo-width": 1.2},
})

# ---- satellite, hidden until asked for ----
style["sources"]["satellite"] = {
    "type": "raster",
    "tiles": ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
    "tileSize": 256,
    "maxzoom": 19,
    "attribution": "Imagery © Esri, Maxar, Earthstar Geographics",
}
order = [l["id"] for l in style["layers"]]
sat = {"id": "satellite", "type": "raster", "source": "satellite", "layout": {"visibility": "none"}}
style["layers"].insert(order.index("background") + 1, sat)

# Filled in at run time with a path that works on a website and inside the phone apps.
style["sprite"] = "SPRITE_URL"
style["name"] = "128BITMAPS classic"
style.pop("metadata", None)

out = os.path.join(ROOT, "src/map/classicStyle.json")
with open(out, "w") as f:
    json.dump(style, f, separators=(",", ":"))
print("style", os.path.getsize(out) // 1024, "KB,", len(style["layers"]), "layers")


# ---- a dark version for night driving ----
import colorsys
import copy
import re


def parse_color(text):
    t = text.strip().lower()
    m = re.fullmatch(r"#([0-9a-f]{3}|[0-9a-f]{6})", t)
    if m:
        h = m.group(1)
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        r, g, b = (int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))
        hh, ll, ss = colorsys.rgb_to_hls(r, g, b)
        return hh * 360, ss, ll, 1.0
    m = re.fullmatch(r"hsla?\(([^)]*)\)", t)
    if m:
        parts = [x.strip().rstrip("%") for x in m.group(1).split(",")]
        a = float(parts[3]) if len(parts) > 3 else 1.0
        return float(parts[0]), float(parts[1]) / 100, float(parts[2]) / 100, a
    m = re.fullmatch(r"rgba?\(([^)]*)\)", t)
    if m:
        parts = [x.strip() for x in m.group(1).split(",")]
        r, g, b = (float(x) / 255 for x in parts[:3])
        a = float(parts[3]) if len(parts) > 3 else 1.0
        hh, ll, ss = colorsys.rgb_to_hls(r, g, b)
        return hh * 360, ss, ll, a
    return None


def fmt(h, s, l, a):
    s = max(0, min(1, s))
    l = max(0, min(1, l))
    if a < 1:
        return f"hsla({h:.0f},{s*100:.0f}%,{l*100:.1f}%,{a:.2f})"
    return f"hsl({h:.0f},{s*100:.0f}%,{l*100:.1f}%)"


def darken(lid, ltype, prop, color):
    h, s, l, a = color
    warm = 20 <= h <= 60 and s > 0.45
    green = 70 <= h <= 160 and s > 0.15
    if prop in ("text-color", "icon-color"):
        return fmt(h, s * 0.55, 0.93 - 0.38 * l, a)
    if prop == "text-halo-color":
        return fmt(205, 0.25, 0.08 + 0.06 * l, a)
    if lid.startswith(("water", "waterway")):
        return fmt(214, 0.5, 0.11 if ltype != "line" else 0.16, a)
    if "building" in lid:
        return fmt(205, 0.12, 0.2 + 0.08 * l, a)
    if ltype == "line" and re.match(r"(road|bridge|tunnel)_", lid) and "rail" not in lid:
        if lid.endswith("_casing"):
            return fmt(210, 0.2, 0.05 + 0.07 * l, a)
        if warm:
            return fmt(h, s * 0.85, 0.28 + 0.28 * l, a)
        return fmt(210, 0.08, 0.2 + 0.2 * l, a)
    if green:
        return fmt(150, s * 0.45, 0.13 + 0.05 * l, a)
    if ltype == "line":
        return fmt(205, s * 0.3, 0.3 + 0.2 * l, a)
    # land, landuse and everything else that is a flat colour
    return fmt(205, 0.2 if s < 0.35 else s * 0.4, 0.09 + 0.1 * l, a)


def walk(value, lid, ltype, prop):
    if isinstance(value, str):
        c = parse_color(value)
        return darken(lid, ltype, prop, c) if c else value
    if isinstance(value, list):
        return [walk(v, lid, ltype, prop) for v in value]
    return value


night = copy.deepcopy(style)
night["layers"] = [l for l in night["layers"] if l["id"] not in ("natural_earth",)]
for layer in night["layers"]:
    if layer["type"] == "raster":
        continue
    for group in ("paint",):
        for prop, value in list(layer.get(group, {}).items()):
            if prop.endswith("color"):
                layer[group][prop] = walk(value, layer["id"], layer["type"], prop)
    if layer["type"] == "fill-extrusion":
        layer["paint"]["fill-extrusion-opacity"] = 0.95
night["name"] = "128BITMAPS night"
out_dark = os.path.join(ROOT, "src/map/classicDarkStyle.json")
with open(out_dark, "w") as f:
    json.dump(night, f, separators=(",", ":"))
print("dark style", os.path.getsize(out_dark) // 1024, "KB")

# ---- bundle the icons and the common glyph ranges ----
for name in ("ofm.json", "ofm.png", "ofm@2x.json", "ofm@2x.png"):
    with open(os.path.join(ROOT, "public/map/sprite", name), "wb") as f:
        f.write(get(f"{OFM}/sprites/ofm_f384/{name}"))
total = 0
for font in ("Noto Sans Regular", "Noto Sans Bold", "Noto Sans Italic"):
    folder = os.path.join(ROOT, "public/map/fonts", font.replace(" ", "-"))
    os.makedirs(folder, exist_ok=True)
    for rng in ("0-255", "256-511", "8192-8447"):
        data = get(f"{OFM}/fonts/{font.replace(' ', '%20')}/{rng}.pbf")
        total += len(data)
        with open(os.path.join(folder, f"{rng}.pbf"), "wb") as f:
            f.write(data)
print("fonts", total // 1024, "KB")
