import { formatDistance, formatDuration, usesMiles } from "../lib/geo";
import type { NavState } from "../nav/Navigator";

// Top card while navigating: the next turn and how far away it is.
export function NavBanner({ state }: { state: NavState }) {
  if (state.phase === "waiting") {
    return (
      <section className="panel nav-banner" aria-live="polite">
        <span className="nav-arrow-big">◎</span>
        <span className="nav-main">
          <span className="nav-street">{state.error ?? "Finding your position…"}</span>
          {!state.error && <span className="nav-then">Turn on location if your phone asks</span>}
        </span>
      </section>
    );
  }
  if (state.phase === "arrived") {
    return (
      <section className="panel nav-banner arrived-banner" aria-live="polite">
        <span className="nav-arrow-big">★</span>
        <span className="nav-main">
          <span className="nav-street">You have arrived</span>
        </span>
      </section>
    );
  }
  return (
    <section className={`panel nav-banner${state.offRoute ? " off" : ""}`} aria-live="polite">
      <span className="nav-arrow-big">{state.rerouting || state.offRoute ? "↻" : state.nextIcon}</span>
      <span className="nav-main">
        {state.rerouting || state.offRoute ? (
          <span className="nav-street">Rerouting…</span>
        ) : (
          <>
            <span className="nav-dist">{formatDistance(state.nextDist)}</span>
            <span className="nav-street">{state.nextText}</span>
            {state.thenText && <span className="nav-then">{state.thenText}</span>}
          </>
        )}
      </span>
    </section>
  );
}

type BarProps = {
  state: NavState;
  voice: boolean;
  onVoice: (on: boolean) => void;
  onRecenter: () => void;
  onTilt: (on: boolean) => void;
  onEnd: () => void;
};

function Speaker({ on }: { on: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor" />
      {on ? (
        <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      ) : (
        <path d="M16 9l6 6M22 9l-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      )}
    </svg>
  );
}

// Bottom card while navigating: arrival time, time and distance left, and the controls.
export function NavBar({ state, voice, onVoice, onRecenter, onTilt, onEnd }: BarProps) {
  const arrived = state.phase === "arrived";
  const eta = new Date(state.etaAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const kmh = state.speed * 3.6;
  const shown = Math.round(usesMiles() ? kmh / 1.609344 : kmh);
  return (
    <>
      {!arrived && state.phase === "active" && (
        <div className="nav-chips">
          {state.demo && <span className="nav-demo">PREVIEW</span>}
          <span className="nav-speed" aria-label="Speed">
            <b>{shown}</b>
            <i>{usesMiles() ? "mph" : "km/h"}</i>
          </span>
        </div>
      )}
    <section className="panel nav-bar">
      <div className="nav-eta">
        {arrived ? (
          <span className="nav-eta-main">Trip complete</span>
        ) : state.phase === "waiting" ? (
          <span className="nav-eta-main">Starting…</span>
        ) : (
          <>
            <span className="nav-eta-main">{formatDuration(state.remainingSeconds)}</span>
            <span className="nav-eta-sub">
              {formatDistance(state.remainingMeters)} · arrive {eta}
            </span>
          </>
        )}
      </div>
      <div className="nav-actions">
        {!state.following && !arrived && (
          <button className="pixel-btn recenter" onClick={onRecenter} aria-label="Follow my position">
            RECENTER
          </button>
        )}
        {!arrived && (
          <button className="pixel-btn icon-btn tilt-btn" onClick={() => onTilt(!state.tilt)} aria-label={state.tilt ? "Flat map view" : "3D view"} aria-pressed={state.tilt}>
            {state.tilt ? "2D" : "3D"}
          </button>
        )}
        {!arrived && (
          <button
            className="pixel-btn icon-btn"
            onClick={() => onVoice(!voice)}
            aria-label={voice ? "Turn voice off" : "Turn voice on"}
            aria-pressed={voice}
          >
            <Speaker on={voice} />
          </button>
        )}
        <button className="pixel-btn go-to" onClick={onEnd}>
          {arrived ? "DONE" : "EXIT"}
        </button>
      </div>
    </section>
    </>
  );
}
