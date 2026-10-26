import { useEffect, useMemo, useState } from "react";
import { searchPlaces, type LngLat, type Place } from "../lib/geo";
import { savedToPlace, type SavedPlace } from "../lib/store";
import { CLASSIC_COLORS, PIN_SIZE, pinUrl } from "../pixel/classicMarkers";
import { SpriteImg } from "./SpriteImg";

type Props = {
  icon: string;
  placeholder: string;
  value: Place | null;
  near: () => LngLat | null;
  saved: SavedPlace[];
  buildings: boolean;
  canSave: boolean;
  onPick: (place: Place) => void;
  onClear: () => void;
  onSave: (place: Place) => void;
  onUseLocation: () => void;
};

type Item = { key: string; kind: "me" } | { key: string; kind: "place"; place: Place; isSaved: boolean };

export function PlaceInput({
  icon,
  placeholder,
  value,
  near,
  saved,
  buildings,
  canSave,
  onPick,
  onClear,
  onSave,
  onUseLocation,
}: Props) {
  const [text, setText] = useState(value?.label ?? "");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(0);
  // True once the person types; a picked or restored place shows its name without searching.
  const [typed, setTyped] = useState(false);
  const [shown, setShown] = useState(value);

  if (value !== shown) {
    setShown(value);
    setText(value?.label ?? "");
    setTyped(false);
  }

  const query = text.trim();
  const searching = typed && query.length >= 2;

  useEffect(() => {
    if (!searching) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const done = await searchPlaces(query, near(), ctrl.signal, (list) => {
          if (!ctrl.signal.aborted) {
            setHits(list);
            setBusy(false);
          }
        });
        if (!ctrl.signal.aborted) setHits(done);
        setActive(0);
      } catch {
        if (!ctrl.signal.aborted) setHits([]);
      } finally {
        if (!ctrl.signal.aborted) setBusy(false);
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, searching, near]);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    if (!typed) out.push({ key: "me", kind: "me" });
    const mine = typed
      ? saved.filter((s) => s.name.toLowerCase().includes(query.toLowerCase())).slice(0, 4)
      : saved;
    for (const s of mine) out.push({ key: `s${s.id}`, kind: "place", place: savedToPlace(s), isSaved: true });
    if (searching) hits.forEach((h, i) => out.push({ key: `h${i}${h.at.join()}`, kind: "place", place: h, isSaved: false }));
    return out;
  }, [typed, saved, query, searching, hits]);

  const choose = (item: Item) => {
    setOpen(false);
    setHits([]);
    if (item.kind === "me") onUseLocation();
    else onPick(item.place);
  };

  const clampedActive = Math.min(active, Math.max(items.length - 1, 0));

  return (
    <div className="place-input">
      {buildings && value?.building ? (
        <span className="place-icon place-icon-building">
          <SpriteImg kind="building" id={value.building} scale={1} animated={false} />
        </span>
      ) : (
        <img className="place-icon" src={icon} alt="" />
      )}
      <input
        value={text}
        placeholder={placeholder}
        aria-label={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setTyped(true);
          setText(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setActive(Math.min(clampedActive + 1, items.length - 1));
          else if (e.key === "ArrowUp") setActive(Math.max(clampedActive - 1, 0));
          else if (e.key === "Enter" && items[clampedActive]) choose(items[clampedActive]);
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {value && canSave && (
        <button className="mini-btn save-star" aria-label="Save this place" title="Save this place" onClick={() => onSave(value)}>
          ★
        </button>
      )}
      {text && (
        <button
          className="clear"
          aria-label="Clear"
          onClick={() => {
            setText("");
            setHits([]);
            onClear();
          }}
        >
          ×
        </button>
      )}
      {open && (items.length > 0 || (busy && searching)) && (
        <ul className="dropdown" role="listbox">
          {items.map((item, i) => (
            <li key={item.key}>
              <button
                className={i === clampedActive ? "active" : ""}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(item)}
              >
                {item.kind === "me" ? (
                  <span className="hit-label">◎ Use my location</span>
                ) : (
                  <span className="hit-row">
                    {item.isSaved &&
                      item.place.building &&
                      (buildings ? (
                        <SpriteImg kind="building" id={item.place.building} scale={1} animated={false} />
                      ) : (
                        <img className="row-pin" src={pinUrl(CLASSIC_COLORS.saved)} width={PIN_SIZE.w * 0.6} height={PIN_SIZE.h * 0.6} alt="" />
                      ))}
                    <span className="hit-text">
                      <span className="hit-label">{item.place.label}</span>
                      {item.place.detail && <span className="hit-detail">{item.place.detail}</span>}
                    </span>
                  </span>
                )}
              </button>
            </li>
          ))}
          {busy && searching && hits.length === 0 && <li className="dim pad">Searching…</li>}
        </ul>
      )}
    </div>
  );
}
