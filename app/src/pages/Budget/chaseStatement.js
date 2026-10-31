// Reads a Chase checking statement PDF into a list of transactions.
//
// The PDF is read in the browser; nothing about it is sent anywhere. The parser
// checks itself against the statement's running balance, so a misread line is
// reported instead of silently imported.

// ── PDF → positioned text ─────────────────────────────────────────────────────

export async function readPdf(file) {
  const pdfjs = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const { items } = await page.getTextContent();
    pages.push(items.map((it) => ({ x: it.transform[4], y: it.transform[5], s: it.str })));
  }
  return pages;
}

// ── Positioned text → transactions ────────────────────────────────────────────

// Column positions on Chase statements (PDF points from the left edge).
const DATE_MAX_X = 60;
const AMOUNT_MIN_X = 400;
const BALANCE_MIN_X = 480;

const DATE_RE = /^\d{2}\/\d{2}$/;

function toRows(items) {
  const rows = [];
  for (const it of items) {
    if (!it.s.trim()) continue;
    let row = rows.find((r) => Math.abs(r.y - it.y) <= 2);
    if (!row) rows.push((row = { y: it.y, items: [] }));
    row.items.push(it);
  }
  rows.sort((a, b) => b.y - a.y);
  for (const r of rows) {
    r.items.sort((a, b) => a.x - b.x);
    r.text = r.items.map((i) => i.s.trim()).join(" ");
  }
  return rows;
}

const parseAmount = (s) => Number(s.replace(/[\s,$]/g, ""));

export function parseStatement(pages) {
  const allRows = pages.flatMap(toRows);
  const allText = allRows.map((r) => r.text).join("\n");

  const period = allText.match(/([A-Z][a-z]+ \d{1,2}, \d{4}) through ([A-Z][a-z]+ \d{1,2}, \d{4})/);
  if (!period) throw new Error("This doesn't look like a Chase checking statement.");
  const start = new Date(period[1]);
  const end = new Date(period[2]);

  const begin = allText.match(/Beginning Balance \$?(-?[\d,]+\.\d{2})/);
  const ending = allText.match(/Ending Balance \$?(-?[\d,]+\.\d{2})/);

  // Collect transactions from the "transaction detail" sections.
  const lines = [];
  for (const page of pages) {
    let inside = false;
    let current = null;
    for (const row of toRows(page)) {
      if (row.text.includes("*start*transaction detail")) {
        inside = true;
        continue;
      }
      if (row.text.includes("*end*transaction detail")) {
        inside = false;
        current = null;
        continue;
      }
      if (!inside) continue;

      const first = row.items[0];
      const desc = row.items.filter((i) => i.x > DATE_MAX_X && i.x < AMOUNT_MIN_X).map((i) => i.s.trim()).join(" ");
      const amount = row.items.find((i) => i.x >= AMOUNT_MIN_X && i.x < BALANCE_MIN_X);
      const balance = row.items.find((i) => i.x >= BALANCE_MIN_X);

      if (first.x < DATE_MAX_X && DATE_RE.test(first.s.trim())) {
        current = { posted: first.s.trim(), raw: desc, amount: null, balance: null };
        lines.push(current);
      } else if (current && !/^(Beginning|Ending) Balance/.test(desc)) {
        current.raw += " " + desc;
      } else {
        continue;
      }
      if (amount && current.amount === null) current.amount = parseAmount(amount.s);
      if (balance && current.balance === null) current.balance = parseAmount(balance.s);
    }
  }

  // Check every line against the running balance.
  let running = begin ? parseAmount(begin[1]) : null;
  let mismatches = 0;
  for (const l of lines) {
    if (l.amount === null || Number.isNaN(l.amount)) {
      mismatches++;
      continue;
    }
    if (running !== null) {
      running = Math.round((running + l.amount) * 100) / 100;
      if (l.balance !== null && Math.abs(running - l.balance) > 0.005) {
        mismatches++;
        running = l.balance; // resync so one bad line isn't counted repeatedly
      }
    }
  }
  const endsRight = ending && running !== null && Math.abs(running - parseAmount(ending[1])) < 0.005;

  return {
    start: isoDate(start),
    end: isoDate(end),
    count: lines.length,
    verified: Boolean(begin && ending && mismatches === 0 && endsRight),
    transactions: lines.map((l) => ({ ...l, posted: withYear(l.posted, end) })),
  };
}

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "09/28" → "2026-09-28", using the statement's end date to pick the year.
function withYear(mmdd, end) {
  const [m, d] = mmdd.split("/").map(Number);
  let year = end.getFullYear();
  if (new Date(year, m - 1, d) > new Date(end.getTime() + 7 * 864e5)) year--;
  return isoDate(new Date(year, m - 1, d));
}

