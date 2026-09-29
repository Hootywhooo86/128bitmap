import * as maplibregl from "maplibre-gl";
import type { Map as MLMap, Marker } from "maplibre-gl";
import { onFrame } from "../pixel/anim";
import { buildingFrameUrl } from "../pixel/buildings";
import type { LngLat } from "../lib/geo";

export type MarkerPlace = { id: string; name: string; building: string; at: LngLat };

type Item = {
  marker: Marker;
  img: HTMLImageElement;
  label: HTMLSpanElement;
  building: string;
  name: string;
};

const PREVIEW = "__preview";

// Keeps one animated pixel building on the map for each saved place (plus a live preview
// while you're choosing one). Buildings shrink as you zoom out so a busy map stays readable.
export class PlaceMarkers {
  private items = new Map<string, Item>();
  private frame = 0;
  private scale = 3;
  private labels = true;
  private stopClock: () => void;
  private selectedId: string | null = null;
  private map: MLMap;
  private onSelect: (id: string) => void;

  constructor(map: MLMap, onSelect: (id: string) => void) {
    this.map = map;
    this.onSelect = onSelect;
    this.stopClock = onFrame((f) => {
      this.frame = f;
      this.paint();
    }, 3);
    map.on("zoom", this.onZoom);
    this.onZoom();
  }

  private onZoom = () => {
    const small = window.innerWidth < 760 || window.innerHeight < 520;
    const base = small ? 2 : 3;
    const z = this.map.getZoom();
    this.scale = z >= 14 ? base : z >= 11 ? Math.max(1, base - 1) : 1;
    this.labels = z >= 12.5;
    this.paint();
  };

  private paint() {
    for (const [id, item] of this.items) {
      item.img.src = buildingFrameUrl(item.building, this.frame);
      item.img.style.width = `${24 * this.scale}px`;
      item.img.style.height = `${24 * this.scale}px`;
      item.label.style.display = this.labels || id === PREVIEW ? "" : "none";
    }
  }

  private make(id: string, place: { name: string; building: string; at: LngLat }): Item {
    const el = document.createElement("div");
    el.className = `place-marker${id === PREVIEW ? " preview" : ""}`;
    const img = document.createElement("img");
    img.className = "sprite";
    img.alt = "";
    img.draggable = false;
    const label = document.createElement("span");
    label.className = "place-label";
    el.append(img, label);
    if (id !== PREVIEW) {
      el.setAttribute("role", "button");
      el.tabIndex = 0;
      const pick = (e: Event) => {
        e.stopPropagation();
        this.onSelect(id);
      };
      el.addEventListener("click", pick);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") pick(e);
      });
    }
    const marker = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat(place.at).addTo(this.map);
    return { marker, img, label, building: place.building, name: place.name };
  }

  sync(places: MarkerPlace[]) {
    const keep = new Set(places.map((p) => p.id));
    for (const [id, item] of this.items) {
      if (id !== PREVIEW && !keep.has(id)) {
        item.marker.remove();
        this.items.delete(id);
      }
    }
    for (const place of places) this.upsert(place.id, place);
    this.select(this.selectedId);
    this.paint();
  }

  private upsert(id: string, place: { name: string; building: string; at: LngLat }) {
    let item = this.items.get(id);
    if (!item) {
      item = this.make(id, place);
      this.items.set(id, item);
    }
    item.building = place.building;
    item.name = place.name;
    item.label.textContent = place.name;
    item.marker.setLngLat(place.at);
    item.marker.getElement().setAttribute("aria-label", place.name);
  }

  setPreview(place: { name: string; building: string; at: LngLat } | null) {
    if (!place) {
      const item = this.items.get(PREVIEW);
      item?.marker.remove();
      this.items.delete(PREVIEW);
      return;
    }
    this.upsert(PREVIEW, { ...place, name: place.name || "New place" });
    this.paint();
  }

  select(id: string | null) {
    this.selectedId = id;
    for (const [key, item] of this.items) item.marker.getElement().classList.toggle("selected", key === id);
  }

  destroy() {
    this.stopClock();
    this.map.off("zoom", this.onZoom);
    for (const item of this.items.values()) item.marker.remove();
    this.items.clear();
  }
}
