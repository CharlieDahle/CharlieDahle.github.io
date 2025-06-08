import React from 'react';

const TICKS_PER_BEAT = 480;

function GridCell({ 
  tick, 
  hasBeat, 
  velocity = 127, 
  isCurrentPosition, 
  isDownbeat, 
  isOffbeat, 
  onClick, 
  disabled = false 
}) {

  // Get velocity class for styling
  const getVelocityClass = () => {
    if (!hasBeat) return '';
    
    const intensity = velocity / 127; // Normalize to 0-1
    
    if (intensity > 0.8) return 'velocity-high';
    if (intensity > 0.6) return 'velocity-med';
    return 'velocity-low';
  };

  // Get beat number for display (1, 2, 3, 4)
  const getBeatNumber = () => {
    return Math.floor(tick / TICKS_PER_BEAT) + 1;
  };

  // Get cell classes
  const getCellClasses = () => {
    const classes = ['grid-cell'];
    
    if (isDownbeat) classes.push('downbeat');
    else if (isOffbeat) classes.push('offbeat');
    
    if (hasBeat) {
      classes.push('has-beat');
      classes.push(getVelocityClass());
    }
    
    if (isCurrentPosition) {
      classes.push('current-position');
    }
    
    return classes.join(' ');
  };

  const handleClick = () => {
    if (disabled) return;
    
    // Toggle beat with different velocities based on current state
    let newVelocity;
    if (hasBeat) {
      // If beat exists, remove it
      newVelocity = 0;
    } else {
      // If no beat, add with default velocity
      newVelocity = 127;
    }
    
    onClick(tick, newVelocity);
  };

  // Handle right-click for different velocities
  const handleRightClick = (e) => {
    e.preventDefault(); // Prevent context menu
    if (disabled) return;
    
    if (hasBeat) {
      // Cycle through velocities: high -> med -> low -> remove
      const intensity = velocity / 127;
      let newVelocity;
      
      if (intensity > 0.8) {
        newVelocity = 95; // Medium velocity
      } else if (intensity > 0.6) {
        newVelocity = 64; // Low velocity
      } else {
        newVelocity = 0; // Remove
      }
      
      onClick(tick, newVelocity);
    } else {
      // Add beat with medium velocity
      onClick(tick, 95);
    }
  };

  return (
    <div className="position-relative">
      {/* Grid cell */}
      <button
        onClick={handleClick}
        onContextMenu={handleRightClick}
        disabled={disabled}
        className={getCellClasses()}
        title={`Beat ${getBeatNumber()}, Tick: ${tick}${hasBeat ? ` (Velocity: ${velocity})` : ''}\nLeft click: toggle beat\nRight click: change velocity`}
        aria-label={`Grid cell at tick ${tick}${hasBeat ? ', has beat' : ', empty'}`}
      >
        {/* Beat indicator */}
        {hasBeat && (
          <div className="beat-indicator" />
        )}
      </button>

      {/* Playhead indicator */}
      {isCurrentPosition && (
        <div className="playhead" />
      )}
    </div>
  );
}

export default GridCell;