// ── Transactions → what the budget imports ────────────────────────────────────

const STATES =
  /^(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC|On|ON|BC|QC)$/;

// Turns "Card Purchase With Pin 09/23 Trader Joe S #69 44 E. Chicago IL Card 1279"
// into "Trader Joe's".
export function cleanMerchant(text) {
  let s = text
    .replace(/\bCard \d{4}\b.*$/, "") // card number and anything after (exchange-rate details)
    .replace(/\s+/g, " ")
    .trim();

  // Square / Toast style prefixes: "Sq *Loaves & Witches"
  s = s.replace(/^(Sq|Tst|Sp|Pp|Py)\s?\*\s?/i, "");
  // "Anthropic* Claude Su ..." / "Uber *Trip ..." → the part before the star
  if (s.includes("*")) s = s.split("*")[0];
  // Store numbers, phone numbers and reference codes end the name.
  s = s.split(/#|\s(?:[A-Z]-?\d+|\d{3,}\S*|\d{3}-\d{3}-\d{4})(?:\s|$)/)[0];

  let words = s.split(" ").filter(Boolean);
  // Leading store numbers: "10583 Cava" → "Cava"
  while (words.length > 1 && /^\d+$/.test(words[0])) words.shift();
  // Reference codes glued to a word end the name: "Nintendo CD1573078468", "Air00102849963"
  const ref = words.findIndex((w) => /\d{5,}/.test(w));
  if (ref > 0) {
    const lead = words[ref].replace(/\d.*$/, "");
    words = [...words.slice(0, ref), ...(lead.length > 2 ? [lead] : [])];
  }
  // Web addresses: keep the site name if it leads, otherwise drop it.
  words = words
    .filter((w, i) => i === 0 || !/^www\./i.test(w))
    .map((w, i) => {
      if (!/\.(com|ai|net|org|io|co)\b/i.test(w)) return w;
      if (i > 0) return null;
      const base = w.replace(/^www\./i, "").split(/[./]/)[0];
      return base.charAt(0).toUpperCase() + base.slice(1);
    })
    .filter(Boolean);
  // Trailing "City ST": drop the state, and the city if there's a name left.
  if (words.length > 1 && STATES.test(words[words.length - 1])) {
    words.pop();
    if (words.length > 1) words.pop();
  }
  s = words.join(" ").replace(/[\s,-]+$/, "");
  // "Trader Joe S" → "Trader Joe's"
  s = s.replace(/\b([A-Z][a-z]+) S\b/g, "$1's");
  return s || text.trim();
}

// Name and kind for one statement line.
function describe(t) {
  const raw = t.raw.replace(/\s+/g, " ").trim();
  let m;

  if (/^Foreign Exch Rt ADJ Fee/.test(raw)) {
    return { kind: "fxfee", name: cleanMerchant(raw.replace(/^Foreign Exch Rt ADJ Fee (\d{2}\/\d{2} )?/, "")) };
  }
  if ((m = raw.match(/^(?:\d{2}\/\d{2} )?Online Transfer (To|From) Chk (\.\.\.\d+)/))) {
    return { kind: "money", name: `Transfer ${m[1].toLowerCase()} checking ${m[2]}` };
  }
  if (t.amount > 0) {
    if (/^Remote Online Deposit/.test(raw)) return { kind: "money", name: "Mobile deposit" };
    if (/^Venmo Cashout/.test(raw)) return { kind: "money", name: "Venmo cashout" };
    if (/Refund$/.test(raw) || /^CR Due To/.test(raw)) return { kind: "money", name: "Refund from Chase" };
    if ((m = raw.match(/^Card Purchase Return (?:\d{2}\/\d{2} )?(.*)/))) {
      return { kind: "money", name: `Refund from ${cleanMerchant(m[1])}` };
    }
    return { kind: "money", name: raw.replace(/\s(PPD|Web) ID:.*$/, "").trim() };
  }

  if (/^Non-Chase ATM Fee/.test(raw)) return { kind: "expense", name: "ATM fee" };
  // Payments to people (share: false) never count toward the shared merchant list.
  if (/^Non-Chase ATM Withdraw/.test(raw)) return { kind: "expense", name: "ATM withdrawal", share: false };
  if (/^Monthly Service Fee/.test(raw)) return { kind: "expense", name: "Monthly service fee" };
  if ((m = raw.match(/^Zelle Payment To (.+?) \S+$/))) return { kind: "expense", name: `Zelle to ${m[1]}`, share: false };
  if (/^Venmo Payment/.test(raw)) return { kind: "expense", name: "Venmo payment", share: false };
  if ((m = raw.match(/^(?:\d{2}\/\d{2} )?Online Payment \d+ To (.+)$/))) return { kind: "expense", name: m[1], share: false };
  if (/^Dept Education Student Ln/.test(raw)) return { kind: "expense", name: "Student loan" };

  const merchant = raw.replace(/^(Recurring )?Card Purchase( With Pin)?\s*/, "").replace(/^\d{2}\/\d{2}\s+/, "");
  return { kind: "expense", name: cleanMerchant(merchant.replace(/\s(PPD|Web) ID:.*$/, "")) };
}

// Short stable id for a statement line, so re-importing never duplicates it.
async function fingerprint(text) {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)]
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// The purchase date inside a card description ("Card Purchase 09/28 …"),
// falling back to the date it posted.
function spentOn(t) {
  const inner = t.raw.match(/(?:^|\s)(\d{2}\/\d{2})\s/);
  if (!inner) return t.posted;
  const [y] = t.posted.split("-");
  const [m, d] = inner[1].split("/");
  // A purchase in late December that posts in January belongs to last year.
  const year = Number(m) > Number(t.posted.slice(5, 7)) + 1 ? Number(y) - 1 : Number(y);
  return `${year}-${m}-${d}`;
}

