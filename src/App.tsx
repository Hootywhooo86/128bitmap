import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { Marker } from "maplibre-gl";
import { PlaceInput } from "./components/PlaceInput";
import { MenuSheet, PlaceEditor, type Draft, type MenuTab } from "./components/Sheets";
import { SpriteImg } from "./components/SpriteImg";
import {
  formatDistance,
  formatDuration,
  getRoute,
  reverseLookup,
  type LngLat,
  type Place,
  type Route,
} from "./lib/geo";
import { currentPosition, onBackButton, saveBackupFile } from "./lib/platform";
import {
  loadCar,
  loadPlaces,
  makeBackup,
  mergePlaces,
  newId,
  readBackup,
  samePlace,
  saveCar,
  savePlaces,
  savedToPlace,
  type SavedPlace,
} from "./lib/store";
import { Driver } from "./map/drive";
import { PlaceMarkers } from "./map/placeMarkers";
import { setRouteLine, useRetroMap } from "./map/useRetroMap";
import { getBuilding, suggestBuilding } from "./pixel/buildings";
import { DROP_PIN, GOAL_FLAG, START_FLAG, YOU_DOT, spriteToDataUrl, type Sprite } from "./pixel/sprites";

const TRIP_KEY = "128bitmaps.trip";
const DEFAULT_VIEW = { center: [-113.4938, 53.5461] as LngLat, zoom: 11 };

type Trip = { from: Place | null; to: Place | null };
type Sheet = { kind: "menu"; tab: MenuTab } | { kind: "editor"; draft: Draft } | null;
type Card = { kind: "pin"; place: Place } | { kind: "saved"; id: string } | null;
type DriveState = { status: "idle" | "driving" | "arrived"; progress: number; left: number };

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

// Where the sheet sits (mirrors the CSS), so a place being edited is panned into the part of
// the map you can still see: above a bottom sheet, beside a side column.
function sheetOffset(): [number, number] {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (h <= 520 && w > h) return [Math.min(430, w * 0.56) / 2, 0];
  if (w < 760) return [0, -Math.min(h * 0.52, 460) / 2];
  return [-206, 0];
}

const today = () => new Date().toISOString().slice(0, 10);

