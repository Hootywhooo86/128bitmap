import { useRef, useState } from "react";
import type { LngLat } from "../lib/geo";
import type { SavedPlace } from "../lib/store";
import { BUILDINGS, SHELVES, buildingsOnShelf, getBuilding, type ShelfId } from "../pixel/buildings";
import { CARS } from "../pixel/cars";
import type { Appearance, Theme } from "../lib/settings";
import { CLASSIC_COLORS, PIN_SIZE, pinUrl } from "../pixel/classicMarkers";
import { SpriteImg } from "./SpriteImg";

export type MenuTab = "places" | "look" | "backup";

export type Draft = {
  id?: string;
  name: string;
  building: string;
  at: LngLat;
};

const TABS: { id: MenuTab; label: string }[] = [
  { id: "places", label: "PLACES" },
  { id: "look", label: "LOOK" },
  { id: "backup", label: "BACKUP" },
];

type MenuProps = {
  tab: MenuTab;
  onTab: (tab: MenuTab) => void;
  onClose: () => void;
  places: SavedPlace[];
  onOpenPlace: (id: string) => void;
  onFrom: (id: string) => void;
  onTo: (id: string) => void;
  onEdit: (id: string) => void;
  car: string;
  onCar: (id: string) => void;
  theme: Theme;
  onTheme: (theme: Theme) => void;
  appearance: Appearance;
  onAppearance: (value: Appearance) => void;
  voice: boolean;
  onVoice: (on: boolean) => void;
  onBackup: () => Promise<string>;
  onRestore: (file: File) => Promise<string>;
};

