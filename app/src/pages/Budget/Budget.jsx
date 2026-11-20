import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../../stores";
import { Cell, Pie, PieChart } from "recharts";
import ImportStatement from "./ImportStatement";
import SignIn from "./SignIn";
import { colorOf, FAMILIES, GENERAL_COLOR } from "./palette";
import "./Budget.css";

const API = `${import.meta.env.VITE_API_URL || "https://api.charliedahle.me"}/api/budget`;
// Who can use the budget; each person has their own. The server checks this too.
const BUDGET_USERS = ["charlie"];

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

  if (!token || !BUDGET_USERS.includes(user?.username)) {
    return <SignIn title="Budget" allowed={BUDGET_USERS} signedInAs={token ? user?.username : null} onSwitch={logout} />;
  }

  return <BudgetApp token={token} onSignOut={logout} />;
}

// ── Budget ────────────────────────────────────────────────────────────────────

function BudgetApp({ token, onSignOut }) {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [reloads, setReloads] = useState(0);
  const [lastImport, setLastImport] = useState(null);
  const [deletedCategory, setDeletedCategory] = useState(null); // what the last delete held, for Undo

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
    setPaycheckReceived: (date, received) =>
      mutate(async () => {
        await request(`/paychecks/${date}`, "PUT", { received });
        setData((d) => ({
          ...d,
          paychecks: d.paychecks.map((p) => (p.date === date ? { ...p, received } : p)),
        }));
      }),
    addCategory: (name) =>
      mutate(async () => {
        const r = await request("/categories", "POST", { name });
        setData((d) => ({ ...d, categories: [...d.categories, r] }));
      }),
    renameCategory: (id, name) =>
      mutate(async () => {
        const r = await request(`/categories/${id}`, "PUT", { name });
        setData((d) => ({ ...d, categories: d.categories.map((c) => (c.id === id ? r : c)) }));
      }),
    recolorCategory: (id, color) =>
      mutate(async () => {
        const r = await request(`/categories/${id}`, "PUT", { color });
        setData((d) => ({ ...d, categories: d.categories.map((c) => (c.id === id ? r : c)) }));
      }),
    deleteCategory: (id) =>
      mutate(async () => {
        setDeletedCategory(await request(`/categories/${id}`, "DELETE"));
        // Its expenses become General.
        const clear = (list) => list.map((x) => (x.category_id === id ? { ...x, category_id: null } : x));
        setData((d) => ({
          ...d,
          categories: d.categories.filter((c) => c.id !== id),
          recurring: clear(d.recurring),
          expenses: clear(d.expenses),
        }));
      }),
    undoDeleteCategory: () =>
      mutate(async () => {
        await request("/categories/restore", "POST", deletedCategory);
        setDeletedCategory(null);
        setReloads((n) => n + 1);
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
            <Equation data={data} onIncome={api.setIncome} onReceived={api.setPaycheckReceived} />

            <div className="bg-columns">
              <Ledger
                title="Every month"
                kind="recurring"
                month={data.month}
                items={data.recurring}
                categories={data.categories}
                api={api}
                placeholder="Add a monthly expense"
              />
              <Ledger
                title={`Spent in ${monthName(data.month, { month: "long" })}`}
                kind="expenses"
                items={data.expenses}
                categories={data.categories}
                month={data.month}
                api={api}
                placeholder="Add an expense"
              />
            </div>

            <MoneyList items={data.money} month={data.month} onDelete={api.removeMoney} />

            <Categories
              categories={data.categories}
              deleted={deletedCategory?.category}
              onDismiss={() => setDeletedCategory(null)}
              api={api}
            />
          </>
        )}
      </div>

      {importing && data && (
        <ImportStatement
          recurring={data.recurring}
          categories={data.categories}
          request={request}
          onCategoryAdded={(c) => setData((d) => ({ ...d, categories: [...d.categories, c] }))}
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

function Equation({ data, onIncome, onReceived }) {
  const terms = useMemo(() => {
    const totals = new Map();
    let general = 0;
    for (const item of [...data.recurring, ...data.expenses]) {
      if (item.category_id) totals.set(item.category_id, (totals.get(item.category_id) || 0) + share(item));
      else general += share(item);
    }
    const list = data.categories
      .filter((c) => totals.get(c.id) > 0)
      .map((c) => ({ key: c.id, color: colorOf(c), name: c.name, amount: totals.get(c.id) }));
    if (general > 0) list.push({ key: "general", color: GENERAL_COLOR, name: "General spending", amount: general });
    return list;
  }, [data]);

  const spent = terms.reduce((s, t) => s + t.amount, 0);
  const left = data.income - spent;

  const slices = [...terms];
  if (left > 0) slices.push({ key: "left", color: BALANCE_COLOR, name: "Balance", amount: left });

  return (
    <section className="bg-summary" aria-label="Where your income goes">
      <div className="bg-receipt">
        <div className="bg-receipt-row">
          <span>Income</span>
          {/* Months with paychecks add them up; any other month takes a typed amount. */}
          {data.paychecks?.length ? (
            <span className="bg-amount">{money.format(data.income)}</span>
          ) : (
            <IncomeInput income={data.income} onSave={onIncome} />
          )}
        </div>
        {data.paychecks?.map((p) => (
          <div className={`bg-receipt-row bg-paycheck ${p.received ? "is-received" : ""}`} key={p.date}>
            <label className="bg-paid">
              <input type="checkbox" checked={p.received} onChange={() => onReceived(p.date, !p.received)} />
              Paycheck, {shortDate(p.date)}
              {!p.received && <span className="bg-quiet"> (not received yet)</span>}
            </label>
            <span className="bg-amount">{money.format(p.amount)}</span>
          </div>
        ))}
        {terms.map((t) => (
          <div className="bg-receipt-row" key={t.key}>
            <span className="bg-receipt-name">
              <span className="bg-minus">−</span>
              <span className="bg-dot" style={{ background: t.color }} />
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

const BALANCE_COLOR = "#e5e5ea";

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
            <Cell key={s.key} fill={s.color} />
          ))}
        </Pie>
      </PieChart>

      <ul className="bg-key">
        {slices.map((s) => (
          <li key={s.key}>
            <span className="bg-key-dot" style={{ background: s.color }} />
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

// Which category groups you have opened (all start collapsed), remembered in this browser.
function useExpanded(storageKey) {
  const [expanded, setExpanded] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(storageKey)) || []);
    } catch {
      return new Set();
    }
  });

  const toggle = (key) =>
    setExpanded((prev) => {
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

  return [expanded, toggle];
}

function Ledger({ title, kind, items, categories, month, api, placeholder }) {
  const [editing, setEditing] = useState(null);
  const withDate = kind === "expenses";
  const total = items.reduce((s, i) => s + share(i), 0);
  const [expanded, toggle] = useExpanded(`budget-expanded-${kind}`);

  // One group per category that has items, then the rest as General.
  const groups = [...categories, { id: null, name: "General" }]
    .map((c) => ({
      name: c.name,
      color: colorOf(c.id && c),
      key: c.id ? `c${c.id}` : "general",
      items: items.filter((i) => (i.category_id ?? null) === c.id),
    }))
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
          const open = expanded.has(g.key);
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
                  <span className="bg-dot" style={{ background: g.color }} />
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
                          categories={categories}
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
            initial={{ name: "", amount: "", category_id: null, ...(withDate && { spent_on: defaultDate(month) }) }}
            categories={categories}
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

function ItemEditor({ initial, categories, withDate, placeholder, submitText, resetAfterSubmit, onSubmit, onCancel, onDelete }) {
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
      // Keep the date and category so several similar entries go in quickly.
      setForm((f) => ({ ...blank.current, category_id: f.category_id, spent_on: f.spent_on }));
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
        value={form.category_id ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value ? Number(e.target.value) : null }))}
        aria-label="Category"
      >
        <option value="">General</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
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
        className="bg-link"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        More
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

// ── Categories ────────────────────────────────────────────────────────────────

function Categories({ categories, deleted, onDismiss, api }) {
  return (
    <section className="bg-categories">
      <header className="bg-ledger-head">
        <h2>Categories</h2>
      </header>
      {deleted && (
        <div className="bg-notice bg-category-notice">
          <span>Deleted {deleted.name}. Its expenses moved to General.</span>
          <button className="bg-link" onClick={api.undoDeleteCategory}>
            Undo
          </button>
          <button className="bg-link" aria-label="Dismiss" onClick={onDismiss}>
            ×
          </button>
        </div>
      )}
      <ul className="bg-category-grid">
        {categories.map((c) => (
          <CategoryItem key={c.id} category={c} categories={categories} api={api} />
        ))}
        <li>
          <NewCategory onAdd={api.addCategory} />
        </li>
      </ul>
    </section>
  );
}

function CategoryItem({ category, categories, api }) {
  const [name, setName] = useState(category.name);
  useEffect(() => setName(category.name), [category.name]);

  const commit = () => {
    const n = name.trim();
    if (!n) return setName(category.name);
    if (n !== category.name) api.renameCategory(category.id, n);
  };

  return (
    <li className="bg-category">
      <ColorPicker
        category={category}
        categories={categories}
        onPick={(color) => api.recolorCategory(category.id, color)}
      />
      {/* Built-in names are fixed: the shared merchant list relies on what they mean. */}
      {category.builtin ? (
        <span className="bg-category-name">{category.name}</span>
      ) : (
        <input
          className="bg-category-name"
          value={name}
          maxLength={40}
          aria-label={`Rename ${category.name}`}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setName(category.name);
              requestAnimationFrame(() => e.target.blur());
            }
          }}
        />
      )}
      {/* Built-in and original label categories stay; ones you added can be deleted (with Undo). */}
      {!category.builtin && !category.label_color && (
        <button className="bg-link is-danger bg-category-delete" onClick={() => api.deleteCategory(category.id)}>
          Delete
        </button>
      )}
    </li>
  );
}

// The category's dot; click it to pick from a set of colors. Each color can
// belong to only one category, so ones already in use can't be picked.
function ColorPicker({ category, categories, onPick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <span className="bg-color" ref={ref} onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      <button
        type="button"
        className="bg-color-btn"
        aria-label={`Change the color of ${category.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="bg-dot" style={{ background: colorOf(category) }} />
      </button>
      {open && (
        <div className="bg-swatches" role="menu">
          {FAMILIES.flat().map(([key, hex]) => {
            const owner = categories.find((c) => c.color === key && c.id !== category.id);
            return (
              <button
                type="button"
                key={key}
                role="menuitemradio"
                aria-checked={key === category.color}
                aria-label={owner ? `${key}, used by ${owner.name}` : key}
                title={owner ? `Used by ${owner.name}` : undefined}
                disabled={!!owner}
                className={`bg-swatch ${key === category.color ? "is-current" : ""}`}
                style={{ background: hex }}
                onClick={() => {
                  if (key !== category.color) onPick(key);
                  setOpen(false);
                }}
              />
            );
          })}
        </div>
      )}
    </span>
  );
}

function NewCategory({ onAdd }) {
  const [name, setName] = useState("");

  const add = async (e) => {
    e.preventDefault();
    const n = name.trim();
    if (n && (await onAdd(n))) setName("");
  };

  return (
    <form onSubmit={add}>
      <input
        className="bg-input"
        value={name}
        maxLength={40}
        placeholder="Add a category"
        aria-label="Add a category"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setName("")}
      />
    </form>
  );
}

export default Budget;
