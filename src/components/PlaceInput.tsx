import { useEffect, useState } from "react";
import { searchPlaces, type LngLat, type Place } from "../lib/geo";

type Props = {
  icon: string;
  placeholder: string;
  value: Place | null;
  near: () => LngLat | null;
  onPick: (place: Place) => void;
  onClear: () => void;
  onUseLocation?: () => void;
};

export function PlaceInput({ icon, placeholder, value, near, onPick, onClear, onUseLocation }: Props) {
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

  useEffect(() => {
    const query = text.trim();
    if (!typed || query.length < 3) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        setHits(await searchPlaces(query, near(), ctrl.signal));
        setActive(0);
      } catch {
        if (!ctrl.signal.aborted) setHits([]);
      } finally {
        if (!ctrl.signal.aborted) setBusy(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [text, typed, near]);

  const showHits = typed && text.trim().length >= 3;

  const pick = (place: Place) => {
    setOpen(false);
    setHits([]);
    onPick(place);
  };

  return (
    <div className="place-input">
      <img className="place-icon" src={icon} alt="" />
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
          if (e.key === "ArrowDown") setActive((i) => Math.min(i + 1, hits.length - 1));
          else if (e.key === "ArrowUp") setActive((i) => Math.max(i - 1, 0));
          else if (e.key === "Enter" && hits[active]) pick(hits[active]);
          else if (e.key === "Escape") setOpen(false);
        }}
      />
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
      {open && ((showHits && hits.length > 0) || busy || onUseLocation) && (
        <ul className="dropdown" role="listbox">
          {onUseLocation && !typed && (
            <li>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  onUseLocation();
                }}
              >
                <span className="hit-label">◎ Use my location</span>
              </button>
            </li>
          )}
          {busy && showHits && hits.length === 0 && <li className="dim">Searching…</li>}
          {showHits && hits.map((hit, i) => (
            <li key={`${hit.at.join()}-${i}`}>
              <button
                className={i === active ? "active" : ""}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(hit)}
              >
                <span className="hit-label">{hit.label}</span>
                {hit.detail && <span className="hit-detail">{hit.detail}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
