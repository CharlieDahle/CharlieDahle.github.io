import React, { useState, useRef, useEffect } from "react";
import * as Tone from "tone";
import { Volume2 } from "lucide-react";
import { useAppStore } from "../../stores";
import { chordToNotes, ROOT_TO_SEMITONE, QUALITY_INTERVALS } from "../../utils/chordUtils";
import "./ChordStrip.css";

const ROOTS = Object.keys(ROOT_TO_SEMITONE);
const QUALITIES = Object.keys(QUALITY_INTERVALS).map((id) => ({ id, label: id }));

function chordLabel(chord) {
  if (!chord) return null;
  if (chord.quality === "maj") return chord.root;
  if (chord.quality === "min") return `${chord.root}m`;
  return `${chord.root}${chord.quality}`;
}

// Shared preview synth (created once, reused)
let previewSynth = null;
function getPreviewSynth() {
  if (!previewSynth) {
    previewSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.02, decay: 0.4, sustain: 0.3, release: 2.0 },
      volume: -10,
    }).toDestination();
  }
  return previewSynth;
}

async function previewChord(chord, volume = 80) {
  if (!chord) return;
  await Tone.start();
  const synth = getPreviewSynth();
  synth.volume.value = volume > 0 ? Tone.gainToDb(volume / 100) : -Infinity;
  const notes = chordToNotes(chord);
  synth.triggerAttackRelease(notes, "2n");
}

function SidebarVolumePopup({ label, value, onChange, position, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="volume-popup"
      style={{ position: "fixed", left: `${position.x - 60}px`, top: `${position.y - 60}px`, zIndex: 1000 }}
    >
      <div className="volume-popup-content">
        <div className="volume-label">{label}: {value}%</div>
        <input
          type="range" min="0" max="100" value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="volume-slider"
        />
      </div>
    </div>
  );
}

function ChordPicker({ chord, onSelect, onClear, onClose, volume }) {
  const [root, setRoot] = useState(chord?.root ?? "C");
  const [quality, setQuality] = useState(chord?.quality ?? "maj");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleRootClick = (r) => {
    setRoot(r);
    previewChord({ root: r, quality }, volume);
  };

  const handleQualityClick = (q) => {
    setQuality(q);
    previewChord({ root, quality: q }, volume);
  };

  return (
    <div className="chord-picker" ref={ref} onClick={(e) => e.stopPropagation()}>
      <div className="chord-picker-section-label">Root</div>
      <div className="chord-picker-roots">
        {ROOTS.map((r) => (
          <button
            key={r}
            className={`chord-picker-btn ${root === r ? "chord-picker-btn--active" : ""}`}
            onClick={() => handleRootClick(r)}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="chord-picker-section-label">Quality</div>
      <div className="chord-picker-qualities">
        {QUALITIES.map((q) => (
          <button
            key={q.id}
            className={`chord-picker-btn ${quality === q.id ? "chord-picker-btn--active" : ""}`}
            onClick={() => handleQualityClick(q.id)}
          >
            {q.label}
          </button>
        ))}
      </div>

      <div className="chord-picker-actions">
        {chord && (
          <button className="chord-picker-clear" onClick={onClear}>
            Clear
          </button>
        )}
        <button
          className="chord-picker-confirm"
          onClick={() => onSelect({ root, quality })}
        >
          Set {chordLabel({ root, quality })}
        </button>
      </div>
    </div>
  );
}

function ChordStrip() {
  const isSpectator = useAppStore((state) => state.websocket.isSpectator);
  const measureCount = useAppStore((state) => state.transport.measureCount);
  const TICKS_PER_BEAT = useAppStore((state) => state.transport.TICKS_PER_BEAT);
  const chords = useAppStore((state) => state.chords.data);
  const setChord = useAppStore((state) => state.chords.setChord);
  const clearChord = useAppStore((state) => state.chords.clearChord);
  const chordVolume = useAppStore((state) => state.chords.chordVolume);
  const setChordVolume = useAppStore((state) => state.chords.setChordVolume);

  const MEASURES_PER_PAGE = 4;
  const PIXELS_PER_TICK = 0.128906;
  const BEAT_WIDTH = TICKS_PER_BEAT * PIXELS_PER_TICK;

  const [openPicker, setOpenPicker] = useState(null);
  const [volPopupOpen, setVolPopupOpen] = useState(false);
  const [volPopupPos, setVolPopupPos] = useState({ x: 0, y: 0 });
  const volBtnRef = useRef(null);

  const handleCellClick = (i) => {
    if (isSpectator) return;
    if (i >= measureCount) return;
    setOpenPicker(openPicker === i ? null : i);
  };

  const handleSelect = (i, chord) => {
    setChord(i, chord);
    previewChord(chord, chordVolume);
    setOpenPicker(null);
  };

  const handleClear = (i) => {
    clearChord(i);
    setOpenPicker(null);
  };

  return (
    <div className="chord-strip">
      <div className="chord-strip-sidebar">
        {!isSpectator && (
          <button
            ref={volBtnRef}
            className="sidebar-vol-btn"
            title={`Chords volume: ${chordVolume}%`}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setVolPopupPos({ x: rect.left + rect.width / 2, y: rect.top });
              setVolPopupOpen((o) => !o);
            }}
          >
            <Volume2 size={14} />
          </button>
        )}
        <span className="chord-strip-label">CHORDS</span>
      </div>

      {volPopupOpen && (
        <SidebarVolumePopup
          label="Chords"
          value={chordVolume}
          onChange={setChordVolume}
          position={volPopupPos}
          onClose={() => setVolPopupOpen(false)}
        />
      )}

      <div className="chord-strip-grid">
        {Array.from({ length: MEASURES_PER_PAGE }, (_, i) => {
          const chord = chords[i];
          const disabled = i >= measureCount;
          const isOpen = openPicker === i;

          return (
            <div
              key={i}
              className={`chord-cell ${disabled ? "chord-cell--disabled" : ""} ${chord ? "chord-cell--filled" : ""}`}
              style={{ width: `${BEAT_WIDTH * 4}px` }}
              onClick={() => handleCellClick(i)}
              title={disabled ? "" : chord ? `${chordLabel(chord)} — click to change` : "Click to add chord"}
            >
              {!disabled && (
                chord
                  ? <span className="chord-cell-name">{chordLabel(chord)}</span>
                  : !isSpectator && <span className="chord-cell-placeholder">+</span>
              )}

              {isOpen && (
                <ChordPicker
                  chord={chord}
                  onSelect={(c) => handleSelect(i, c)}
                  onClear={() => handleClear(i)}
                  onClose={() => setOpenPicker(null)}
                  volume={chordVolume}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ChordStrip;
