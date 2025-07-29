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
    <div className="transport-container">
      {/* Transport Controls */}
      <div className="transport-left">
        <div className="transport-controls">
          <button
            className="transport-btn transport-btn--play-pause"
            onClick={isPlaying ? onPause : onPlay}
          >
            {isPlaying ? "⏸ Pause" : "▶ Play"}
          </button>
          <button
            className="transport-btn transport-btn--stop"
            onClick={onStop}
          >
            ⏹ Stop
          </button>
          <button className="transport-btn transport-btn--loop">Loop</button>
        </div>
      </div>

      {/* Position Display and BPM */}
      <div className="transport-right">
        <div className="position-display">
          <span className="transport-badge transport-badge--beat">
            Beat: {currentBeat}/{BEATS_PER_LOOP}
          </span>
          <span className="transport-badge transport-badge--tick">
            Tick: {currentTick}
          </span>
        </div>

        <div className="bpm-controls">
          <span className="bpm-label">BPM</span>
          <input
            type="range"
            className="bpm-slider"
            min="60"
            max="300"
            value={bpm}
            onChange={(e) => onBpmChange(parseInt(e.target.value))}
          />
          <span className="transport-badge transport-badge--bpm">{bpm}</span>
        </div>
      </div>
    </div>
  );
}

export default TransportControls;
