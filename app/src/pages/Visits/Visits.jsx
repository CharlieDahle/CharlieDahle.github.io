import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAppStore } from "../../stores";
import SignIn from "../Budget/SignIn";
import "../Budget/Budget.css";
import "./Visits.css";

const API = `${import.meta.env.VITE_API_URL || "https://api.charliedahle.me"}/api/visits`;
// Only this account can see visits. The server checks this too.
const OWNER = "charlie";
const PERIODS = [7, 30, 90];
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

// ── Formatting ────────────────────────────────────────────────────────────────

const when = (iso) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const dayLabel = (day) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

function duration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// "Safari on iPhone" from a user agent string.
function device(ua) {
  if (!ua) return "Unknown device";
  if (/bot|crawl|spider|slurp|headless|preview/i.test(ua)) return "Bot";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /CrOS/.test(ua)
          ? "ChromeOS"
          : /Macintosh|Mac OS X/.test(ua)
            ? "Mac"
            : /Windows/.test(ua)
              ? "Windows"
              : /Linux/.test(ua)
                ? "Linux"
                : "unknown system";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\/|FxiOS/.test(ua)
        ? "Firefox"
        : /CriOS|Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Unknown browser";
  return `${browser} on ${os}`;
}

const place = (s) => [s.city, s.region, s.country].filter(Boolean).join(", ") || "Unknown location";

