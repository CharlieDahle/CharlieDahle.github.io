import { useEffect, useState } from "react";
import { readPdf, parseStatement, toBudgetItems } from "./chaseStatement";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const cents = (n) => Math.round(n * 100);

function shortDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function longDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Words that say nothing about which merchant it is.
const FILLER = new Set(["the", "inc", "llc", "store", "com", "card", "payment", "purchase", "and", "monthly", "subscription"]);
const words = (s) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !FILLER.has(w));
const namesMatch = (a, b) => {
  const wa = words(a);
  return words(b).some((w) => wa.includes(w));
};

// Picks the recurring item a charge most likely belongs to, or null.
function findRecurring(charge, rule, recurring) {
  if (rule) {
    // You've imported this merchant before; trust that choice.
    return recurring.some((r) => r.id === rule.recurring_id) ? rule.recurring_id : null;
  }
  const byName = recurring.filter((r) => namesMatch(r.name, charge.name));
  const exact = byName.find((r) => cents(r.amount) === cents(charge.amount));
  if (exact) return exact.id;
  if (charge.chaseRecurring) {
    const sameAmount = recurring.filter((r) => cents(r.amount) === cents(charge.amount));
    if (sameAmount.length === 1) return sameAmount[0].id;
  }
  return byName.length === 1 ? byName[0].id : null;
}

