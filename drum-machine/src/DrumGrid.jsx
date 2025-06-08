import React from 'react';
import './DrumGrid.css';

const TICKS_PER_BEAT = 480;
const BEATS_PER_LOOP = 4;
const TOTAL_TICKS = TICKS_PER_BEAT * BEATS_PER_LOOP;

function DrumGrid({ 
  track, 
  currentTick, 
  onToggleBeat, 
  disabled = false,
  subdivision = 'sixteenth' // quarter, eighth, sixteenth
}) {
  
  // Calculate grid positions based on subdivision
  const getGridPositions = () => {
    switch (subdivision) {
      case 'quarter':
        return Array.from({ length: 4 }, (_, i) => i * TICKS_PER_BEAT);
      case 'eighth':
        return Array.from({ length: 8 }, (_, i) => i * (TICKS_PER_BEAT / 2));
      case 'sixteenth':
        return Array.from({ length: 16 }, (_, i) => i * (TICKS_PER_BEAT / 4));
      default:
        return Array.from({ length: 16 }, (_, i) => i * (TICKS_PER_BEAT / 4));
    }
  };

  const gridPositions = getGridPositions();

  // Check if a beat exists at a specific tick
  const hasBeat = (tick) => {
    return track.beats.some(beat => beat.tick === tick);
  };

  // Get beat velocity at a specific tick
  const getBeatVelocity = (tick) => {
    const beat = track.beats.find(beat => beat.tick === tick);
    return beat ? beat.velocity : 127;
  };

  // Check if current tick is at this position (for playback indicator)
  const isCurrentPosition = (tick) => {
    return currentTick === tick;
  };

  // Get velocity class for styling
  const getVelocityClass = (tick) => {
    if (!hasBeat(tick)) return '';
    
    const velocity = getBeatVelocity(tick);
    const intensity = velocity / 127; // Normalize to 0-1
    
    if (intensity > 0.8) return 'velocity-high';
    if (intensity > 0.6) return 'velocity-med';
    return 'velocity-low';
  };

  // Handle beat toggle
  const handleCellClick = (tick) => {
    if (disabled) return;
    
    const velocity = hasBeat(tick) ? 0 : 127; // Remove if exists, add if doesn't
    onToggleBeat(tick, velocity);
  };

  // Get cell classes
  const getCellClasses = (tick, index) => {
    const classes = ['grid-cell'];
    
    const isDownbeat = tick % TICKS_PER_BEAT === 0;
    const isOffbeat = tick % (TICKS_PER_BEAT / 2) === 0;
    
    if (isDownbeat) classes.push('downbeat');
    else if (isOffbeat) classes.push('offbeat');
    
    if (hasBeat(tick)) {
      classes.push('has-beat');
      classes.push(getVelocityClass(tick));
    }
    
    if (isCurrentPosition(tick)) {
      classes.push('current-position');
    }
    
    return classes.join(' ');
  };

  return (
    <div className="drum-grid-container">
      {/* Beat measure indicators */}
      <div className="grid-measures">
        {[1, 2, 3, 4].map(beat => (
          <div key={beat}>
            {beat}
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid-cells">
        {gridPositions.map((tick, index) => (
          <div key={tick} className="position-relative">
            {/* Grid cell */}
            <button
              onClick={() => handleCellClick(tick)}
              disabled={disabled}
              className={getCellClasses(tick, index)}
              title={`Tick: ${tick}${hasBeat(tick) ? ` (Velocity: ${getBeatVelocity(tick)})` : ''}`}
            >
              {/* Beat indicator */}
              {hasBeat(tick) && (
                <div className="beat-indicator" />
              )}
            </button>

            {/* Playhead indicator */}
            {isCurrentPosition(tick) && (
              <div className="playhead" />
            )}
          </div>
        ))}
      </div>

      {/* Subdivision selector */}
      <div className="subdivision-controls">
        <label>Grid:</label>
        {[
          { key: 'quarter', label: '1/4' },
          { key: 'eighth', label: '1/8' },
          { key: 'sixteenth', label: '1/16' }
        ].map(sub => (
          <button
            key={sub.key}
            onClick={() => {/* We'll add this functionality later */}}
            className={`subdivision-btn ${subdivision === sub.key ? 'active' : ''}`}
            type="button"
          >
            {sub.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default DrumGrid;