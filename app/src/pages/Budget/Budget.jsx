import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../../stores";
import { Cell, Pie, PieChart } from "recharts";
import ImportStatement from "./ImportStatement";
import "./Budget.css";

const API = `${import.meta.env.VITE_API_URL || "https://api.charliedahle.me"}/api/budget`;
const BUDGET_USERNAME = "charlie";
const COLORS = ["red", "blue", "green", "orange", "pink"];

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month, delta) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthName(month, opts = { month: "long", year: "numeric" }) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", opts);
}

function shortDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function defaultDate(month) {
  const day = String(new Date().getDate()).padStart(2, "0");
  return month === currentMonth() ? `${month}-${day}` : `${month}-01`;
}

// Reads "$1,234.50" as 1234.5. Blank or junk becomes NaN.
function parseMoney(text) {
  const cleaned = String(text).replace(/[$,\s]/g, "");
  return cleaned === "" ? NaN : Number(cleaned);
}

// A split expense only costs you your share.
const isSplit = (item) => item.split_back !== null && item.split_back !== undefined && item.split_back !== "";
const share = (item) => item.amount - (isSplit(item) ? Number(item.split_back) : 0);

// ── Page ──────────────────────────────────────────────────────────────────────

function Budget() {
  const { user, token, isAuthInitialized, logout } = useAppStore((s) => s.auth);

  if (!isAuthInitialized) return <div className="bg-page" />;

  if (!token || user?.username !== BUDGET_USERNAME) {
    return <SignIn signedInAs={token ? user?.username : null} onSwitch={logout} />;
  }

  return <BudgetApp token={token} onSignOut={logout} />;
}

// ── Sign in ───────────────────────────────────────────────────────────────────