// → { expenses: [...], money: [...] }, each item carrying the fingerprints of
// the statement lines it came from.
export async function toBudgetItems(statement) {
  const seen = new Map();
  const items = [];
  for (const t of statement.transactions) {
    // Identical lines on the same day are separate charges; number them.
    const key = `${t.posted}|${t.amount}|${t.raw}`;
    const n = (seen.get(key) || 0) + 1;
    seen.set(key, n);

    const { kind, name, share = true } = describe(t);
    items.push({
      kind,
      name,
      share,
      merchant: name.toLowerCase(),
      date: kind === "money" ? t.posted : spentOn(t),
      amount: Math.abs(t.amount),
      signed: t.amount,
      chaseRecurring: /^Recurring Card Purchase/.test(t.raw),
      fingerprints: [await fingerprint(`${key}#${n}`)],
    });
  }

  // Fold each foreign exchange fee into the purchase it belongs to.
  const expenses = items.filter((i) => i.kind === "expense");
  for (const fee of items.filter((i) => i.kind === "fxfee")) {
    const days = (a, b) => Math.abs(new Date(a) - new Date(b)) / 864e5;
    const purchase = expenses
      .filter((e) => e.merchant === fee.merchant && days(e.date, fee.date) <= 5)
      .sort((a, b) => days(a.date, fee.date) - days(b.date, fee.date))[0];
    if (purchase) {
      purchase.amount = Math.round((purchase.amount + fee.amount) * 100) / 100;
      purchase.fingerprints.push(...fee.fingerprints);
    } else {
      expenses.push({ ...fee, kind: "expense", name: `Foreign transaction fee (${fee.name})`, share: false });
    }
  }

  return {
    expenses: expenses.sort((a, b) => a.date.localeCompare(b.date)),
    money: items.filter((i) => i.kind === "money").map((i) => ({ ...i, amount: i.signed })),
  };
}
