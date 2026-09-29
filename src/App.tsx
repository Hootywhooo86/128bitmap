import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { Marker } from "maplibre-gl";
import { PlaceInput } from "./components/PlaceInput";
import {
  formatDistance,
  formatDuration,
  getRoute,
  reverseLookup,
  type LngLat,
  type Place,
  type Route,
} from "./lib/geo";
import { setRouteLine, useRetroMap } from "./map/useRetroMap";
import { DROP_PIN, GOAL_FLAG, START_FLAG, YOU_DOT, spriteToDataUrl, type Sprite } from "./pixel/sprites";

const TRIP_KEY = "128bitmaps.trip";
const DEFAULT_VIEW = { center: [-113.4938, 53.5461] as LngLat, zoom: 11 };

type Trip = { from: Place | null; to: Place | null };

function loadTrip(): Trip {
  try {
    const saved = JSON.parse(localStorage.getItem(TRIP_KEY) ?? "null") as Trip | null;
    if (saved && typeof saved === "object") return { from: saved.from ?? null, to: saved.to ?? null };
  } catch {
    // Ignore a broken save and start fresh.
  }
  return { from: null, to: null };
}

function spriteMarker(sprite: Sprite, anchor: "bottom-left" | "bottom" | "center") {
  const img = document.createElement("img");
  img.src = spriteToDataUrl(sprite, 1);
  img.className = "sprite-marker";
  img.style.width = `${sprite.grid[0].length * 3}px`;
  return new maplibregl.Marker({ element: img, anchor, offset: anchor === "bottom-left" ? [-6, 0] : [0, 0] });
}

// Keep the route clear of the trip panel, whether it sits across the top (phone upright)
// or down the left side (laptop, or phone held sideways).
function routePadding(panel: HTMLElement | null) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const box = panel?.getBoundingClientRect();
  const side = box !== undefined && box.width < w * 0.6;
  const pad = side
    ? { top: 40, bottom: 40, left: box.right + 30, right: 70 }
    : { top: (box?.bottom ?? 0) + 30, bottom: 70, left: 40, right: 70 };
  // Never pad more than the map can hold, or it can't fit the route at all.
  pad.left = Math.min(pad.left, w - pad.right - 60);
  pad.top = Math.min(pad.top, h - pad.bottom - 60);
  return pad;
}

