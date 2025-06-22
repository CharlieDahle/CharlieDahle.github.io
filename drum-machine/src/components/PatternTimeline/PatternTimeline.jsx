import React, { useEffect, useRef, useState } from 'react';

function PatternTimeline({ 
  pattern, 
  bpm,
  currentTick = 0,
  isPlaying = false,
  snapToGrid, 
  onPatternChange,
  onBpmChange,
  onSnapToggle,
  TICKS_PER_BEAT = 480,
  BEATS_PER_LOOP = 16,
  PIXELS_PER_TICK = 0.1 
}) {
  const gridRef = useRef(null);
  const playheadRef = useRef(null);
  const [draggedNote, setDraggedNote] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);

  const TOTAL_TICKS = TICKS_PER_BEAT * BEATS_PER_LOOP;
  const BEAT_WIDTH = TICKS_PER_BEAT * PIXELS_PER_TICK;
  const GRID_WIDTH = TOTAL_TICKS * PIXELS_PER_TICK;

  // Track configuration
  const tracks = [
    { id: 'kick', name: 'Kick', color: '#e74c3c' },
    { id: 'snare', name: 'Snare', color: '#f39c12' },
    { id: 'hihat', name: 'Hi-Hat', color: '#2ecc71' },
    { id: 'openhat', name: 'Open Hat', color: '#3498db' }
  ];

  // Update playhead position when currentTick changes
  useEffect(() => {
    if (playheadRef.current) {
      const position = currentTick * PIXELS_PER_TICK;
      playheadRef.current.style.left = `${position}px`;
    }
  }, [currentTick, PIXELS_PER_TICK]);

  useEffect(() => {
  console.log("running create note!");
  }, [pattern]);

  // Handle track clicks for note placement
  const handleTrackMouseDown = (e, trackId) => {
    console.log('Track clicked:', trackId);
    
    if (e.target.classList.contains('timeline-note')) return;
    
    const track = e.currentTarget;
    const rect = track.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const tick = x / PIXELS_PER_TICK;

    let snappedTick;
    if (snapToGrid) {
      // Snap to beat boundaries
      const beatIndex = Math.floor(tick / TICKS_PER_BEAT);
      snappedTick = beatIndex * TICKS_PER_BEAT;
    } else {
      // Free form placement
      snappedTick = Math.round(tick);
    }

    const clampedTick = Math.max(0, Math.min(TOTAL_TICKS - 1, snappedTick));
    
    // Check if there's already a note at this position
    const existingNote = pattern[trackId]?.includes(clampedTick);

    if (existingNote) {
      // Remove existing note
      console.log('Removing note at tick:', clampedTick);
      onPatternChange({
        type: 'remove-note',
        trackId,
        tick: clampedTick
      });
    } else {
      // Add new note
      console.log('Adding note at tick:', clampedTick);
      onPatternChange({
        type: 'add-note',
        trackId,
        tick: clampedTick
      });
    }
  };

  // Handle note dragging start
  const handleNoteMouseDown = (e, trackId, tick) => {
    e.stopPropagation();
    
    const noteRect = e.target.getBoundingClientRect();
    const offsetX = e.clientX - noteRect.left;
    
    setIsDragging(true);
    setHasDragged(false);
    setDraggedNote({ 
      trackId, 
      originalTick: tick, 
      currentTick: tick,
      offsetX
    });
  };

  // Handle mouse move during drag
  const handleMouseMove = (e) => {
    if (!isDragging || !draggedNote) return;

    setHasDragged(true);

    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - draggedNote.offsetX;
    const tick = x / PIXELS_PER_TICK;

    let snappedTick;
    if (snapToGrid) {
      const beatIndex = Math.floor(tick / TICKS_PER_BEAT);
      snappedTick = beatIndex * TICKS_PER_BEAT;
    } else {
      snappedTick = Math.round(tick);
    }

    const clampedTick = Math.max(0, Math.min(TOTAL_TICKS - 1, snappedTick));
    
    setDraggedNote(prev => ({
      ...prev,
      currentTick: clampedTick
    }));
  };

  // Handle mouse up - finish drag
  const handleMouseUp = () => {
    if (isDragging && draggedNote && hasDragged) {
      console.log('Moving note from', draggedNote.originalTick, 'to', draggedNote.currentTick);
      onPatternChange({
        type: 'move-note',
        trackId: draggedNote.trackId,
        fromTick: draggedNote.originalTick,
        toTick: draggedNote.currentTick
      });
    }
    
    setIsDragging(false);
    setDraggedNote(null);
    setTimeout(() => setHasDragged(false), 10);
  };

  // Handle note click (delete if not dragged)
  const handleNoteClick = (e, trackId, tick) => {
    e.stopPropagation();
    if (!hasDragged) {
      console.log('Deleting note at tick:', tick);
      onPatternChange({
        type: 'remove-note',
        trackId,
        tick
      });
    }
  };

  // Add global mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, draggedNote, snapToGrid, PIXELS_PER_TICK, TICKS_PER_BEAT, TOTAL_TICKS]);

  return (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="mb-0">Pattern Timeline</h5>
        <div className="d-flex align-items-center gap-3">
          <div className="form-check">
            <input 
              className="form-check-input" 
              type="checkbox" 
              id="snapToggle"
              checked={snapToGrid} 
              onChange={(e) => onSnapToggle(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="snapToggle">
              Snap to beat
            </label>
          </div>
          <div className="d-flex align-items-center">
            <label className="form-label mb-0 me-2">BPM:</label>
            <input
              type="range"
              className="form-range me-2"
              style={{ width: '120px' }}
              min="60"
              max="300"
              value={bpm}
              onChange={(e) => onBpmChange(parseInt(e.target.value))}
            />
            <span className="badge bg-primary">{bpm}</span>
          </div>
        </div>
      </div>
      
      <div className="card-body">
        <div style={{ overflowX: 'auto', padding: '10px' }}>
          {/* Beat markers */}
          <div style={{ 
            position: 'relative',
            height: '20px',
            width: `${GRID_WIDTH}px`,
            marginBottom: '10px'
          }}>
            {Array.from({ length: BEATS_PER_LOOP }, (_, beatIndex) => (
              <div
                key={beatIndex}
                style={{
                  position: 'absolute',
                  top: '0',
                  left: `${beatIndex * BEAT_WIDTH}px`,
                  fontSize: '12px',
                  color: '#666',
                  fontWeight: 'bold'
                }}
              >
                {(beatIndex % 4) + 1}
              </div>
            ))}
          </div>

          {/* Main timeline */}
          <div ref={gridRef} style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            width: `${GRID_WIDTH}px`,
            minWidth: '800px'
          }}>
            {/* Playhead */}
            <div
              ref={playheadRef}
              style={{
                position: 'absolute',
                top: '-20px',
                bottom: '0',
                width: '2px',
                background: '#e74c3c',
                zIndex: 10,
                pointerEvents: 'none',
                boxShadow: '0 0 4px rgba(231, 76, 60, 0.5)',
                transition: isPlaying ? 'none' : 'left 0.1s ease'
              }}
            />

            {/* Track rows */}
            {tracks.map((track) => (
              <div
                key={track.id}
                style={{
                  position: 'relative',
                  height: '50px',
                  background: '#f8f9fa',
                  cursor: 'crosshair',
                  borderRadius: '4px',
                  border: '1px solid #dee2e6'
                }}
                onMouseDown={(e) => handleTrackMouseDown(e, track.id)}
              >
                {/* Beat separator lines */}
                {Array.from({ length: BEATS_PER_LOOP + 1 }, (_, beatIndex) => (
                  <div
                    key={`line-${beatIndex}`}
                    style={{
                      position: 'absolute',
                      top: '0',
                      bottom: '0',
                      left: `${beatIndex * BEAT_WIDTH}px`,
                      width: beatIndex % 4 === 0 ? '2px' : '1px',
                      background: beatIndex % 4 === 0 ? '#999' : '#ccc',
                      pointerEvents: 'none',
                      zIndex: 1
                    }}
                  />
                ))}

                {/* Track label */}
                <div style={{
                  position: 'absolute',
                  left: '-80px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: track.color,
                  width: '70px',
                  textAlign: 'right'
                }}>
                  {track.name}
                </div>

                {/* Notes */}
                {pattern[track.id]?.map((tick) => {
                  
                  const isBeingDragged = draggedNote && 
                    draggedNote.trackId === track.id && 
                    draggedNote.originalTick === tick;
                  
                  const displayTick = isBeingDragged ? draggedNote.currentTick : tick;

                  
                  
                  return (
                    <div
                      key={`${track.id}-${tick}`}
                      className="timeline-note"
                      style={{
                        position: 'absolute',
                        left: `${displayTick * PIXELS_PER_TICK}px`,
                        width: '20px',
                        height: '40px',
                        top: '5px',
                        background: isBeingDragged ? '#e67e22' : track.color,
                        cursor: 'grab',
                        borderRadius: '4px',
                        transition: isBeingDragged ? 'none' : 'background-color 0.1s ease',
                        zIndex: isBeingDragged ? 10 : 2,
                        border: '2px solid rgba(255,255,255,0.3)'
                      }}
                      onMouseDown={(e) => handleNoteMouseDown(e, track.id, tick)}
                      onClick={(e) => handleNoteClick(e, track.id, tick)}
                      onMouseEnter={(e) => {
                        if (!isDragging) {
                          e.target.style.opacity = '0.8';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.opacity = '1';
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PatternTimeline;