export function MenuSheet(p: MenuProps) {
  return (
    <section className="panel sheet" aria-label="Menu">
      <header className="sheet-head">
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={p.tab === t.id}
              className={p.tab === t.id ? "tab on" : "tab"}
              onClick={() => p.onTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button className="pixel-btn ghost close" aria-label="Close menu" onClick={p.onClose}>
          ×
        </button>
      </header>
      <div className="sheet-body">
        {p.tab === "places" && <PlacesTab {...p} />}
        {p.tab === "look" && <LookTab {...p} />}
        {p.tab === "backup" && <BackupTab count={p.places.length} onBackup={p.onBackup} onRestore={p.onRestore} />}
      </div>
    </section>
  );
}

function PlacesTab({ places, onOpenPlace, onFrom, onTo, onEdit, theme }: MenuProps) {
  if (places.length === 0) {
    return (
      <div className="empty">
        {theme === "retro" ? (
          <SpriteImg kind="building" id="castle" scale={3} />
        ) : (
          <img src={pinUrl(CLASSIC_COLORS.saved)} width={PIN_SIZE.w} height={PIN_SIZE.h} alt="" />
        )}
        <p>No saved places yet.</p>
        <p className="dim">
          {theme === "retro"
            ? "Tap the map (or search) and press SAVE. Then give it a building: the gym can be a dungeon and work can be a prison."
            : "Tap the map (or search) and press SAVE, for example Home, Work or the gym. Saved places show up when you type in From or To."}
        </p>
      </div>
    );
  }
  return (
    <ul className="place-list">
      {places.map((s) => (
        <li key={s.id}>
          <button className="place-row-main" onClick={() => onOpenPlace(s.id)}>
            {theme === "retro" ? (
              <SpriteImg kind="building" id={s.building} scale={2} />
            ) : (
              <img className="row-pin" src={pinUrl(CLASSIC_COLORS.saved)} width={PIN_SIZE.w * 0.75} height={PIN_SIZE.h * 0.75} alt="" />
            )}
            <span className="hit-text">
              <span className="hit-label">{s.name}</span>
              <span className="hit-detail">{theme === "retro" ? getBuilding(s.building).name : "Saved place"}</span>
            </span>
          </button>
          <div className="row-actions">
            <button className="pixel-btn go-from small" onClick={() => onFrom(s.id)}>
              FROM
            </button>
            <button className="pixel-btn go-to small" onClick={() => onTo(s.id)}>
              TO
            </button>
            <button className="pixel-btn small" aria-label={`Edit ${s.name}`} onClick={() => onEdit(s.id)}>
              EDIT
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function LookTab({ theme, onTheme, appearance, onAppearance, voice, onVoice, car, onCar }: MenuProps) {
  return (
    <div className="look">
      <h3 className="sec">Map style</h3>
      <div className="theme-choice" role="radiogroup" aria-label="Map style">
        <button role="radio" aria-checked={theme === "classic"} className={theme === "classic" ? "theme-card on" : "theme-card"} onClick={() => onTheme("classic")}>
          <span className="theme-name">Classic</span>
          <span className="dim">A clean street map, like a normal maps app.</span>
        </button>
        <button role="radio" aria-checked={theme === "retro"} className={theme === "retro" ? "theme-card on" : "theme-card"} onClick={() => onTheme("retro")}>
          <span className="theme-name">Retro</span>
          <span className="dim">Pixel-art map, buildings for your places, and a car to watch.</span>
        </button>
      </div>
      {theme === "classic" && (
        <>
          <h3 className="sec">Day or night</h3>
          <div className="modes" role="radiogroup" aria-label="Day or night">
            {(["auto", "light", "dark"] as const).map((v) => (
              <button key={v} role="radio" aria-checked={appearance === v} className={appearance === v ? "mode on" : "mode"} onClick={() => onAppearance(v)}>
                {v === "auto" ? "Auto" : v === "light" ? "Day" : "Night"}
              </button>
            ))}
          </div>
        </>
      )}
      <h3 className="sec">Voice directions</h3>
      <button role="switch" aria-checked={voice} className={voice ? "switch on" : "switch"} onClick={() => onVoice(!voice)}>
        <span className="switch-knob" />
        <span>{voice ? "On: speaks each turn" : "Off"}</span>
      </button>
      {theme === "retro" && (
        <>
          <h3 className="sec">Car</h3>
          <GarageTab car={car} onCar={onCar} />
        </>
      )}
    </div>
  );
}

function GarageTab({ car, onCar }: { car: string; onCar: (id: string) => void }) {
  return (
    <div>
      <p className="dim hint">Pick your car. It is the one you drive while navigating.</p>
      <ul className="car-grid">
        {CARS.map((c) => (
          <li key={c.id}>
            <button className={c.id === car ? "tile on" : "tile"} aria-pressed={c.id === car} onClick={() => onCar(c.id)}>
              <SpriteImg kind="car" id={c.id} scale={2} />
              <span className="tile-name">{c.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BackupTab({
  count,
  onBackup,
  onRestore,
}: {
  count: number;
  onBackup: () => Promise<string>;
  onRestore: (file: File) => Promise<string>;
}) {
  const [note, setNote] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const run = async (job: () => Promise<string>) => {
    try {
      setNote(await job());
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Something went wrong.");
    }
  };
  return (
    <div className="backup">
      <p>
        Your places live on this device. Save a backup file to keep them safe or move them to another phone.
      </p>
      <p className="dim">
        {count} saved {count === 1 ? "place" : "places"}
      </p>
      <div className="backup-actions">
        <button className="pixel-btn" onClick={() => run(onBackup)}>
          SAVE BACKUP
        </button>
        <button className="pixel-btn" onClick={() => input.current?.click()}>
          RESTORE
        </button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void run(() => onRestore(file));
          }}
        />
      </div>
      <p className="dim small-print">Restoring adds places from the file. It never deletes places already on this device.</p>
      {note && (
        <p className="note" role="status">
          {note}
        </p>
      )}
    </div>
  );
}

type EditorProps = {
  theme: Theme;
  draft: Draft;
  onChange: (draft: Draft) => void;
  onSave: () => void;
  onDelete?: () => void;
  onCancel: () => void;
};

export function PlaceEditor({ theme, draft, onChange, onSave, onDelete, onCancel }: EditorProps) {
  const [shelf, setShelf] = useState<ShelfId>(getBuilding(draft.building).shelf);
  const [confirm, setConfirm] = useState(false);
  const current = getBuilding(draft.building);
  const canSave = draft.name.trim().length > 0;

  return (
    <section className="panel sheet editor" aria-label={draft.id ? "Edit place" : "New place"}>
      <header className="sheet-head">
        <span className="sheet-title">{draft.id ? "EDIT PLACE" : "NEW PLACE"}</span>
        <button className="pixel-btn ghost close" aria-label="Cancel" onClick={onCancel}>
          ×
        </button>
      </header>
      <div className="sheet-body">
        <div className="name-row">
          <div className="preview-box">
            {theme === "retro" ? (
              <SpriteImg kind="building" id={draft.building} scale={2} />
            ) : (
              <img src={pinUrl(CLASSIC_COLORS.saved)} width={PIN_SIZE.w} height={PIN_SIZE.h} alt="" />
            )}
          </div>
          <div className="name-col">
            <input
              className="text-input"
              value={draft.name}
              maxLength={60}
              placeholder="Name this place"
              aria-label="Place name"
              onChange={(e) => onChange({ ...draft, name: e.target.value })}
            />
            <span className="dim hint">
              {theme === "retro" ? `${current.name} · ` : ""}tap the map to move it
            </span>
          </div>
        </div>
        {theme === "retro" && (
        <>
        <div className="chips" role="tablist" aria-label="Building shelves">
          {SHELVES.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={shelf === s.id}
              className={shelf === s.id ? "chip on" : "chip"}
              onClick={() => setShelf(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <ul className="building-grid">
          {buildingsOnShelf(shelf).map((b) => (
            <li key={b.id}>
              <button
                className={b.id === draft.building ? "tile on" : "tile"}
                aria-pressed={b.id === draft.building}
                onClick={() => onChange({ ...draft, building: b.id })}
              >
                <SpriteImg kind="building" id={b.id} scale={2} />
                <span className="tile-name">{b.name}</span>
              </button>
            </li>
          ))}
        </ul>
        </>
        )}
      </div>
      <footer className="sheet-foot">
        <button className="pixel-btn go-from grow" disabled={!canSave} onClick={onSave}>
          SAVE
        </button>
        {onDelete &&
          (confirm ? (
            <button className="pixel-btn go-to" onClick={onDelete}>
              SURE?
            </button>
          ) : (
            <button className="pixel-btn" aria-label="Delete place" onClick={() => setConfirm(true)}>
              DELETE
            </button>
          ))}
        <button className="pixel-btn ghost" onClick={onCancel}>
          CANCEL
        </button>
      </footer>
    </section>
  );
}

export const BUILDING_COUNT = BUILDINGS.length;
