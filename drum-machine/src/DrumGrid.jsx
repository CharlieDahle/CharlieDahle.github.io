import React, { useEffect, useRef, useState } from 'react';

function DrumGrid({ 
  tracks, 
  currentTick, 
  isPlaying, 
  snapToGrid, 
  onAddNote, 
  onRemoveNote, 
  onMoveNote,
  TICKS_PER_BEAT = 480,
  BEATS_PER_LOOP = 16,
  PIXELS_PER_TICK = 0.4 
}) {
  const gridRef = useRef(null);
  const playheadRef = useRef(null);
  const [draggedNote, setDraggedNote] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);

  const TOTAL_TICKS = TICKS_PER_BEAT * BEATS_PER_LOOP;
  const BEAT_WIDTH = TICKS_PER_BEAT * PIXELS_PER_TICK;
  const GRID_WIDTH = TOTAL_TICKS * PIXELS_PER_TICK;

  // Update playhead position when currentTick changes
  useEffect(() => {
    if (playheadRef.current) {
      const position = currentTick * PIXELS_PER_TICK;
      playheadRef.current.style.left = `${position}px`;
    }
  }, [currentTick, PIXELS_PER_TICK]);

  // Create default tracks if none exist - but use indices for now
  const displayTracks = tracks.length > 0 ? tracks : [
    { id: 'temp-track-0', soundId: 'kick', beats: [] },
    { id: 'temp-track-1', soundId: 'snare', beats: [] },
    { id: 'temp-track-2', soundId: 'hihat', beats: [] },
    { id: 'temp-track-3', soundId: 'openhat', beats: [] }
  ];

  // Handle mouse events for note placement
  const handleTrackMouseDown = (e, trackId) => {
    console.log('Track clicked:', trackId, 'Target:', e.target.className);
    
    if (e.target.classList.contains('drum-note')) return;
    
    const track = e.currentTarget;
    const rect = track.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const tick = x / PIXELS_PER_TICK;

    console.log('Click position:', { x, tick, pixelsPerTick: PIXELS_PER_TICK });

    let snappedTick;
    if (snapToGrid) {
      // Snap to beat boundaries
      const beatIndex = Math.floor(tick / TICKS_PER_BEAT);
      snappedTick = beatIndex * TICKS_PER_BEAT;
      console.log('Snap mode - beatIndex:', beatIndex, 'snappedTick:', snappedTick);
    } else {
      // Free form placement
      snappedTick = Math.round(tick);
      console.log('Free form - snappedTick:', snappedTick);
    }

    const clampedTick = Math.max(0, Math.min(TOTAL_TICKS - 1, snappedTick));
    console.log('Final clampedTick:', clampedTick);
    
    // Check if there's already a note at this position
    const existingNote = displayTracks
      .find(t => t.id === trackId)
      ?.beats.find(b => b.tick === clampedTick);

    console.log('Existing note:', existingNote);

    if (existingNote) {
      // Remove existing note
      console.log('Removing note at tick:', clampedTick);
      onRemoveNote(trackId, clampedTick);
    } else {
      // Add new note
      console.log('Adding note at tick:', clampedTick);
      onAddNote(trackId, clampedTick);
    }
  };

  // Handle note dragging
  const handleNoteMouseDown = (e, trackId, tick) => {
    e.stopPropagation();
    
    // Calculate offset within the note
    const noteRect = e.target.getBoundingClientRect();
    const offsetX = e.clientX - noteRect.left;
    
    setIsDragging(true);
    setHasDragged(false);
    setDraggedNote({ 
      trackId, 
      originalTick: tick, 
      currentTick: tick,
      offsetX // Store the offset
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !draggedNote) return;

    setHasDragged(true);

    const rect = gridRef.current.getBoundingClientRect();
    // Subtract the stored offset so the note doesn't jump
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

  const handleMouseUp = () => {
    if (isDragging && draggedNote && hasDragged) {
      // Move the note
      onMoveNote(
        draggedNote.trackId, 
        draggedNote.originalTick, 
        draggedNote.currentTick
      );
    }
    
    setIsDragging(false);
    setDraggedNote(null);
    
    // Reset drag flag after a short delay
    setTimeout(() => setHasDragged(false), 10);
  };

  const handleNoteClick = (e, trackId, tick) => {
    e.stopPropagation();
    if (!hasDragged) {
      // Delete note on click (if we haven't dragged)
      onRemoveNote(trackId, tick);
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

  const gridStyle = {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    width: `${GRID_WIDTH}px`,
    minWidth: '800px'
  };

  const markerContainerStyle = {
    position: 'relative',
    height: '20px',
    width: `${GRID_WIDTH}px`,
    marginBottom: '10px'
  };

  const beatMarkerStyle = {
    position: 'absolute',
    top: '0',
    fontSize: '12px',
    color: '#333',
    fontWeight: 'bold'
  };

  const trackStyle = {
    position: 'relative',
    height: '40px',
    background: '#eee',
    cursor: 'crosshair',
    borderRadius: '3px'
  };

  const beatLineStyle = {
    position: 'absolute',
    top: '0',
    bottom: '0',
    width: '1px',
    background: '#ccc',
    pointerEvents: 'none',
    zIndex: 1
  };

  const majorBeatLineStyle = {
    ...beatLineStyle,
    background: '#999',
    width: '2px'
  };

  const beatZoneStyle = {
    position: 'absolute',
    top: '0',
    bottom: '0',
    width: `${BEAT_WIDTH}px`,
    background: 'transparent',
    pointerEvents: 'none',
    zIndex: 0,
    transition: 'background-color 0.1s ease'
  };

  const snapModeZoneStyle = {
    ...beatZoneStyle,
    pointerEvents: 'auto'
  };

  const noteStyle = (tick, isBeingDragged = false) => ({
    position: 'absolute',
    left: `${tick * PIXELS_PER_TICK}px`,
    width: `${BEAT_WIDTH}px`,
    height: '100%',
    background: isBeingDragged ? '#e67e22' : '#3498db',
    cursor: 'grab',
    borderRadius: '2px',
    transition: isBeingDragged ? 'none' : 'background-color 0.1s ease',
    zIndex: isBeingDragged ? 10 : 2
  });

  const playheadStyle = {
    position: 'absolute',
    top: '-20px',
    bottom: '0',
    width: '2px',
    background: '#e74c3c',
    zIndex: 10,
    pointerEvents: 'none',
    boxShadow: '0 0 4px rgba(231, 76, 60, 0.5)',
    transition: isPlaying ? 'none' : 'left 0.1s ease'
  };

  return (
    <div style={{ overflowX: 'auto', padding: '10px', background: 'white', borderRadius: '5px' }}>
      {/* Beat markers */}
      <div style={markerContainerStyle}>
        {Array.from({ length: BEATS_PER_LOOP }, (_, beatIndex) => (
          <div
            key={beatIndex}
            style={{
              ...beatMarkerStyle,
              left: `${beatIndex * BEAT_WIDTH}px`
            }}
          >
            {(beatIndex % 4) + 1}
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div ref={gridRef} style={gridStyle}>
        {/* Playhead */}
        <div
          ref={playheadRef}
          style={playheadStyle}
        />

        {/* Tracks */}
        {displayTracks.map((track, trackIndex) => (
          <div
            key={track.id}
            style={trackStyle}
            onMouseDown={(e) => handleTrackMouseDown(e, track.id)}
            data-track-id={track.id}
          >
            {/* Beat separator lines */}
            {Array.from({ length: BEATS_PER_LOOP + 1 }, (_, beatIndex) => (
              <div
                key={`line-${beatIndex}`}
                style={beatIndex % 4 === 0 ? majorBeatLineStyle : beatLineStyle}
                data-beat={beatIndex}
              />
            )).map((line, index) => 
              React.cloneElement(line, {
                style: {
                  ...line.props.style,
                  left: `${index * BEAT_WIDTH}px`
                }
              })
            )}

            {/* Beat zones for hover effects */}
            {snapToGrid && Array.from({ length: BEATS_PER_LOOP }, (_, beatIndex) => (
              <div
                key={`zone-${beatIndex}`}
                style={snapModeZoneStyle}
                data-beat={beatIndex}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(52, 152, 219, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                }}
              />
            )).map((zone, index) => 
              React.cloneElement(zone, {
                style: {
                  ...zone.props.style,
                  left: `${index * BEAT_WIDTH}px`
                }
              })
            )}

            {/* Notes */}
            {track.beats.map((beat) => {
              const isBeingDragged = draggedNote && 
                draggedNote.trackId === track.id && 
                draggedNote.originalTick === beat.tick;
              
              const displayTick = isBeingDragged ? draggedNote.currentTick : beat.tick;
              
              return (
                <div
                  key={`${track.id}-${beat.tick}`}
                  className="drum-note"
                  style={noteStyle(displayTick, isBeingDragged)}
                  onMouseDown={(e) => handleNoteMouseDown(e, track.id, beat.tick)}
                  onClick={(e) => handleNoteClick(e, track.id, beat.tick)}
                  onMouseEnter={(e) => {
                    if (!isDragging) {
                      e.target.style.outline = '2px solid red';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.outline = 'none';
                  }}
                />
              );
            })}

            {/* Track label */}
            <div style={{
              position: 'absolute',
              left: '-60px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '12px',
              fontWeight: 'bold',
              color: '#666'
            }}>
              {track.soundId || `Track ${trackIndex + 1}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DrumGrid;