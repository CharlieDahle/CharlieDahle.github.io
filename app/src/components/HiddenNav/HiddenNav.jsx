import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "./HiddenNav.css";

// Every page on the site, including ones nothing else links to.
const PAGES = [
  { to: "/", label: "Home" },
  { to: "/music", label: "Music" },
  { to: "/books", label: "Books" },
  { to: "/Photos", label: "Photos" },
  { to: "/DrumMachine", label: "Drum Machine" },
  { to: "/beats", label: "Beats" },
  { to: "/play", label: "Play" },
  { to: "/budget", label: "Budget" },
  { to: "/login", label: "Login" },
];

const CLICKS_TO_OPEN = 5;
const MAX_GAP_MS = 1500; // clicks further apart than this start the count over

// Wraps some text; clicking it 5 times in a row opens a menu of every page.
// Deliberately gives no hint that it's clickable.
export default function HiddenNav({ children, className }) {
  const [open, setOpen] = useState(false);
  const clicks = useRef({ count: 0, last: 0 });
  const ref = useRef(null);

  const onClick = () => {
    const now = Date.now();
    const c = clicks.current;
    c.count = now - c.last > MAX_GAP_MS ? 1 : c.count + 1;
    c.last = now;
    if (c.count >= CLICKS_TO_OPEN) {
      c.count = 0;
      setOpen(true);
    }
  };

  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`hidden-nav ${className || ""}`} ref={ref}>
      <div className="hidden-nav-trigger" onClick={onClick}>
        {children}
      </div>
      {open && (
        <nav className="hidden-nav-menu" aria-label="All pages">
          {PAGES.map((p) => (
            <Link key={p.to} to={p.to} onClick={() => setOpen(false)}>
              {p.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
