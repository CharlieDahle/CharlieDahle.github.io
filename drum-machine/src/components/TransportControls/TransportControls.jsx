import React from "react";
import { useAppStore } from "../../stores/useAppStore";
import "./TransportControls.css";

function TransportControls() {
  // Get transport state and actions
  const isPlaying = useAppStore((state) => state.transport.isPlaying);
  const bpm = useAppStore((state) => state.transport.bpm);
  const measureCount = useAppStore((state) => state.transport.measureCount);

  const play = useAppStore((state) => state.transport.play);
  const pause = useAppStore((state) => state.transport.pause);
  const stop = useAppStore((state) => state.transport.stop);
  const setBpm = useAppStore((state) => state.transport.setBpm);
  const addMeasure = useAppStore((state) => state.transport.addMeasure);
  const removeMeasure = useAppStore((state) => state.transport.removeMeasure);

  // Get UI state
  const snapToGrid = useAppStore((state) => state.ui.snapToGrid);
  const setSnapToGrid = useAppStore((state) => state.ui.setSnapToGrid);

  const handlePlay = () => {
    play(); // This now handles both local state and WebSocket automatically
  };

  const handlePause = () => {
    pause(); // This now handles both local state and WebSocket automatically
  };

  const handleStop = () => {
    stop(); // This now handles both local state and WebSocket automatically
  };

  const handleBpmChange = (newBpm) => {
    setBpm(newBpm); // This now handles both local state and WebSocket automatically
  };

  const handleAddMeasure = () => {
    addMeasure(); // This now handles both local state and WebSocket automatically
  };

  const handleRemoveMeasure = () => {
    removeMeasure(); // This now handles both local state and WebSocket automatically
  };

  return (
    <div className="timeline-controls">
      <div className="controls-section">
        {/* Transport Controls */}
        <div className="transport-controls">
          <button
            className={`transport-btn ${
              isPlaying ? "transport-btn--pause" : "transport-btn--play"
            }`}
            onClick={isPlaying ? handlePause : handlePlay}
          >
            {isPlaying ? "⏸ Pause" : "▶ Play"}
          </button>
          <button
            className="transport-btn transport-btn--stop"
            onClick={handleStop}
          >
            ⏹ Stop
          </button>
          <button className="transport-btn transport-btn--loop">Loop</button>
        </div>

        {/* Measure Controls */}
        <div className="measure-controls">
          <span className="measure-label">Measures:</span>

          <button
            className="measure-btn"
            disabled={measureCount <= 1}
            onClick={handleRemoveMeasure}
            title="Remove measure"
          >
            −
          </button>

          <span className="measure-count">{measureCount}</span>

          <button
            className="measure-btn"
            disabled={measureCount >= 4}
            onClick={handleAddMeasure}
            title="Add measure"
          >
            +
          </button>
        </div>
      </div>

      <div className="controls-section">
        {/* Snap Toggle */}
        <div className="snap-control">
          <input
            className="snap-checkbox"
            type="checkbox"
            id="snapToggle"
            checked={snapToGrid}
            onChange={(e) => setSnapToGrid(e.target.checked)}
          />
          <label className="snap-label" htmlFor="snapToggle">
            Snap to grid
          </label>
        </div>

        {/* BPM Control */}
        <div className="bpm-control">
          <label className="bmp-label">BPM</label>
          <input
            type="range"
            className="bmp-slider"
            min="60"
            max="300"
            value={bpm}
            onChange={(e) => handleBpmChange(parseInt(e.target.value))}
          />
          <span className="bpm-value">{bpm}</span>
        </div>
      </div>
    </div>
  );
}

export default TransportControls;