export default function ImportStatement({ recurring, labels, request, onImported, onUndone, onClose }) {
  const [phase, setPhase] = useState("pick"); // pick → reading → review → saving
  const [error, setError] = useState(null);
  const [statement, setStatement] = useState(null);
  const [rows, setRows] = useState([]); // expenses and recurring charges
  const [deposits, setDeposits] = useState([]);
  const [skipped, setSkipped] = useState(0);
  const [past, setPast] = useState([]);
  const [confirming, setConfirming] = useState(null);

  useEffect(() => {
    request("/imports")
      .then((r) => setPast(r.imports))
      .catch(() => {});
  }, [request]);

  const undo = async (id) => {
    setError(null);
    try {
      await request(`/imports/${id}/undo`, "POST");
      setPast((p) => p.filter((i) => i.id !== id));
      setConfirming(null);
      onUndone();
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && phase !== "saving" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [phase, onClose]);

  const read = async (file) => {
    if (!file) return;
    setError(null);
    setPhase("reading");
    try {
      const st = parseStatement(await readPdf(file));
      const items = await toBudgetItems(st);
      const all = [...items.expenses, ...items.money];
      const preview = await request("/import/preview", "POST", { fingerprints: all.flatMap((i) => i.fingerprints) });

      const done = new Set(preview.imported);
      const isDone = (i) => i.fingerprints.every((f) => done.has(f));
      const rules = new Map(preview.rules.map((r) => [r.merchant, r]));

      setSkipped(all.filter(isDone).length);
      setStatement(st);
      setRows(
        items.expenses
          .filter((e) => !isDone(e))
          .map((e, i) => {
            const rule = rules.get(e.merchant);
            return {
              ...e,
              key: `e${i}`,
              include: true,
              name: rule?.name || e.name,
              color: rule?.color || null,
              recurringId: findRecurring(e, rule, recurring),
              resolve: "keep",
            };
          }),
      );
      setDeposits(items.money.filter((m) => !isDone(m)).map((m, i) => ({ ...m, key: `m${i}`, include: true })));
      setPhase("review");
    } catch (e) {
      console.error(e);
      setError(e.message || "Couldn't read that file.");
      setPhase("pick");
    }
  };

  const update = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const updateDeposit = (key, patch) => setDeposits((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const recurringFor = (row) => recurring.find((r) => r.id === row.recurringId);

  const charges = rows.filter((r) => recurringFor(r));
  const expenses = rows.filter((r) => !recurringFor(r));
  const unlabeled = expenses.filter((r) => r.include && !r.color).length;

  // Everything the import will save, built from the choices on screen.
  const plan = () => {
    const out = {
      label: `${longDate(statement.start)} to ${longDate(statement.end)}`,
      expenses: [],
      money: [],
      recurringUpdates: [],
      rules: [],
      fingerprints: [],
    };
    out.fingerprints = [...rows, ...deposits].flatMap((r) => r.fingerprints);

    for (const row of rows) {
      const rec = recurringFor(row);
      const expense = { name: row.name.trim(), amount: row.amount, color: row.color, spent_on: row.date };
      if (rec) {
        const diff = cents(row.amount) - cents(rec.amount);
        if (diff !== 0 && row.resolve === "update") out.recurringUpdates.push({ id: rec.id, amount: row.amount });
        if (diff > 0 && row.resolve === "extra") {
          out.expenses.push({ ...expense, name: `${rec.name} (extra)`, amount: diff / 100, color: rec.color });
        }
        if (row.resolve === "separate") out.expenses.push(expense);
        out.rules.push({
          merchant: row.merchant,
          name: expense.name,
          color: row.color,
          recurring_id: row.resolve === "separate" ? null : rec.id,
        });
      } else if (row.include) {
        out.expenses.push(expense);
        out.rules.push({ merchant: row.merchant, name: expense.name, color: row.color, recurring_id: null });
      }
    }
    for (const d of deposits) {
      if (d.include) out.money.push({ name: d.name.trim(), amount: d.amount, happened_on: d.date });
    }
    return out;
  };

  const save = async () => {
    setError(null);
    setPhase("saving");
    try {
      onImported(await request("/import", "POST", plan()));
    } catch (e) {
      setError(e.message);
      setPhase("review");
    }
  };

  const counts = (() => {
    if (phase !== "review" && phase !== "saving") return null;
    const p = plan();
    return { expenses: p.expenses.length, money: p.money.length };
  })();

  return (
    <div className="bg-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && phase !== "saving" && onClose()}>
      <div className="bg-modal" role="dialog" aria-modal="true" aria-labelledby="bg-import-title">
        <header className="bg-modal-head">
          <h2 id="bg-import-title">Import a Chase statement</h2>
          <button className="bg-link" onClick={onClose} disabled={phase === "saving"}>
            Close
          </button>
        </header>

        {(phase === "pick" || phase === "reading") && (
          <div className="bg-import-pick">
            <label className="bg-btn bg-file-btn">
              {phase === "reading" ? "Reading…" : "Choose statement PDF"}
              <input
                type="file"
                accept="application/pdf"
                disabled={phase === "reading"}
                onChange={(e) => read(e.target.files[0])}
              />
            </label>
            {error && <p className="bg-error">{error}</p>}

            {past.length > 0 && (
              <section className="bg-import-section bg-past">
                <h3>Past imports</h3>
                {past.map((i) => (
                  <div className="bg-past-row" key={i.id}>
                    <span>{i.label}</span>
                    <span className="bg-quiet">
                      {i.expenses + i.money} items, imported{" "}
                      {new Date(i.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    {confirming === i.id ? (
                      <span className="bg-past-confirm">
                        <span className="bg-quiet">Remove everything it added?</span>
                        <button className="bg-link is-danger" onClick={() => undo(i.id)}>
                          Undo import
                        </button>
                        <button className="bg-link" onClick={() => setConfirming(null)}>
                          Keep
                        </button>
                      </span>
                    ) : (
                      <button className="bg-link" onClick={() => setConfirming(i.id)}>
                        Undo
                      </button>
                    )}
                  </div>
                ))}
              </section>
            )}
          </div>
        )}

        {(phase === "review" || phase === "saving") && (
          <>
            <div className="bg-modal-body">
              <p className="bg-import-summary">
                {longDate(statement.start)} to {longDate(statement.end)}: {statement.count} transactions
                {statement.verified ? (
                  <span className="bg-quiet">, and every line adds up to the statement's balances.</span>
                ) : (
                  <span className="bg-error">. Some lines don't add up to the statement's balances, so check the amounts.</span>
                )}
                {skipped > 0 && <span className="bg-quiet"> {skipped} already imported and skipped.</span>}
              </p>

              {charges.length > 0 && (
                <section className="bg-import-section">
                  <h3>Recurring charges</h3>
                  <p className="bg-quiet">These are already counted by your monthly expenses, so they won't be added again.</p>
                  {charges.map((row) => {
                    const rec = recurringFor(row);
                    const diff = cents(row.amount) - cents(rec.amount);
                    return (
                      <div className="bg-import-row is-charge" key={row.key}>
                        <span className="bg-date">{shortDate(row.date)}</span>
                        <span className="bg-import-name">{row.name}</span>
                        <select
                          className="bg-input"
                          value={row.recurringId}
                          aria-label="Recurring expense"
                          onChange={(e) => update(row.key, { recurringId: e.target.value ? Number(e.target.value) : null })}
                        >
                          {recurring.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                          <option value="">Not recurring</option>
                        </select>
                        <span className="bg-amount">{money.format(row.amount)}</span>
                        {diff === 0 ? (
                          <span className="bg-quiet">Matches</span>
                        ) : (
                          <select
                            className="bg-input"
                            value={row.resolve}
                            aria-label="What to do about the different amount"
                            onChange={(e) => update(row.key, { resolve: e.target.value })}
                          >
                            <option value="keep">Keep {money.format(rec.amount)}{diff > 0 ? ", ignore the rest" : ""}</option>
                            {diff > 0 && <option value="extra">Keep {money.format(rec.amount)}, add the extra {money.format(diff / 100)}</option>}
                            <option value="update">Change recurring to {money.format(row.amount)}</option>
                            <option value="separate">Add as its own expense</option>
                          </select>
                        )}
                      </div>
                    );
                  })}
                </section>
              )}

              <section className="bg-import-section">
                <h3>
                  Expenses
                  {unlabeled > 0 && <span className="bg-quiet bg-h3-note">{unlabeled} without a label</span>}
                </h3>
                {expenses.length === 0 && <p className="bg-quiet">No new expenses.</p>}
                {expenses.map((row) => (
                  <div className={`bg-import-row ${row.include ? "" : "is-off"}`} key={row.key}>
                    <input
                      type="checkbox"
                      checked={row.include}
                      aria-label={`Import ${row.name}`}
                      onChange={(e) => update(row.key, { include: e.target.checked })}
                    />
                    <span className="bg-date">{shortDate(row.date)}</span>
                    <input
                      className="bg-input"
                      value={row.name}
                      aria-label="Name"
                      onChange={(e) => update(row.key, { name: e.target.value })}
                    />
                    <select
                      className={`bg-input ${row.color ? "" : "is-unlabeled"}`}
                      value={row.color || ""}
                      aria-label="Label"
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v.startsWith("r:")) update(row.key, { recurringId: Number(v.slice(2)) });
                        else update(row.key, { color: v || null });
                      }}
                    >
                      <option value="">General</option>
                      {labels.map((l) => (
                        <option key={l.color} value={l.color}>
                          {l.name}
                        </option>
                      ))}
                      {recurring.length > 0 && (
                        <optgroup label="It's a recurring expense">
                          {recurring.map((r) => (
                            <option key={r.id} value={`r:${r.id}`}>
                              {r.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <span className="bg-amount">{money.format(row.amount)}</span>
                  </div>
                ))}
              </section>

              {deposits.length > 0 && (
                <section className="bg-import-section">
                  <h3>Deposits &amp; transfers</h3>
                  {deposits.map((d) => (
                    <div className={`bg-import-row is-money ${d.include ? "" : "is-off"}`} key={d.key}>
                      <input
                        type="checkbox"
                        checked={d.include}
                        aria-label={`Import ${d.name}`}
                        onChange={(e) => updateDeposit(d.key, { include: e.target.checked })}
                      />
                      <span className="bg-date">{shortDate(d.date)}</span>
                      <input
                        className="bg-input"
                        value={d.name}
                        aria-label="Name"
                        onChange={(e) => updateDeposit(d.key, { name: e.target.value })}
                      />
                      <span className="bg-amount">
                        {d.amount > 0 ? "+" : "−"}
                        {money.format(Math.abs(d.amount))}
                      </span>
                    </div>
                  ))}
                </section>
              )}
            </div>

            <footer className="bg-modal-foot">
              {error && <span className="bg-error">{error}</span>}
              <span className="bg-spacer" />
              <button className="bg-btn" onClick={save} disabled={phase === "saving" || rows.some((r) => !r.name.trim())}>
                {phase === "saving"
                  ? "Importing…"
                  : `Import ${counts.expenses + counts.money} item${counts.expenses + counts.money === 1 ? "" : "s"}`}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
