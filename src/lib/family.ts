// The 128bit family account: one sign-in across 128bitPlay, 128bitfit, 128bit Tracker and the
// rest. Signed in, finished routes go to the family feed, so they show on Tracker's timeline and
// reach 128bitlife. Nothing is sent while signed out. Feed schema: 128bittracker's docs/EVENTS.md.
//
// The session lives under the same key as Tracker's timeline and family.js, so on the website
// (hootywhooo86.github.io) one sign-in covers every 128bit page.
import { isNative } from "./platform";

// The 128bit family project. Its publishable key is meant to be public; the tables are only
// reachable through the family SQL's functions.
const PROJECT = { url: "https://wvflpwtaszpstmjpkrhu.supabase.co", key: "sb_publishable_dO8uP74cTV1tbuqESgxysw_323C7lWh" };
const SESSION = "128bit.family.session";
const OUTBOX = "128bit.family.outbox";
const PKCE = "128bit.family.pkce";

type Session = { url: string; key: string; access: string; refresh: string; expires: number; email: string };
type FeedEvent = { id: string; app: "map"; type: string; at: number; data: Record<string, unknown> };

const listeners = new Set<() => void>();
export function onFamily(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function read<T>(k: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(k) ?? "null") as T | null;
  } catch {
    return null;
  }
}
function write(k: string, v: unknown) {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {
    // private mode: works for this visit only
  }
}

function session(): Session | null {
  const s = read<Session>(SESSION);
  return s && s.refresh && s.url === PROJECT.url ? s : null;
}
function save(s: Session | null) {
  write(SESSION, s);
  listeners.forEach((l) => l());
}

export const familyEmail = (): string | null => session()?.email || (session() ? "you" : null);

/** Google / Apple need a web address to come back to; inside the phone app, use email. */
export const canUseProviders = () => !isNative();

async function auth(path: string, body: unknown): Promise<Record<string, unknown>> {
  let r: Response;
  try {
    r = await fetch(`${PROJECT.url}/auth/v1/${path}`, {
      method: "POST",
      headers: { apikey: PROJECT.key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Couldn't reach the 128bit family account. Check the connection.");
  }
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) throw new Error(String(j.error_description ?? j.msg ?? j.message ?? `The account service answered ${r.status}`));
  return j;
}

function toSession(j: Record<string, unknown>, email = ""): Session {
  if (!j.access_token || !j.refresh_token) throw new Error("Sign-in failed.");
  const user = j.user as { email?: string } | undefined;
  return {
    url: PROJECT.url,
    key: PROJECT.key,
    access: String(j.access_token),
    refresh: String(j.refresh_token),
    expires: Number(j.expires_at ?? Math.floor(Date.now() / 1000) + Number(j.expires_in ?? 3600)),
    email: user?.email ?? email,
  };
}

async function token(): Promise<string | null> {
  const s = session();
  if (!s) return null;
  if (s.expires - 60 > Date.now() / 1000) return s.access;
  try {
    const fresh = toSession(await auth("token?grant_type=refresh_token", { refresh_token: s.refresh }), s.email);
    save(fresh);
    return fresh.access;
  } catch (e) {
    if (e instanceof Error && /invalid|not found|revoked|expired/i.test(e.message)) save(null);
    throw e;
  }
}

async function rpc(fn: string, args: unknown = {}): Promise<unknown> {
  const t = await token();
  if (!t) throw new Error("Sign in to your 128bit family account first.");
  const r = await fetch(`${PROJECT.url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: PROJECT.key, Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const text = await r.text();
  let body: { message?: string } | null = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // not JSON
  }
  if (!r.ok) throw new Error(body?.message ?? `The account service answered ${r.status}`);
  return body;
}

export async function signInEmail(email: string, password: string) {
  save(toSession(await auth("token?grant_type=password", { email: email.trim(), password }), email.trim()));
  void flushFamily();
}

/** False when the email has to be confirmed first. */
export async function signUpEmail(email: string, password: string): Promise<boolean> {
  const j = await auth("signup", { email: email.trim(), password });
  if (!j.access_token) return false;
  save(toSession(j, email.trim()));
  return true;
}

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const here = () => location.origin + location.pathname;

/** Leaves for the provider's page; comes back with ?code=… (see finishRedirect). PKCE, S256. */
export async function signInWith(provider: "google" | "apple") {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  sessionStorage.setItem(PKCE, verifier);
  location.href =
    `${PROJECT.url}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(here())}` +
    `&code_challenge=${challenge}&code_challenge_method=s256`;
}

/** Call once on load: finishes a Google / Apple sign-in this page started. */
export async function finishRedirect(): Promise<void> {
  const q = new URLSearchParams(location.search);
  const code = q.get("code");
  const error = q.get("error_description");
  if (!code && !error) return;
  let verifier: string | null = null;
  try {
    verifier = sessionStorage.getItem(PKCE);
    sessionStorage.removeItem(PKCE);
  } catch {
    // none
  }
  if (!verifier) return;
  q.delete("code");
  q.delete("error");
  q.delete("error_description");
  history.replaceState(null, "", here() + (q.toString() ? `?${q}` : "") + location.hash);
  if (error) throw new Error(error);
  save(toSession(await auth("token?grant_type=pkce", { auth_code: code, code_verifier: verifier })));
  void flushFamily();
}

export function signOutFamily() {
  write(OUTBOX, null);
  save(null);
}

/** Deletes the 128bit family account and everything every 128bit app sent to it. Places here stay. */
export async function deleteFamilyAccount() {
  await rpc("delete_my_account");
  signOutFamily();
}

let timer: ReturnType<typeof setTimeout> | null = null;
let sending: Promise<void> | null = null;

/** Queues an event for the family feed. Does nothing while signed out. */
export function logFamilyEvent(type: string, data: Record<string, unknown>, id?: string) {
  if (!session()) return;
  const at = Date.now();
  const q = read<FeedEvent[]>(OUTBOX) ?? [];
  q.push({ id: id ?? `map-${at.toString(36)}-${Math.random().toString(36).slice(2, 10)}`, app: "map", type, at, data });
  write(OUTBOX, q.slice(-500));
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flushFamily(), 2000);
}

/** Sends what's waiting; keeps it for later when offline. */
export function flushFamily(): Promise<void> {
  sending ??= (async () => {
    const q = read<FeedEvent[]>(OUTBOX) ?? [];
    if (!q.length || !session()) return;
    const batch = q.slice(0, 100);
    await rpc("log_events", { events: batch });
    const sent = new Set(batch.map((e) => e.id));
    write(OUTBOX, (read<FeedEvent[]>(OUTBOX) ?? []).filter((e) => !sent.has(e.id)));
  })()
    .catch(() => undefined)
    .finally(() => {
      sending = null;
    });
  return sending;
}
