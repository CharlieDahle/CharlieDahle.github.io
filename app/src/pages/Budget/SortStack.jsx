import { useRef, useState } from "react";
import { AnimatePresence, MotionConfig, animate, motion, useMotionValue } from "framer-motion";
import { colorOf } from "./palette";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function shortDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Where a drag event is on screen, for mouse and touch alike.
function clientPoint(event, info) {
  const touch = event.changedTouches?.[0];
  if (touch) return { x: touch.clientX, y: touch.clientY };
  if (event.clientX !== undefined) return { x: event.clientX, y: event.clientY };
  return { x: info.point.x - window.scrollX, y: info.point.y - window.scrollY };
}

const center = (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

// Charges one at a time, like a stack of paper, with the categories around it.
// Drag the top one onto a category, or click the category.
export default function SortStack({ groups, position, categories, onSort, onUndo, onDone, onCreate }) {
  const group = groups[position];
  const targets = useRef(new Map());
  const slotRef = useRef(null);
  const [over, setOver] = useState(null);
  const [flight, setFlight] = useState(null);
  const [naming, setNaming] = useState(false);

  const targetAt = (point) => {
    for (const [id, el] of targets.current) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (point.x >= r.left - 8 && point.x <= r.right + 8 && point.y >= r.top - 8 && point.y <= r.bottom + 8) return id;
    }
    return null;
  };

  // Sends the top card into a category; the card flies to where that category sits.
  const send = (categoryId, el = targets.current.get(categoryId)) => {
    if (!group) return;
    const from = center(slotRef.current);
    const to = el ? center(el) : from;
    setFlight({ x: to.x - from.x, y: to.y - from.y });
    onSort(group, categoryId);
  };

  const skip = () => {
    if (!group) return;
    setFlight({ x: 0, y: 60 });
    onSort(group, null);
  };

  // Returns true if the card landed somewhere.
  const drop = (point) => {
    const id = targetAt(point);
    setOver(null);
    if (id === "new") {
      setNaming(true);
      return false;
    }
    if (id === null) return false;
    send(id);
    return true;
  };

  const create = async (name) => {
    const el = targets.current.get("new");
    const category = await onCreate(name);
    if (!category) return;
    setNaming(false);
    send(category.id, el);
  };

  // Categories evenly spaced on an oval around the card, starting at the top.
  const ring = [...categories.map((c) => ({ id: c.id, category: c })), { id: "new" }];
  const place = (i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / ring.length;
    return { "--x": `${50 + 43 * Math.cos(angle)}%`, "--y": `${50 + 42 * Math.sin(angle)}%` };
  };

  return (
    <MotionConfig reducedMotion="user">
      <p className="bg-quiet bg-sort-hint">Drag each charge onto a category, or click the category.</p>

      <div className="bg-desk">
        <div className="bg-card-slot" ref={slotRef}>
          {/* The rest of the pile, peeking out underneath. */}
          {groups.length - position > 2 && <div className="bg-card is-under is-under-2" />}
          {groups.length - position > 1 && <div className="bg-card is-under" />}

          <AnimatePresence custom={flight}>
            {group && (
              <Card
                key={group.merchant}
                group={group}
                onDrag={(point) => setOver(targetAt(point))}
                onDrop={drop}
              />
            )}
          </AnimatePresence>

          {!group && <p className="bg-quiet bg-sort-empty">All sorted.</p>}
        </div>

        {ring.map((t, i) =>
          t.id === "new" && naming ? (
            <span key="new" className="bg-target is-naming" style={place(i)} ref={(el) => targets.current.set("new", el)}>
              <NewCategoryInput onSubmit={create} onCancel={() => setNaming(false)} />
            </span>
          ) : (
            <button
              key={t.id}
              type="button"
              className={`bg-target ${over === t.id ? "is-over" : ""} ${t.id === "new" ? "is-new" : ""}`}
              style={place(i)}
              ref={(el) => (el ? targets.current.set(t.id, el) : targets.current.delete(t.id))}
              disabled={!group}
              onClick={() => (t.id === "new" ? setNaming(true) : send(t.id))}
            >
              {t.category && <span className="bg-dot" style={{ background: colorOf(t.category) }} />}
              {t.category ? t.category.name : "New category"}
            </button>
          ),
        )}
      </div>

      <div className="bg-sort-foot">
        <span className="bg-quiet">
          {Math.min(position + 1, groups.length)} of {groups.length}
        </span>
        <button className="bg-link" onClick={skip} disabled={!group}>
          Skip
        </button>
        <button className="bg-link" onClick={onUndo} disabled={position === 0}>
          Undo
        </button>
        <span className="bg-spacer" />
        <button className="bg-link" onClick={onDone}>
          {group ? "Skip the rest" : "Review"}
        </button>
      </div>
    </MotionConfig>
  );
}

function Card({ group, onDrag, onDrop }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const dates =
    group.first === group.last ? shortDate(group.first) : `${shortDate(group.first)} to ${shortDate(group.last)}`;

  return (
    <motion.div
      className="bg-card"
      style={{ x, y }}
      drag
      dragMomentum={false}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit="leave"
      variants={{
        leave: (flight) => ({
          x: flight?.x ?? 0,
          y: flight?.y ?? 0,
          opacity: 0,
          scale: 0.4,
          transition: { duration: 0.22, ease: "easeIn" },
        }),
      }}
      // See-through while dragging, so the category underneath stays visible.
      whileDrag={{ scale: 1.03, opacity: 0.55, cursor: "grabbing" }}
      onDrag={(e, info) => onDrag(clientPoint(e, info))}
      onDragEnd={(e, info) => {
        if (!onDrop(clientPoint(e, info))) {
          animate(x, 0, { type: "spring", stiffness: 500, damping: 35 });
          animate(y, 0, { type: "spring", stiffness: 500, damping: 35 });
        }
      }}
    >
      <span className="bg-card-name">{group.name}</span>
      <span className="bg-quiet bg-card-meta">
        {group.count > 1 && `${group.count} charges, `}
        {dates}
      </span>
      <span className="bg-card-amount">{money.format(group.total)}</span>
    </motion.div>
  );
}

function NewCategoryInput({ onSubmit, onCancel }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <input
      className="bg-input"
      autoFocus
      maxLength={40}
      placeholder="Name"
      aria-label="New category name"
      value={name}
      disabled={busy}
      onChange={(e) => setName(e.target.value)}
      onBlur={() => !busy && !name.trim() && onCancel()}
      onKeyDown={async (e) => {
        if (e.key === "Escape") {
          // Closes this field, not the whole import.
          e.stopPropagation();
          onCancel();
        }
        if (e.key === "Enter" && name.trim()) {
          setBusy(true);
          await onSubmit(name.trim());
          setBusy(false);
        }
      }}
    />
  );
}
