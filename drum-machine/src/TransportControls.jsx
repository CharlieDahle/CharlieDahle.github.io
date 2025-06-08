import React from 'react';
import { Play, Pause, Square } from 'lucide-react';

function TransportControls({ 
  isPlaying, 
  bpm, 
  currentTick, 
  totalTicks,
  onPlay, 
  onPause, 
  onStop, 
  onBpmChange, 
  disabled = false 
}) {
  
  const handleBpmChange = (e) => {
    const newBpm = Number(e.target.value);
    // Allow any valid number, let the parent component handle validation
    onBpmChange(newBpm);
  };

  return (
    <div className="transport-controls-card">
      <h5 className="mb-3">Transport Controls</h5>
      <div className="transport-controls">
        <button
          onClick={isPlaying ? onPause : onPlay}
          disabled={disabled}
          className="btn transport-btn play-pause"
        >
          {isPlaying ? <Pause size={20} className="me-2" /> : <Play size={20} className="me-2" />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        
        <button
          onClick={onStop}
          disabled={disabled}
          className="btn transport-btn stop"
        >
          <Square size={20} className="me-2" />
          Stop
        </button>
        
        <div className="bpm-control">
          <label className="me-2">BPM:</label>
          <input
            type="number"
            value={bpm}
            onChange={handleBpmChange}
            disabled={disabled}
            className="form-control"
            min="60"
            max="200"
            step="1"
          />
        </div>
        
        <div className="tick-display">
          <small>Tick: {currentTick} / {totalTicks}</small>
        </div>
      </div>
    </div>
  );
}

export default TransportControls;