import React from 'react';

function TransportControls({ 
  isPlaying, 
  currentTick, 
  bpm, 
  onPlay, 
  onPause, 
  onStop,
  TICKS_PER_BEAT = 480,
  BEATS_PER_LOOP = 16 
}) {
  const TOTAL_TICKS = TICKS_PER_BEAT * BEATS_PER_LOOP;
  
  // Calculate current position for display
  const currentBeat = Math.floor(currentTick / TICKS_PER_BEAT) + 1;
  const progress = (currentTick / TOTAL_TICKS) * 100;

  return (
    <div className="card mb-4">
      <div className="card-body">
        <div className="row align-items-center">
          {/* Transport Buttons */}
          <div className="col-auto">
            <div className="btn-group" role="group">
              <button 
                className={`btn ${isPlaying ? 'btn-warning' : 'btn-success'}`}
                onClick={isPlaying ? onPause : onPlay}
              >
                {isPlaying ? (
                  <>⏸ Pause</>
                ) : (
                  <>▶ Play</>
                )}
              </button>
              <button 
                className="btn btn-secondary"
                onClick={onStop}
              >
                ⏹ Stop
              </button>
            </div>
          </div>

          {/* Position Display */}
          <div className="col-auto">
            <div className="d-flex align-items-center">
              <span className="badge bg-info me-2">
                Beat: {currentBeat}/{BEATS_PER_LOOP}
              </span>
              <span className="badge bg-secondary">
                Tick: {currentTick}
              </span>
            </div>
          </div>

          {/* BPM Display */}
          <div className="col-auto ms-auto">
            <span className="badge bg-primary fs-6">
              {bpm} BPM
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TransportControls;