export default function App() {
  const [trip, setTrip] = useState<Trip>(loadTrip);
  const [firstView] = useState(() => (trip.from ? { center: trip.from.at, zoom: 13 } : DEFAULT_VIEW));
  const { artHost, labelHost, map } = useRetroMap(firstView);
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [dropped, setDropped] = useState<Place | null>(null);
  const [you, setYou] = useState<LngLat | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const markers = useRef<{ from?: Marker; to?: Marker; you?: Marker; drop?: Marker }>({});

  const icons = useMemo(
    () => ({ start: spriteToDataUrl(START_FLAG, 2), goal: spriteToDataUrl(GOAL_FLAG, 2) }),
    [],
  );

  const near = useCallback((): LngLat | null => {
    if (!map) return null;
    const c = map.getCenter();
    return [c.lng, c.lat];
  }, [map]);

  useEffect(() => {
    try {
      localStorage.setItem(TRIP_KEY, JSON.stringify(trip));
    } catch {
      // Private mode: the trip just won't be remembered.
    }
  }, [trip]);

  // Keep the flag markers in step with the chosen places.
  useEffect(() => {
    if (!map) return;
    for (const key of ["from", "to"] as const) {
      markers.current[key]?.remove();
      markers.current[key] = undefined;
      const place = trip[key];
      if (place) {
        markers.current[key] = spriteMarker(key === "from" ? START_FLAG : GOAL_FLAG, "bottom-left")
          .setLngLat(place.at)
          .addTo(map);
      }
    }
  }, [map, trip]);

  // Fetch a road route whenever both ends are set.
  useEffect(() => {
    if (!map) return;
    const { from, to } = trip;
    if (!from || !to) {
      setRoute(null);
      setError(null);
      setRouteLine(map, null);
      if (from || to) map.flyTo({ center: (from ?? to)!.at, zoom: Math.max(map.getZoom(), 13) });
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    getRoute(from.at, to.at, ctrl.signal)
      .then((next) => {
        setRoute(next);
        setRouteLine(map, next.line);
        const bounds = next.line.reduce(
          (b, p) => b.extend(p),
          new maplibregl.LngLatBounds(next.line[0], next.line[0]),
        );
        map.fitBounds(bounds, { padding: routePadding(panelRef.current), maxZoom: 16 });
      })
      .catch((err: Error) => {
        if (ctrl.signal.aborted) return;
        setRoute(null);
        setRouteLine(map, null);
        setError(err.message || "Couldn't find a route.");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [map, trip]);

  // Tap the map to drop a pin you can go from or to.
  useEffect(() => {
    if (!map) return;
    const onClick = async (e: maplibregl.MapMouseEvent) => {
      const at: LngLat = [e.lngLat.lng, e.lngLat.lat];
      markers.current.drop?.remove();
      markers.current.drop = spriteMarker(DROP_PIN, "bottom").setLngLat(at).addTo(map);
      setDropped({ label: "Dropped pin", detail: "Looking up…", at });
      setDropped(await reverseLookup(at));
    };
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [map]);

  useEffect(() => {
    if (!dropped) {
      markers.current.drop?.remove();
      markers.current.drop = undefined;
    }
  }, [dropped]);

  const locate = useCallback(
    (then?: (place: Place) => void) => {
      if (!navigator.geolocation) {
        setError("This device can't share its location.");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const at: LngLat = [pos.coords.longitude, pos.coords.latitude];
          setYou(at);
          map?.flyTo({ center: at, zoom: 15 });
          if (then) {
            const place = await reverseLookup(at);
            then({ ...place, label: "My location", detail: place.label });
          }
        },
        () => setError("Location is blocked. Allow it in your browser settings."),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    },
    [map],
  );

  useEffect(() => {
    if (!map) return;
    markers.current.you?.remove();
    if (you) markers.current.you = spriteMarker(YOU_DOT, "center").setLngLat(you).addTo(map);
  }, [map, you]);

  const setEnd = (key: keyof Trip) => (place: Place | null) => setTrip((t) => ({ ...t, [key]: place }));

  return (
    <div className="app">
      <div className="map-stack">
        <div ref={artHost} className="map art-map" />
        <div ref={labelHost} className="map label-map" aria-hidden />
      </div>

      <section ref={panelRef} className="panel trip-panel">
        <header className="brand">
          <span className="logo">128BITMAPS</span>
          {!map && <span className="loading-text">LOADING…</span>}
        </header>
        <div className="ends">
          <PlaceInput
            icon={icons.start}
            placeholder="From where?"
            value={trip.from}
            near={near}
            onPick={setEnd("from")}
            onClear={() => setEnd("from")(null)}
            onUseLocation={() => locate(setEnd("from"))}
          />
          <PlaceInput
            icon={icons.goal}
            placeholder="To where?"
            value={trip.to}
            near={near}
            onPick={setEnd("to")}
            onClear={() => setEnd("to")(null)}
            onUseLocation={() => locate(setEnd("to"))}
          />
          <button
            className="swap"
            aria-label="Swap from and to"
            title="Swap"
            onClick={() => setTrip((t) => ({ from: t.to, to: t.from }))}
          >
            ⇅
          </button>
        </div>

        {loading && <p className="status blink">FINDING ROUTE…</p>}
        {error && <p className="status error">{error}</p>}

        {route && !loading && (
          <div className="summary">
            <div>
              <span className="big">{formatDuration(route.duration)}</span>
              <span className="dim"> · {formatDistance(route.distance)}</span>
            </div>
            <button className="pixel-btn" onClick={() => setShowSteps((s) => !s)}>
              {showSteps ? "HIDE" : "STEPS"}
            </button>
          </div>
        )}

        {route && showSteps && !loading && (
          <ol className="steps">
            {route.steps.map((step, i) => (
              <li key={i}>
                <button onClick={() => map?.flyTo({ center: step.at, zoom: 17 })}>
                  <span className="arrow">{step.icon}</span>
                  <span className="step-text">{step.text}</span>
                  {step.distance > 0 && <span className="dim">{formatDistance(step.distance)}</span>}
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      {dropped && (
        <section className="panel drop-panel">
          <div className="drop-info">
            <span className="hit-label">{dropped.label}</span>
            <span className="hit-detail">{dropped.detail}</span>
          </div>
          <div className="drop-actions">
            <button
              className="pixel-btn go-from"
              onClick={() => {
                setEnd("from")(dropped);
                setDropped(null);
              }}
            >
              FROM HERE
            </button>
            <button
              className="pixel-btn go-to"
              onClick={() => {
                setEnd("to")(dropped);
                setDropped(null);
              }}
            >
              TO HERE
            </button>
            <button className="pixel-btn ghost" aria-label="Close" onClick={() => setDropped(null)}>
              ×
            </button>
          </div>
        </section>
      )}

      <div className="map-controls">
        <button className="pixel-btn" aria-label="Zoom in" onClick={() => map?.zoomIn()}>
          +
        </button>
        <button className="pixel-btn" aria-label="Zoom out" onClick={() => map?.zoomOut()}>
          −
        </button>
        <button className="pixel-btn" aria-label="Find me" onClick={() => locate()}>
          ◎
        </button>
      </div>

      <footer className="credits">
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> ·{" "}
        <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> · Photon · OSRM
      </footer>
    </div>
  );
}
