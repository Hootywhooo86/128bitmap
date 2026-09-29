import { useRef, useState } from "react";
import type { LngLat } from "../lib/geo";
import type { SavedPlace } from "../lib/store";
import { BUILDINGS, SHELVES, buildingsOnShelf, getBuilding, type ShelfId } from "../pixel/buildings";
import { CARS } from "../pixel/cars";
import { SpriteImg } from "./SpriteImg";

export type MenuTab = "places" | "garage" | "backup";

export type Draft = {
  id?: string;
  name: string;
  building: string;
  at: LngLat;
};

const TABS: { id: MenuTab; label: string }[] = [
  { id: "places", label: "PLACES" },
  { id: "garage", label: "GARAGE" },
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
        {p.tab === "garage" && <GarageTab car={p.car} onCar={p.onCar} />}
        {p.tab === "backup" && <BackupTab count={p.places.length} onBackup={p.onBackup} onRestore={p.onRestore} />}
      </div>
    </section>
  );
}

function PlacesTab({ places, onOpenPlace, onFrom, onTo, onEdit }: MenuProps) {
  if (places.length === 0) {
    return (
      <div className="empty">
        <SpriteImg kind="building" id="castle" scale={3} />
        <p>No places yet.</p>
        <p className="dim">Tap the map (or search) and press SAVE PLACE. Then give it a building: the gym can be a dungeon and work can be a prison.</p>
      </div>
    );
  }
  return (
    <ul className="place-list">
      {places.map((s) => (
        <li key={s.id}>
          <button className="place-row-main" onClick={() => onOpenPlace(s.id)}>
            <SpriteImg kind="building" id={s.building} scale={2} />
            <span className="hit-text">
              <span className="hit-label">{s.name}</span>
              <span className="hit-detail">{getBuilding(s.building).name}</span>
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

function GarageTab({ car, onCar }: { car: string; onCar: (id: string) => void }) {
  return (
    <div>
      <p className="dim hint">Pick the car that drives your route.</p>
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
  draft: Draft;
  onChange: (draft: Draft) => void;
  onSave: () => void;
  onDelete?: () => void;
  onCancel: () => void;
};

export function PlaceEditor({ draft, onChange, onSave, onDelete, onCancel }: EditorProps) {
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
            <SpriteImg kind="building" id={draft.building} scale={2} />
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
              {current.name} · tap the map to move it
            </span>
          </div>
        </div>
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
