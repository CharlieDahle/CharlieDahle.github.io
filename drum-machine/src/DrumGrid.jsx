import React from 'react';
import './DrumGrid.css';

const TICKS_PER_BEAT = 480;
const BEATS_PER_BAR = 4;
const TOTAL_TICKS = TICKS_PER_BEAT * BEATS_PER_BAR;

function DrumGrid({ 
  track, 
  currentTick, 
  onToggleBeat, 
  disabled = false
}) {
  
  // Create 16 positions for now (1 bar, 16th note grid)
  const gridPositions = Array.from({ length: 16 }, (_, i) => i * (TICKS_PER_BEAT / 4));

  // Check if a beat exists at a specific tick
  const hasBeat = (tick) => {
    return track.beats.some(beat => beat.tick === tick);
  };

  // Check if current tick is at this position
  const isCurrentPosition = (tick) => {
    // Since we only show 1 bar (16 positions), we need to wrap the currentTick
    const wrappedCurrentTick = currentTick % TOTAL_TICKS;
    return wrappedCurrentTick === tick;
  };

  // Simple click handler - just toggle on/off
  const handleCellClick = (tick) => {
    if (disabled) return;
    
    const velocity = hasBeat(tick) ? 0 : 127; // Simple toggle
    onToggleBeat(tick, velocity);
  };

  // Get cell classes - much simpler
  const getCellClasses = (tick, index) => {
    const classes = ['grid-cell'];
    
    // Mark downbeats (every 4th cell = beats 1,2,3,4)
    if (index % 4 === 0) {
      classes.push('downbeat');
    }
    
    if (hasBeat(tick)) {
      classes.push('has-beat');
    }
    
    if (isCurrentPosition(tick)) {
      classes.push('current-position');
    }
    
    return classes.join(' ');
  };

  // Get beat number for display
  const getBeatNumber = (index) => {
    return Math.floor(index / 4) + 1;
  };

  return (
    <div className="drum-grid-container">
      {/* Beat markers */}
      <div className="beat-markers">
        {[1, 2, 3, 4].map(beat => (
          <div key={beat} className="beat-marker">
            {beat}
          </div>
        ))}
      </div>

      {/* Simple grid */}
      <div className="grid-cells">
        {gridPositions.map((tick, index) => (
          <button
            key={tick}
            onClick={() => handleCellClick(tick)}
            disabled={disabled}
            className={getCellClasses(tick, index)}
            title={`Beat ${getBeatNumber(index)}, Position ${index + 1}`}
          >
            {hasBeat(tick) && <div className="beat-dot" />}
          </button>
        ))}
      </div>
    </div>
  );
}

export default DrumGrid;