import React from "react";
import "./TransportControls.css";

function TransportControls({
  isPlaying,
  currentTick,
  bpm,
  onPlay,
  onPause,
  onStop,
  onBpmChange,
  TICKS_PER_BEAT = 480,
  BEATS_PER_LOOP = 16,
}) {
  const TOTAL_TICKS = TICKS_PER_BEAT * BEATS_PER_LOOP;

  // Calculate current position for display
  const currentBeat = Math.floor(currentTick / TICKS_PER_BEAT) + 1;
  const progress = (currentTick / TOTAL_TICKS) * 100;

  return (
    <div className="bg-light py-3 px-4 border-bottom d-flex justify-content-between align-items-center mb-4">
      {/* Transport Controls - Mockup Style */}
      <div className="transport-controls">
        <button
          className="btn-transport btn-play-pause"
          onClick={isPlaying ? onPause : onPlay}
        >
          {isPlaying ? "⏸ Pause" : "▶ Play"}
        </button>
        <button className="btn-transport btn-stop" onClick={onStop}>
          ⏹ Stop
        </button>
        <button className="btn-transport btn-loop">Loop</button>
      </div>

      {/* Position Display - We'll keep this for now */}
      <div className="d-flex align-items-center">
        <div className="d-flex align-items-center me-4">
          <span className="badge bg-info me-2">
            Beat: {currentBeat}/{BEATS_PER_LOOP}
          </span>
          <span className="badge bg-secondary">Tick: {currentTick}</span>
        </div>

        {/* BPM Control */}
        <div className="bpm-control d-flex align-items-center gap-2">
          <span className="text-secondary fw-bold">BPM</span>
          <input
            type="range"
            className="form-range me-2"
            style={{ width: "120px" }}
            min="60"
            max="300"
            value={bpm}
            onChange={(e) => onBpmChange(parseInt(e.target.value))}
          />
          <span className="badge bg-primary">{bpm}</span>
        </div>
      </div>
    </div>
  );
}

export default TransportControls;