const referrerHost = (url) => {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

// Every day in the period, oldest first, including days with no visits.
function fillDays(perDay, days) {
  const counts = new Map(perDay.map((d) => [d.day, d.visits]));
  const out = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({ day: key, visits: counts.get(key) || 0 });
  }
  return out;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Visits() {
  const { user, token, isAuthInitialized, logout } = useAppStore((s) => s.auth);

  if (!isAuthInitialized) return <div className="bg-page" />;
  if (!token || user?.username !== OWNER) {
    return <SignIn title="Visits" allowed={[OWNER]} signedInAs={token ? user?.username : null} onSwitch={logout} />;
  }
  return <VisitsApp token={token} onSignOut={logout} />;
}

function VisitsApp({ token, onSignOut }) {
  const [days, setDays] = useState(30);
  const [withMine, setWithMine] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    async (before) => {
      const params = new URLSearchParams({ days, tz: TZ, ...(withMine && { owner: "1" }), ...(before && { before }) });
      const res = await fetch(`${API}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401 || res.status === 403) {
        onSignOut();
        throw new Error("Your session ended. Sign in again.");
      }
      if (!res.ok) throw new Error("Couldn't load visits. Try again.");
      return res.json();
    },
    [days, withMine, token, onSignOut],
  );

  useEffect(() => {
    let cancelled = false;
    setError(null);
    load()
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const next = await load(data.sessions[data.sessions.length - 1].started_at);
      setData((d) => ({ ...d, sessions: [...d.sessions, ...next.sessions], more: next.more }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="bg-page">
      <div className="bg-wrap vs-wrap">
        <header className="bg-top">
          <a href="https://charliedahle.me" className="bg-back">
            ← charliedahle.me
          </a>
          <button className="bg-link" onClick={onSignOut}>
            Sign out
          </button>
        </header>

        <div className="bg-heading vs-heading">
          <h1 className="bg-title">Visits</h1>
          <div className="vs-controls">
            <span className="vs-periods" role="group" aria-label="Period">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  className={`vs-period ${p === days ? "is-current" : ""}`}
                  aria-pressed={p === days}
                  onClick={() => setDays(p)}
                >
                  {p} days
                </button>
              ))}
            </span>
            <label className="vs-mine">
              <input type="checkbox" checked={withMine} onChange={(e) => setWithMine(e.target.checked)} />
              Include my visits
            </label>
          </div>
        </div>

        {error && <p className="bg-error bg-error-banner">{error}</p>}

        {data && (
          <>
            <Totals totals={data.totals} />
            <PerDay perDay={data.perDay} days={data.days} />

            <div className="vs-lists">
              <TopList title="Pages" rows={data.pages} name="path" value="views" unit="views" />
              <TopList title="Countries" rows={data.countries} name="country" value="visits" unit="visits" />
              <TopList title="Came from" rows={data.referrers} name="referrer" value="visits" unit="visits" />
            </div>

            <section className="vs-section">
              <header className="bg-ledger-head">
                <h2>Recent visits</h2>
                <span className="bg-quiet">Click one to see what they did</span>
              </header>
              {data.sessions.length === 0 && <p className="bg-quiet vs-empty">No visits in this period yet.</p>}
              <ul className="bg-rows">
                {data.sessions.map((s) => (
                  <Visit key={s.id} visit={s} />
                ))}
              </ul>
              {data.more && (
                <button className="bg-link vs-more" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? "Loading…" : "Show older visits"}
                </button>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

// ── Totals ────────────────────────────────────────────────────────────────────

function Totals({ totals }) {
  const items = [
    ["Visits", totals.visits],
    ["Unique IPs", totals.ips],
    ["Unique browsers", totals.visitors],
    ["Page views", totals.views],
  ];
  return (
    <dl className="vs-totals">
      {items.map(([label, n]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{n.toLocaleString()}</dd>
        </div>
      ))}
    </dl>
  );
}

// ── Visits per day ────────────────────────────────────────────────────────────

const BAR = "#0a84ff";

function PerDay({ perDay, days }) {
  const rows = useMemo(() => fillDays(perDay, days), [perDay, days]);
  const total = rows.reduce((s, r) => s + r.visits, 0);

  return (
    <section className="vs-section">
      <header className="bg-ledger-head">
        <h2>Visits per day</h2>
      </header>
      <div className="vs-chart" role="img" aria-label={`Visits per day over the last ${days} days, ${total} in all.`}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={rows} margin={{ top: 12, right: 0, bottom: 0, left: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke="#e5e5ea" />
            <XAxis
              dataKey="day"
              tickFormatter={dayLabel}
              tickLine={false}
              axisLine={{ stroke: "#e5e5ea" }}
              tick={{ fill: "#86868b", fontSize: 12 }}
              minTickGap={24}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#86868b", fontSize: 12 }}
              width={32}
            />
            <Tooltip cursor={{ fill: "rgba(10, 132, 255, 0.08)" }} content={<DayTip />} isAnimationActive={false} />
            <Bar dataKey="visits" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function DayTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { day, visits } = payload[0].payload;
  return (
    <div className="vs-tip">
      <strong>{visits.toLocaleString()}</strong> {visits === 1 ? "visit" : "visits"}
      <span>{dayLabel(day)}</span>
    </div>
  );
}

// ── Top lists ─────────────────────────────────────────────────────────────────

function TopList({ title, rows, name, value, unit }) {
  return (
    <section>
      <header className="bg-ledger-head">
        <h2>{title}</h2>
        <span className="bg-quiet">{unit}</span>
      </header>
      {rows.length === 0 ? (
        <p className="bg-quiet vs-empty">None yet.</p>
      ) : (
        <ul className="bg-rows">
          {rows.map((r) => (
            <li key={r[name] ?? "none"} className="vs-top-row">
              <span className="vs-truncate">{r[name] ?? "Unknown"}</span>
              <span className="bg-amount">{r[value].toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── One visit ─────────────────────────────────────────────────────────────────

function Visit({ visit: s }) {
  const [open, setOpen] = useState(false);
  const views = s.events.filter((e) => e.type === "view").length;
  const length = new Date(s.last_seen) - new Date(s.started_at);

  const tags = [
    s.is_owner && "You",
    s.visitor_visits > 1 && `Returning, ${s.visitor_visits} visits`,
    s.hosting && "Data center",
    s.proxy && "VPN or proxy",
    s.mobile && "Cellular",
  ].filter(Boolean);

  return (
    <li>
      <button className="vs-visit" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className={`bg-chevron ${open ? "is-open" : ""}`} aria-hidden="true">
          ›
        </span>
        <span className="vs-when">{when(s.started_at)}</span>
        <span className="vs-who">
          <span>{place(s)}</span>
          <span className="bg-quiet">
            {[s.isp, device(s.user_agent)].filter(Boolean).join(" · ")}
            {tags.length > 0 && ` · ${tags.join(" · ")}`}
          </span>
        </span>
        <span className="vs-from bg-quiet vs-truncate">{referrerHost(s.referrer) || "Direct"}</span>
        <span className="bg-amount">
          {views} {views === 1 ? "page" : "pages"}
          <span className="bg-quiet"> · {duration(length)}</span>
        </span>
      </button>

      {open && (
        <div className="vs-detail">
          <Timeline visit={s} />
          <dl className="vs-facts">
            <Fact label="IP">{s.ip}</Fact>
            <Fact label="Forwarded for">{s.forwarded_for}</Fact>
            <Fact label="Network">{[s.org, s.asn].filter(Boolean).join(" · ")}</Fact>
            <Fact label="Came from">{s.referrer}</Fact>
            <Fact label="First page">{s.landing_path}</Fact>
            <Fact label="Language">{[s.language, s.accept_language].filter(Boolean).join(" · ")}</Fact>
            <Fact label="Time zone">{s.timezone}</Fact>
            <Fact label="Screen">{[s.screen, s.viewport && `window ${s.viewport}`].filter(Boolean).join(" · ")}</Fact>
            <Fact label="Browser ID">{s.visitor_id}</Fact>
            <Fact label="User agent">{s.user_agent}</Fact>
          </dl>
        </div>
      )}
    </li>
  );
}

function Fact({ label, children }) {
  if (!children) return null;
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

// What they did, in order, with how long they spent on each page.
function Timeline({ visit: s }) {
  const start = new Date(s.started_at);
  if (!s.events.length) return <p className="bg-quiet vs-empty">Nothing recorded after they arrived.</p>;

  return (
    <ol className="vs-timeline">
      {s.events.map((e, i) => {
        const at = new Date(e.at);
        const next = s.events[i + 1];
        const offset = duration(at - start);
        let what;
        if (e.type === "view") {
          what = (
            <>
              Opened <strong>{e.path}</strong>
              {next && <span className="bg-quiet"> for {duration(new Date(next.at) - at)}</span>}
            </>
          );
        } else if (e.type === "click") {
          what = <>Clicked {e.label ? <strong>{e.label}</strong> : "something"}</>;
        } else {
          what = <span className="bg-quiet">Left the tab</span>;
        }
        return (
          <li key={i}>
            <span className="vs-offset bg-quiet">+{offset}</span>
            <span>{what}</span>
          </li>
        );
      })}
    </ol>
  );
}