function SignIn({ signedInAs, onSwitch }) {
  const login = useAppStore((s) => s.auth.login);
  const logout = useAppStore((s) => s.auth.logout);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await login(username.trim(), password);
      if (u.username !== BUDGET_USERNAME) {
        logout();
        setError("This account can't open the budget.");
      }
    } catch (err) {
      setError(err.message === "Invalid credentials" ? "Wrong username or password." : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-page bg-signin">
      <a href="https://charliedahle.me" className="bg-back">
        ← charliedahle.me
      </a>
      <form className="bg-signin-form" onSubmit={submit}>
        <h1 className="bg-title">Budget</h1>

        {signedInAs && (
          <p className="bg-note">
            Signed in as {signedInAs}, which can't open the budget.{" "}
            <button type="button" className="bg-link" onClick={onSwitch}>
              Sign out
            </button>
          </p>
        )}

        <label className="bg-field">
          <span>Username</span>
          <input
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label className="bg-field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className="bg-error">{error}</p>}

        <button className="bg-btn" disabled={busy || !username || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

// ── Budget ────────────────────────────────────────────────────────────────────

function BudgetApp({ token, onSignOut }) {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [reloads, setReloads] = useState(0);
  const [lastImport, setLastImport] = useState(null);

  const request = useCallback(
    async (path, method = "GET", body) => {
      const res = await fetch(`${API}${path}`, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 401 || res.status === 403) {
        onSignOut();
        throw new Error("Your session ended. Sign in again.");
      }
      if (res.status === 204) return null;
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "That didn't save. Try again.");
      return json;
    },
    [token, onSignOut],
  );

  useEffect(() => {
    let cancelled = false;
    setError(null);
    request(`?month=${month}`)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [month, request, reloads]);

  // Runs a save, applies the result locally, and shows any error.
  const mutate = async (fn) => {
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  };

  const api = {
    setIncome: (amount) =>
      mutate(async () => {
        const r = await request("/income", "PUT", { amount });
        setData((d) => ({ ...d, income: r.income }));
      }),
    renameLabel: (color, name) =>
      mutate(async () => {
        const r = await request(`/labels/${color}`, "PUT", { name });
        setData((d) => ({ ...d, labels: d.labels.map((l) => (l.color === color ? r : l)) }));
      }),
    save: (kind, item) =>
      mutate(async () => {
        const r = item.id
          ? await request(`/${kind}/${item.id}`, "PUT", item)
          : await request(`/${kind}`, "POST", item);
        setData((d) => {
          // Merge so recurring items keep this month's "paid back" state.
          let list = item.id ? d[kind].map((x) => (x.id === r.id ? { ...x, ...r } : x)) : [...d[kind], r];
          if (kind === "expenses") {
            // Drop it if the date moved to another month; newest first.
            list = list
              .filter((x) => x.spent_on.startsWith(d.month))
              .sort((a, b) => b.spent_on.localeCompare(a.spent_on));
          }
          return { ...d, [kind]: list };
        });
      }),
    setRecurringPaid: (id, paid) =>
      mutate(async () => {
        await request(`/recurring/${id}/paid`, "PUT", { month, paid });
        setData((d) => ({
          ...d,
          recurring: d.recurring.map((x) => (x.id === id ? { ...x, paid_back: paid } : x)),
        }));
      }),
    removeMoney: (id) =>
      mutate(async () => {
        await request(`/money/${id}`, "DELETE");
        setData((d) => ({ ...d, money: d.money.filter((x) => x.id !== id) }));
      }),
    remove: (kind, id) =>
      mutate(async () => {
        await request(`/${kind}/${id}`, "DELETE");
        setData((d) => ({ ...d, [kind]: d[kind].filter((x) => x.id !== id) }));
      }),
  };

  return (
    <div className="bg-page">
      <div className="bg-wrap">
        <header className="bg-top">
          <a href="https://charliedahle.me" className="bg-back">
            ← charliedahle.me
          </a>
          <span className="bg-top-actions">
            <button className="bg-link" onClick={() => setImporting(true)} disabled={!data}>
              Import statement
            </button>
            <button className="bg-link" onClick={onSignOut}>
              Sign out
            </button>
          </span>
        </header>

        <div className="bg-heading">
          <h1 className="bg-title">Budget</h1>
          <div className="bg-month">
            <button aria-label="Previous month" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
              ‹
            </button>
            <span>{monthName(month)}</span>
            <button aria-label="Next month" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
              ›
            </button>
            {month !== currentMonth() && (
              <button className="bg-link bg-today" onClick={() => setMonth(currentMonth())}>
                Back to this month
              </button>
            )}
          </div>
        </div>

        {error && <p className="bg-error bg-error-banner">{error}</p>}

        {lastImport && (
          <div className="bg-notice">
            <span>
              Imported {lastImport.expenses + lastImport.money} items from {lastImport.label}.
            </span>
            <button
              className="bg-link"
              onClick={() =>
                mutate(async () => {
                  await request(`/imports/${lastImport.id}/undo`, "POST");
                  setLastImport(null);
                  setReloads((n) => n + 1);
                })
              }
            >
              Undo
            </button>
            <button className="bg-link" aria-label="Dismiss" onClick={() => setLastImport(null)}>
              ×
            </button>
          </div>
        )}

        {data && (
          <>
            <Equation data={data} onIncome={api.setIncome} />

            <div className="bg-columns">
              <Ledger
                title="Every month"
                kind="recurring"
                month={data.month}
                items={data.recurring}
                labels={data.labels}
                api={api}
                placeholder="Add a monthly expense"
              />
              <Ledger
                title={`Spent in ${monthName(data.month, { month: "long" })}`}
                kind="expenses"
                items={data.expenses}
                labels={data.labels}
                month={data.month}
                api={api}
                placeholder="Add an expense"
              />
            </div>

            <MoneyList items={data.money} month={data.month} onDelete={api.removeMoney} />

            <Labels labels={data.labels} onRename={api.renameLabel} />
          </>
        )}
      </div>

      {importing && data && (
        <ImportStatement
          recurring={data.recurring}
          labels={data.labels}
          request={request}
          onClose={() => setImporting(false)}
          onImported={(result) => {
            setImporting(false);
            setLastImport(result);
            setReloads((n) => n + 1);
          }}
          onUndone={() => {
            setLastImport(null);
            setReloads((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

// ── Deposits & transfers (from imported statements) ───────────────────────────

function MoneyList({ items, month, onDelete }) {
  if (!items?.length) return null;
  const net = items.reduce((s, i) => s + i.amount, 0);
  const signed = (n) => `${n < 0 ? "−" : "+"}${money.format(Math.abs(n))}`;

  return (
    <section className="bg-ledger bg-money">
      <header className="bg-ledger-head">
        <h2>Deposits &amp; transfers in {monthName(month, { month: "long" })}</h2>
        <span className="bg-ledger-total">{signed(net)}</span>
      </header>
      <ul className="bg-rows">
        {items.map((m) => (
          <li key={m.id} className="bg-money-row">
            <span className="bg-date">{shortDate(m.happened_on)}</span>
            <span className="bg-name">
              <span>{m.name}</span>
            </span>
            <button className="bg-link is-danger bg-money-delete" onClick={() => onDelete(m.id)}>
              Delete
            </button>
            <span className="bg-amount">{signed(m.amount)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Summary: a receipt of where the income goes, with a pie chart ────────────

function Equation({ data, onIncome }) {
  const terms = useMemo(() => {
    const totals = Object.fromEntries(COLORS.map((c) => [c, 0]));
    let general = 0;
    for (const item of [...data.recurring, ...data.expenses]) {
      if (item.color) totals[item.color] += share(item);
      else general += share(item);
    }
    const list = data.labels
      .filter((l) => totals[l.color] > 0)
      .map((l) => ({ key: l.color, color: l.color, name: l.name, amount: totals[l.color] }));
    if (general > 0) list.push({ key: "general", color: "general", name: "General spending", amount: general });
    return list;
  }, [data]);

  const spent = terms.reduce((s, t) => s + t.amount, 0);
  const left = data.income - spent;

  const slices = [...terms];
  if (left > 0) slices.push({ key: "left", color: "left", name: "Balance", amount: left });

  return (
    <section className="bg-summary" aria-label="Where your income goes">
      <div className="bg-receipt">
        <div className="bg-receipt-row">
          <span>Income</span>
          <IncomeInput income={data.income} onSave={onIncome} />
        </div>
        {terms.map((t) => (
          <div className="bg-receipt-row" key={t.key}>
            <span className="bg-receipt-name">
              <span className="bg-minus">−</span>
              <span className={`bg-dot c-${t.color}`} />
              {t.name}
            </span>
            <span className="bg-amount">{money.format(t.amount)}</span>
          </div>
        ))}
        <div className="bg-receipt-row bg-receipt-total">
          <span>Balance</span>
          <span className={`bg-amount ${left < 0 ? "is-negative" : ""}`}>{money.format(left)}</span>
        </div>
      </div>

      <SpendingPie slices={slices} />
    </section>
  );
}

const SLICE_COLORS = {
  red: "#e5484d",
  blue: "#3e7be0",
  green: "#2f9e6b",
  orange: "#f0901e",
  pink: "#e45c9c",
  general: "#8e6bd8",
  left: "#e5e5ea",
};

// Pie with a small key showing each slice's share.
function SpendingPie({ slices }) {
  if (!slices.length) return null;
  const total = slices.reduce((sum, x) => sum + x.amount, 0);
  const pct = (n) => {
    const p = (n / total) * 100;
    return p > 0 && p < 1 ? "<1%" : `${Math.round(p)}%`;
  };

  return (
    <div className="bg-chart">
      <PieChart width={180} height={180}>
        <Pie
          data={slices}
          dataKey="amount"
          nameKey="name"
          outerRadius={88}
          startAngle={90}
          endAngle={-270}
          stroke="#f8f8fa"
          strokeWidth={2}
          isAnimationActive={false}
        >
          {slices.map((s) => (
            <Cell key={s.key} fill={SLICE_COLORS[s.color]} />
          ))}
        </Pie>
      </PieChart>

      <ul className="bg-key">
        {slices.map((s) => (
          <li key={s.key}>
            <span className="bg-key-dot" style={{ background: SLICE_COLORS[s.color] }} />
            <span className="bg-key-name">{s.name}</span>
            <span className="bg-key-pct">{pct(s.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function IncomeInput({ income, onSave }) {
  const [value, setValue] = useState(String(income));
  const [focused, setFocused] = useState(false);
  const cancelled = useRef(false);
  useEffect(() => setValue(String(income)), [income]);

  const commit = () => {
    setFocused(false);
    if (cancelled.current) {
      cancelled.current = false;
      return setValue(String(income));
    }
    const n = parseMoney(value);
    if (!Number.isFinite(n) || n < 0) return setValue(String(income));
    if (n !== income) onSave(n);
  };

  const shown = focused ? value : money.format(income);

  return (
    <span className="bg-autosize bg-income" data-value={shown || " "}>
      <input
        aria-label="Monthly income"
        inputMode="decimal"
        value={shown}
        size={1}
        onFocus={(e) => {
          setFocused(true);
          setValue(String(income));
          requestAnimationFrame(() => e.target.select());
        }}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            cancelled.current = true;
            e.currentTarget.blur();
          }
        }}
      />
    </span>
  );
}

// ── Ledger (recurring or this month's expenses) ──────────────────────────────

// Which label groups are collapsed, remembered in this browser.
function useCollapsed(storageKey) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(storageKey)) || []);
    } catch {
      return new Set();
    }
  });

  const toggle = (key) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        // Not remembered; still works for this visit.
      }
      return next;
    });

  return [collapsed, toggle];
}

function Ledger({ title, kind, items, labels, month, api, placeholder }) {
  const [editing, setEditing] = useState(null);
  const withDate = kind === "expenses";
  const total = items.reduce((s, i) => s + share(i), 0);
  const [collapsed, toggle] = useCollapsed(`budget-collapsed-${kind}`);

  // One group per label that has items, then unlabeled items as General.
  const groups = [...labels, { color: null, name: "General" }]
    .map((l) => ({ ...l, key: l.color || "general", items: items.filter((i) => i.color === l.color) }))
    .filter((g) => g.items.length > 0);

  useEffect(() => setEditing(null), [month]);

  return (
    <section className="bg-ledger">
      <header className="bg-ledger-head">
        <h2>{title}</h2>
        <span className="bg-ledger-total">{money.format(total)}</span>
      </header>

      <ul className="bg-rows">
        {groups.map((g) => {
          const open = !collapsed.has(g.key);
          return (
            <li key={g.key} className="bg-group">
              <button
                className={`bg-group-head ${withDate ? "has-date" : ""}`}
                aria-expanded={open}
                onClick={() => toggle(g.key)}
              >
                <span className="bg-group-name">
                  <span className={`bg-chevron ${open ? "is-open" : ""}`} aria-hidden="true">
                    ›
                  </span>
                  <span className={`bg-dot c-${g.key}`} />
                  {g.name}
                  <span className="bg-group-count">{g.items.length}</span>
                </span>
                <span className="bg-amount">{money.format(g.items.reduce((s, i) => s + share(i), 0))}</span>
              </button>

              {open && (
                <ul className="bg-rows bg-group-rows">
                  {g.items.map((item) =>
                    editing === item.id ? (
                      <li key={item.id} className="bg-row-editing">
                        <ItemEditor
                          initial={item}
                          labels={labels}
                          withDate={withDate}
                          submitText="Save"
                          onSubmit={async (v) => (await api.save(kind, v)) && setEditing(null)}
                          onCancel={() => setEditing(null)}
                          onDelete={async () => (await api.remove(kind, item.id)) && setEditing(null)}
                        />
                      </li>
                    ) : (
                      <li key={item.id}>
                        {/* Whole row opens the editor; the name is the keyboard target. */}
                        <div className={`bg-row ${withDate ? "has-date" : ""}`} onClick={() => setEditing(item.id)}>
                          {withDate && <span className="bg-date">{shortDate(item.spent_on)}</span>}
                          <button className="bg-name" onClick={() => setEditing(item.id)}>
                            <span>{item.name}</span>
                          </button>
                          {isSplit(item) ? (
                            <label className="bg-paid" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={item.paid_back}
                                onChange={() =>
                                  kind === "recurring"
                                    ? api.setRecurringPaid(item.id, !item.paid_back)
                                    : api.save(kind, { ...item, paid_back: !item.paid_back })
                                }
                              />
                              Paid back
                            </label>
                          ) : (
                            <span />
                          )}
                          <span className="bg-amount">
                            {money.format(share(item))}
                            {isSplit(item) && <span className="bg-full"> ({money.format(item.amount)})</span>}
                          </span>
                        </div>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </li>
          );
        })}
        <li className="bg-row-new">
          <ItemEditor
            key={`new-${month}`}
            initial={{ name: "", amount: "", color: null, ...(withDate && { spent_on: defaultDate(month) }) }}
            labels={labels}
            withDate={withDate}
            placeholder={placeholder}
            submitText="Add"
            resetAfterSubmit
            onSubmit={(v) => api.save(kind, v)}
          />
        </li>
      </ul>
    </section>
  );
}

function ItemEditor({ initial, labels, withDate, placeholder, submitText, resetAfterSubmit, onSubmit, onCancel, onDelete }) {
  const blank = useRef({
    ...initial,
    amount: String(initial.amount),
    split: isSplit(initial),
    split_back: isSplit(initial) ? String(initial.split_back) : "",
    paid_back: !!initial.paid_back,
  });
  const [form, setForm] = useState(blank.current);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef(null);
  const formRef = useRef(null);

  // When editing a row, clicking anywhere outside it closes the editor without saving.
  useEffect(() => {
    if (!onCancel) return;
    const close = (e) => !formRef.current?.contains(e.target) && onCancel();
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [onCancel]);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const check = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.checked }));

  const amount = parseMoney(form.amount);
  const back = parseMoney(form.split_back);
  const splitValid = !form.split || (Number.isFinite(back) && back >= 0 && back <= amount);
  const valid = form.name.trim() && Number.isFinite(amount) && amount >= 0 && splitValid;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    const { split, ...rest } = form;
    const ok = await onSubmit({
      ...rest,
      amount,
      split_back: split ? back : null,
      ...(withDate && { paid_back: split && form.paid_back }),
    });
    setBusy(false);
    if (ok && resetAfterSubmit) {
      // Keep the date and label so several similar entries go in quickly.
      setForm((f) => ({ ...blank.current, color: f.color, spent_on: f.spent_on }));
      nameRef.current?.focus();
    }
  };

  const onKeyDown = (e) => {
    if (e.key !== "Escape") return;
    if (onCancel) onCancel();
    else setForm(blank.current);
  };

  return (
    <form
      ref={formRef}
      className={`bg-editor ${withDate ? "has-date" : ""} ${onDelete ? "is-editing" : ""}`}
      onSubmit={submit}
      onKeyDown={onKeyDown}
    >
      {withDate && (
        <input className="bg-input" type="date" value={form.spent_on} onChange={set("spent_on")} aria-label="Date" />
      )}
      <input
        ref={nameRef}
        className="bg-input"
        placeholder={placeholder || "Name"}
        value={form.name}
        onChange={set("name")}
        autoFocus={!resetAfterSubmit}
        aria-label="Name"
      />
      <select
        className="bg-input"
        value={form.color || ""}
        onChange={(e) => setForm((f) => ({ ...f, color: e.target.value || null }))}
        aria-label="Label"
      >
        <option value="">General</option>
        {labels.map((l) => (
          <option key={l.color} value={l.color}>
            {l.name}
          </option>
        ))}
      </select>
      <input
        className="bg-input bg-input-amount"
        inputMode="decimal"
        placeholder="$0.00"
        value={form.amount}
        onChange={set("amount")}
        aria-label="Amount"
      />
      <span className="bg-editor-actions">
        <button className="bg-btn" disabled={!valid || busy}>
          {submitText}
        </button>
        {onDelete && (
          <button type="button" className="bg-link is-danger" onClick={onDelete}>
            Delete
          </button>
        )}
        <MoreMenu
          items={[
            {
              label: form.split ? "Remove split" : "Split expense",
              onSelect: () => setForm((f) => ({ ...f, split: !f.split })),
            },
          ]}
        />
      </span>

      {form.split && (
        <div className="bg-split">
          <label>
            Getting back
            <input
              className="bg-input bg-input-amount bg-input-back"
              inputMode="decimal"
              placeholder="$0.00"
              value={form.split_back}
              onChange={set("split_back")}
              autoFocus={!blank.current.split}
              aria-label="Amount getting back"
            />
          </label>
          {/* Recurring items are marked paid back per month, from the row. */}
          {withDate && (
            <label>
              <input type="checkbox" checked={form.paid_back} onChange={check("paid_back")} />
              Paid back
            </label>
          )}
          {form.split_back !== "" && !splitValid && <span className="bg-error">Can't be more than the total.</span>}
        </div>
      )}
    </form>
  );
}

// "⋯" button with a small menu of extra actions.
function MoreMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <span
      className="bg-more"
      ref={ref}
      onKeyDown={(e) => {
        // Escape closes the menu without cancelling the edit.
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="bg-more-btn"
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        ⋯
      </button>
      {open && (
        <div className="bg-menu" role="menu">
          {items.map((item) => (
            <button
              type="button"
              role="menuitem"
              key={item.label}
              onClick={() => {
                item.onSelect();
                setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

// ── Labels ────────────────────────────────────────────────────────────────────

function Labels({ labels, onRename }) {
  return (
    <section className="bg-labels">
      <h2>Labels</h2>
      <div className="bg-label-list">
        {labels.map((l) => (
          <LabelName key={l.color} label={l} onRename={onRename} />
        ))}
      </div>
    </section>
  );
}

function LabelName({ label, onRename }) {
  const [name, setName] = useState(label.name);
  useEffect(() => setName(label.name), [label.name]);

  const commit = () => {
    const n = name.trim();
    if (!n) return setName(label.name);
    if (n !== label.name) onRename(label.color, n);
  };

  return (
    <label className="bg-label-item">
      <span className={`bg-dot c-${label.color}`} />
      {/* The hidden copy of the text sets the width, so the box fits the name exactly. */}
      <span className="bg-autosize" data-value={name || " "}>
        <input
          value={name}
          maxLength={40}
          size={1}
          aria-label={`Rename ${label.color} label`}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
      </span>
    </label>
  );
}

export default Budget;