export default function App() {
  const [trip, setTrip] = useState<Trip>(loadTrip);
  const [places, setPlaces] = useState<SavedPlace[]>(loadPlaces);
  const [car, setCar] = useState<string>(loadCar);
  const [firstView] = useState(() => {
    const at = trip.from?.at ?? places[0]?.at;
    return at ? { center: at, zoom: 13 } : DEFAULT_VIEW;
  });
  const { artHost, labelHost, map } = useRetroMap(firstView);
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [card, setCard] = useState<Card>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [drive, setDrive] = useState<DriveState>({ status: "idle", progress: 0, left: 0 });
  const [you, setYou] = useState<LngLat | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const markers = useRef<{ from?: Marker; to?: Marker; you?: Marker; drop?: Marker }>({});
  const placeMarkers = useRef<PlaceMarkers | null>(null);
  const driver = useRef<Driver | null>(null);
  const lookup = useRef(0);
  const live = useRef({ sheet, drive, card });
  useEffect(() => {
    live.current = { sheet, drive, card };
  });

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

  useEffect(() => savePlaces(places), [places]);
  useEffect(() => saveCar(car), [car]);

  const openSaved = useCallback(
    (id: string) => {
      setSheet(null);
      setCard({ kind: "saved", id });
    },
    [],
  );

  // Saved places live on the map as animated pixel buildings.
  useEffect(() => {
    if (!map) return;
    const layer = new PlaceMarkers(map, (id) => openSaved(id));
    placeMarkers.current = layer;
    layer.sync(places);
    return () => {
      layer.destroy();
      placeMarkers.current = null;
    };
    // The layer is created once per map; places are pushed in by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, openSaved]);

  useEffect(() => {
    placeMarkers.current?.sync(places);
  }, [places, map]);

  useEffect(() => {
    placeMarkers.current?.select(card?.kind === "saved" ? card.id : null);
  }, [card, map]);

  // While you pick a building, the map shows it live where the place will go.
  const draft = sheet?.kind === "editor" ? sheet.draft : null;
  useEffect(() => {
    placeMarkers.current?.setPreview(draft ? { name: draft.name, building: draft.building, at: draft.at } : null);
  }, [draft, map]);

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

  // The car that drives your route.
  useEffect(() => {
    if (!map) return;
    const d = new Driver(map, {
      onProgress: (progress, left) => setDrive({ status: "driving", progress, left }),
      onArrive: () => setDrive({ status: "arrived", progress: 1, left: 0 }),
    });
    driver.current = d;
    return () => {
      d.stop();
      driver.current = null;
    };
  }, [map]);

  // Fetch a road route whenever both ends are set.
  useEffect(() => {
    if (!map) return;
    driver.current?.stop();
    setDrive({ status: "idle", progress: 0, left: 0 });
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

  const closePin = useCallback(() => {
    lookup.current++;
    markers.current.drop?.remove();
    markers.current.drop = undefined;
  }, []);

  // Tap the map: drop a pin, or (while editing) move the place, or (menu open) just close the menu.
  useEffect(() => {
    if (!map) return;
    const onClick = async (e: maplibregl.MapMouseEvent) => {
      const at: LngLat = [e.lngLat.lng, e.lngLat.lat];
      const { sheet: open, drive: driving } = live.current;
      if (driving.status === "driving") return;
      if (open?.kind === "editor") {
        setSheet({ kind: "editor", draft: { ...open.draft, at } });
        return;
      }
      if (open?.kind === "menu") {
        setSheet(null);
        return;
      }
      const token = ++lookup.current;
      markers.current.drop?.remove();
      markers.current.drop = spriteMarker(DROP_PIN, "bottom").setLngLat(at).addTo(map);
      setCard({ kind: "pin", place: { label: "Dropped pin", detail: "Looking up…", at } });
      const place = await reverseLookup(at);
      if (token === lookup.current) setCard({ kind: "pin", place });
    };
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [map]);

  useEffect(() => {
    if (card?.kind !== "pin") closePin();
  }, [card, closePin]);

  const locate = useCallback(
    async (then?: (place: Place) => void) => {
      try {
        const at = await currentPosition();
        setYou(at);
        map?.flyTo({ center: at, zoom: 15 });
        if (then) {
          const place = await reverseLookup(at);
          then({ ...place, label: "My location", detail: place.label });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't find your location.");
      }
    },
    [map],
  );

  useEffect(() => {
    if (!map) return;
    markers.current.you?.remove();
    if (you) markers.current.you = spriteMarker(YOU_DOT, "center").setLngLat(you).addTo(map);
  }, [map, you]);

  useEffect(() => {
    let off = () => {};
    let gone = false;
    void onBackButton(() => {
      const { sheet: open, drive: driving, card: shown } = live.current;
      if (driving.status !== "idle") {
        driver.current?.stop();
        setDrive({ status: "idle", progress: 0, left: 0 });
      } else if (open) setSheet(null);
      else if (shown) setCard(null);
      else return false;
      return true;
    }).then((remove) => {
      if (gone) remove();
      else off = remove;
    });
    return () => {
      gone = true;
      off();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSheet(null);
        setCard(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const setEnd = (key: keyof Trip) => (place: Place | null) => setTrip((t) => ({ ...t, [key]: place }));

  // ----- saved places -----

  const openEditor = (next: Draft) => {
    setCard(null);
    setSheet({ kind: "editor", draft: next });
    map?.easeTo({ center: next.at, zoom: Math.max(map.getZoom(), 15), offset: sheetOffset(), duration: 500 });
  };

  const startNewPlace = (place: Place) => {
    const name = place.label === "Dropped pin" ? "" : place.label;
    openEditor({ name, building: suggestBuilding(place.label), at: place.at });
  };

  const editSaved = (id: string) => {
    const s = places.find((p) => p.id === id);
    if (s) openEditor({ id: s.id, name: s.name, building: s.building, at: s.at });
  };

  const saveDraft = () => {
    if (sheet?.kind !== "editor") return;
    const d = sheet.draft;
    const name = d.name.trim();
    if (!name) return;
    const id = d.id ?? newId();
    const next: SavedPlace = { id, name, building: d.building, at: d.at };
    setPlaces((all) => (all.some((p) => p.id === id) ? all.map((p) => (p.id === id ? next : p)) : [...all, next]));
    // Keep any trip end that pointed at this place in step with its new name and building.
    setTrip((t) => ({
      from: t.from && samePlace(t.from.at, d.at) ? savedToPlace(next) : t.from,
      to: t.to && samePlace(t.to.at, d.at) ? savedToPlace(next) : t.to,
    }));
    setSheet(null);
    setCard({ kind: "saved", id });
    // The sheet had pushed the map aside; put the new place back in the middle of the view.
    map?.easeTo({ center: d.at, offset: [0, 0], duration: 400 });
  };

  const deleteDraft = () => {
    if (sheet?.kind !== "editor" || !sheet.draft.id) return;
    const id = sheet.draft.id;
    setPlaces((all) => all.filter((p) => p.id !== id));
    setSheet(null);
    setCard(null);
  };

  const placeById = (id: string) => places.find((p) => p.id === id);

  const applyPlaceTo = (key: keyof Trip, s: SavedPlace) => {
    setEnd(key)(savedToPlace(s));
    setSheet(null);
    setCard(null);
  };

  const doBackup = async () => {
    await saveBackupFile(makeBackup(places, car), `128bitmaps-backup-${today()}.json`);
    return `Backup ready: ${places.length} ${places.length === 1 ? "place" : "places"}.`;
  };

  const doRestore = async (file: File) => {
    if (file.size > 5_000_000) throw new Error("That file is too big to be a backup.");
    const restored = readBackup(await file.text());
    setPlaces((all) => mergePlaces(all, restored.places));
    if (restored.car) setCar(restored.car);
    const skipped = restored.skipped ? ` (${restored.skipped} couldn't be read)` : "";
    return `Restored ${restored.places.length} ${restored.places.length === 1 ? "place" : "places"}${skipped}.`;
  };

  const startDrive = () => {
    if (!route) return;
    setCard(null);
    setSheet(null);
    setDrive({ status: "driving", progress: 0, left: route.distance });
    driver.current?.start(route.line, car);
  };

  const endDrive = () => {
    driver.current?.stop();
    setDrive({ status: "idle", progress: 0, left: 0 });
  };

  const pickCar = (id: string) => {
    setCar(id);
    driver.current?.setCar(id);
  };

  const cardSaved = card?.kind === "saved" ? placeById(card.id) : undefined;
  const cardPlace = card?.kind === "pin" ? card.place : cardSaved ? savedToPlace(cardSaved) : null;
  const driving = drive.status !== "idle";
  const canSaveEnd = (p: Place) => !places.some((s) => samePlace(s.at, p.at));

  return (
    <div className={`app${sheet ? " sheet-open" : ""}${driving ? " driving" : ""}`}>
      <div className="map-stack">
        <div ref={artHost} className="map art-map" />
        <div ref={labelHost} className="map label-map" aria-hidden />
      </div>

      <div className="ui">
      <section ref={panelRef} className="panel trip-panel">
        <header className="brand">
          <span className="logo">128BITMAPS</span>
          {!map && <span className="loading-text">LOADING…</span>}
          <button
            className="pixel-btn menu-btn"
            onClick={() => setSheet({ kind: "menu", tab: "places" })}
            aria-label="Open menu"
          >
            MENU
          </button>
        </header>
        <div className="ends">
          <PlaceInput
            icon={icons.start}
            placeholder="From where?"
            value={trip.from}
            near={near}
            saved={places}
            canSave={!!trip.from && canSaveEnd(trip.from)}
            onPick={setEnd("from")}
            onClear={() => setEnd("from")(null)}
            onSave={startNewPlace}
            onUseLocation={() => locate(setEnd("from"))}
          />
          <PlaceInput
            icon={icons.goal}
            placeholder="To where?"
            value={trip.to}
            near={near}
            saved={places}
            canSave={!!trip.to && canSaveEnd(trip.to)}
            onPick={setEnd("to")}
            onClear={() => setEnd("to")(null)}
            onSave={startNewPlace}
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
            <div className="summary-actions">
              <button className="pixel-btn go-from" onClick={startDrive} aria-label="Drive the route">
                GO ▶
              </button>
              <button className="pixel-btn" onClick={() => setShowSteps((s) => !s)}>
                {showSteps ? "HIDE" : "STEPS"}
              </button>
            </div>
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

      {driving && (
        <section className="panel drive-bar" aria-live="polite">
          {drive.status === "driving" ? (
            <>
              <button className="pixel-btn go-to" onClick={endDrive}>
                ■ STOP
              </button>
              <div className="meter" role="progressbar" aria-valuenow={Math.round(drive.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                {Array.from({ length: 14 }, (_, i) => (
                  <span key={i} className={i < Math.round(drive.progress * 14) ? "seg on" : "seg"} />
                ))}
              </div>
              <span className="left">{formatDistance(drive.left)}</span>
            </>
          ) : (
            <>
              <span className="arrived">★ YOU MADE IT!</span>
              <button className="pixel-btn go-from" onClick={startDrive}>
                AGAIN
              </button>
              <button className="pixel-btn" onClick={endDrive}>
                DONE
              </button>
            </>
          )}
        </section>
      )}

      {cardPlace && !sheet && !driving && (
        <section className="panel drop-panel">
          <div className="drop-info">
            {cardSaved && (
              <span className="card-icon">
                <SpriteImg kind="building" id={cardSaved.building} scale={2} />
              </span>
            )}
            <span className="card-text">
              <span className="hit-label">{cardPlace.label}</span>
              <span className="hit-detail">{cardSaved ? getBuilding(cardSaved.building).name : cardPlace.detail}</span>
            </span>
          </div>
          <div className="drop-actions">
            <button
              className="pixel-btn go-from"
              onClick={() => {
                setEnd("from")(cardPlace);
                setCard(null);
              }}
            >
              FROM
            </button>
            <button
              className="pixel-btn go-to"
              onClick={() => {
                setEnd("to")(cardPlace);
                setCard(null);
              }}
            >
              TO
            </button>
            {cardSaved ? (
              <button className="pixel-btn" onClick={() => editSaved(cardSaved.id)}>
                EDIT
              </button>
            ) : (
              <button className="pixel-btn" onClick={() => startNewPlace(cardPlace)}>
                ★ SAVE
              </button>
            )}
            <button className="pixel-btn ghost" aria-label="Close" onClick={() => setCard(null)}>
              ×
            </button>
          </div>
        </section>
      )}

      {sheet?.kind === "menu" && (
        <MenuSheet
          tab={sheet.tab}
          onTab={(tab) => setSheet({ kind: "menu", tab })}
          onClose={() => setSheet(null)}
          places={places}
          onOpenPlace={(id) => {
            const s = placeById(id);
            if (s) map?.flyTo({ center: s.at, zoom: Math.max(map.getZoom(), 15) });
            openSaved(id);
          }}
          onFrom={(id) => {
            const s = placeById(id);
            if (s) applyPlaceTo("from", s);
          }}
          onTo={(id) => {
            const s = placeById(id);
            if (s) applyPlaceTo("to", s);
          }}
          onEdit={editSaved}
          car={car}
          onCar={pickCar}
          onBackup={doBackup}
          onRestore={doRestore}
        />
      )}

      {sheet?.kind === "editor" && (
        <PlaceEditor
          draft={sheet.draft}
          onChange={(d) => setSheet({ kind: "editor", draft: d })}
          onSave={saveDraft}
          onDelete={sheet.draft.id ? deleteDraft : undefined}
          onCancel={() => setSheet(null)}
        />
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
    </div>
  );
}
