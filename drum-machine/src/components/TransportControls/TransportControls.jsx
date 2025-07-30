import React from "react";
import { useTransportStore } from "../../stores/useTransportStore";
import { useWebSocketStore } from "../../stores/useWebSocketStore";
import { useUIStore } from "../../stores/useUIStore";
import "./TransportControls.css";

function TransportControls() {
  // Get all state from stores directly
  const {
    bpm,
    measureCount,
    setBpm,
    addMeasure,
    removeMeasure,
    TICKS_PER_BEAT,
    BEATS_PER_LOOP,
    getTotalTicks,
  } = useTransportStore();

  const { sendBpmChange, sendMeasureCountChange } = useWebSocketStore();

  // Get snap state from UI store
  const { snapToGrid, setSnapToGrid } = useUIStore();

  // Handle BPM changes - calls stores directly
  const handleBpmChange = (newBpm) => {
    setBpm(newBpm);
    sendBpmChange(newBpm);
  };

  // Handle measure changes - calls stores directly
  const handleMeasureChange = (newMeasureCount) => {
    sendMeasureCountChange(newMeasureCount);
  };

  // Get the isPlaying state to show correct button
  const { isPlaying, play, pause, stop } = useTransportStore();
  const { sendTransportCommand } = useWebSocketStore();

  const handlePlay = () => {
    play(); // Update local store
    sendTransportCommand({ type: "play" }); // Send to server
  };

  const handlePause = () => {
    pause(); // Update local store
    sendTransportCommand({ type: "pause" }); // Send to server
  };

  const handleStop = () => {
    stop(); // Update local store
    sendTransportCommand({ type: "stop" }); // Send to server
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
            onClick={() => {
              removeMeasure();
              handleMeasureChange(measureCount - 1);
            }}
            title="Remove measure"
          >
            −
          </button>

          <span className="measure-count">{measureCount}</span>

          <button
            className="measure-btn"
            disabled={measureCount >= 4}
            onClick={() => {
              addMeasure();
              handleMeasureChange(measureCount + 1);
            }}
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
