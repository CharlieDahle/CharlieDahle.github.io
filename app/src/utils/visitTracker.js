// Logs visits to the site: a "start" when someone opens it, then batches of
// the pages they view and the links and buttons they click. Never records
// anything typed. Results are on /visits.

const API = `${import.meta.env.VITE_API_URL || "https://api.charliedahle.me"}/api/visits`;

const FLUSH_EVERY_MS = 30 * 1000;
const FLUSH_AT = 20; // events
const MAX_PER_REQUEST = 50; // the server takes no more than this per batch

// Clicks here would log private things (like budget item names), so only page views are kept.
const NO_CLICKS = ["/budget", "/visits"];

// Local development would fill the real log with test visits.
const enabled = typeof window !== "undefined" && !["localhost", "127.0.0.1"].includes(window.location.hostname);

let sessionId = null;
let visitorId = null;
let queue = [];

// One id per tab (survives reloads), and one per browser (spots return visits).
function storedId(storage, key) {
  try {
    let id = storage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      storage.setItem(key, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function setUp() {
  if (sessionId) return;
  sessionId = storedId(sessionStorage, "visit-session");
  visitorId = storedId(localStorage, "visit-visitor");

  setInterval(flush, FLUSH_EVERY_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") return;
    push({ type: "leave", path: window.location.pathname });
    flush();
  });
  window.addEventListener("pagehide", flush);
  document.addEventListener("click", onClick, true);
}

function onClick(e) {
  const path = window.location.pathname;
  if (NO_CLICKS.some((p) => path.toLowerCase().startsWith(p))) return;
  const el = e.target.closest?.("a, button, [role='button']");
  if (!el) return;
  const label = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || el.tagName)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  const href = el.tagName === "A" ? el.getAttribute("href") : null;
  push({ type: "click", path, label: href ? `${label} → ${href}`.slice(0, 100) : label });
}

function push(event) {
  queue.push({ ...event, at: Date.now() });
  if (queue.length >= FLUSH_AT) flush();
}

// Sends what's queued. sendBeacon keeps working while the page closes.
function flush() {
  while (queue.length) {
    const body = JSON.stringify({ sessionId, sentAt: Date.now(), events: queue.splice(0, MAX_PER_REQUEST) });
    // Plain text, so the browser sends it without asking the server first.
    const sent = navigator.sendBeacon?.(`${API}/events`, new Blob([body], { type: "text/plain" }));
    if (!sent) {
      fetch(`${API}/events`, { method: "POST", headers: { "Content-Type": "text/plain" }, body, keepalive: true }).catch(
        () => {},
      );
    }
  }
}

// Starts (or continues) this tab's visit. Called again after signing in, so
// your own visits are marked as yours.
export function startVisit(token) {
  if (!enabled) return;
  setUp();
  fetch(`${API}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify({
      sessionId,
      visitorId,
      path: window.location.pathname,
      referrer: document.referrer || null,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: `${window.screen.width}x${window.screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    }),
    keepalive: true,
  }).catch(() => {});
}

export function trackView(path) {
  if (!enabled) return;
  setUp();
  push({ type: "view", path });
}
