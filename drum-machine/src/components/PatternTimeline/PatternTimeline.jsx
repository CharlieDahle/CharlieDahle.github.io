import React, { useEffect, useRef, useState } from "react";

function PatternTimeline({
  pattern,
  bpm,
  currentTick = 0,
  isPlaying = false,
  snapToGrid,
  tracks,
  onPatternChange,
  onBpmChange,
  onSnapToggle,
  onAddTrack,
  onRemoveTrack,
  onUpdateTrackSound,
  TICKS_PER_BEAT = 480,
  BEATS_PER_LOOP = 16,
  PIXELS_PER_TICK = 0.1,
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

  // Handle track clicks for note placement
  const handleTrackMouseDown = (e, trackId) => {
    if (e.target.classList.contains("timeline-note")) return;

    const track = e.currentTarget;
    const rect = track.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const tick = x / PIXELS_PER_TICK;

    let snappedTick;
    if (snapToGrid) {
      const beatIndex = Math.floor(tick / TICKS_PER_BEAT);
      snappedTick = beatIndex * TICKS_PER_BEAT;
    } else {
      snappedTick = Math.round(tick);
    }

    const clampedTick = Math.max(0, Math.min(TOTAL_TICKS - 1, snappedTick));
    const existingNote = pattern[trackId]?.includes(clampedTick);

    if (existingNote) {
      onPatternChange({
        type: "remove-note",
        trackId,
        tick: clampedTick,
      });
    } else {
      onPatternChange({
        type: "add-note",
        trackId,
        tick: clampedTick,
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
      offsetX,
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

    setDraggedNote((prev) => ({
      ...prev,
      currentTick: clampedTick,
    }));
  };

  // Handle mouse up - finish drag
  const handleMouseUp = () => {
    if (isDragging && draggedNote && hasDragged) {
      onPatternChange({
        type: "move-note",
        trackId: draggedNote.trackId,
        fromTick: draggedNote.originalTick,
        toTick: draggedNote.currentTick,
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
      onPatternChange({
        type: "remove-note",
        trackId,
        tick,
      });
    }
  };

  // Add global mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [
    isDragging,
    draggedNote,
    snapToGrid,
    PIXELS_PER_TICK,
    TICKS_PER_BEAT,
    TOTAL_TICKS,
  ]);

  return (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="mb-0">Pattern Timeline</h5>
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
      </div>

      <div className="card-body">
        <div className="grid-container bg-white rounded shadow position-relative">
          {/* Grid Area with Track Labels */}
          <div
            className="position-relative"
            style={{ height: "400px", overflow: "auto" }}
          >
            {/* Track Labels (fixed position on left) */}
            <div
              className="position-absolute bg-light border-end"
              style={{
                left: 0,
                top: "50px",
                width: "120px",
                bottom: 0,
                zIndex: 20,
              }}
            >
              {tracks.map((track) => (
                <div
                  key={`label-${track.id}`}
                  className="d-flex align-items-center px-3 py-2 border-bottom"
                  style={{
                    height: "60px",
                    fontWeight: "bold",
                    color: "#495057",
                  }}
                >
                  <div
                    className="me-2"
                    style={{
                      width: "4px",
                      height: "24px",
                      borderRadius: "2px",
                      backgroundColor: track.color,
                    }}
                  ></div>
                  {track.name}
                </div>
              ))}
              <div className="p-2 border-bottom d-flex justify-content-center">
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={onAddTrack}
                >
                  + Add Track
                </button>
              </div>
            </div>

            {/* Beat Indicators */}
            <div
              className="position-absolute bg-white border-bottom"
              style={{
                top: "30px",
                left: "120px",
                right: 0,
                height: "20px",
                zIndex: 9,
              }}
            >
              {Array.from({ length: BEATS_PER_LOOP }, (_, i) => (
                <div
                  key={`beat-${i}`}
                  className="position-absolute h-100 d-flex align-items-center justify-content-center 
                             bg-success bg-opacity-10 text-success fw-bold"
                  style={{
                    left: `${i * BEAT_WIDTH}px`,
                    width: `${BEAT_WIDTH}px`,
                    fontSize: "10px",
                    borderRight: "1px solid #f1f3f4",
                  }}
                >
                  {(i % 4) + 1}
                </div>
              ))}
            </div>

            {/* Grid Canvas */}
            <div
              ref={gridRef}
              className="position-relative"
              style={{
                marginLeft: "120px",
                marginTop: "50px",
                width: `${GRID_WIDTH}px`,
                height: "calc(100% - 50px)",
              }}
            >
              {/* Track Lanes - Restored to your original styling */}
              <div>
                {tracks.map((track) => (
                  <div
                    key={`track-${track.id}`}
                    style={{
                      position: "relative",
                      height: "50px",
                      background: "#f8f9fa",
                      cursor: "crosshair",
                      borderRadius: "4px",
                      border: "1px solid #dee2e6",
                      marginBottom: "10px",
                    }}
                    onMouseDown={(e) => handleTrackMouseDown(e, track.id)}
                  >
                    {/* Beat separator lines - from your original implementation */}
                    {Array.from(
                      { length: BEATS_PER_LOOP + 1 },
                      (_, beatIndex) => (
                        <div
                          key={`line-${beatIndex}`}
                          style={{
                            position: "absolute",
                            top: "0",
                            bottom: "0",
                            left: `${beatIndex * BEAT_WIDTH}px`,
                            width: beatIndex % 4 === 0 ? "2px" : "1px",
                            background: beatIndex % 4 === 0 ? "#999" : "#ccc",
                            pointerEvents: "none",
                            zIndex: 1,
                          }}
                        />
                      )
                    )}

                    {/* Notes - exactly as in your original implementation */}
                    {pattern[track.id]?.map((tick) => {
                      const isBeingDragged =
                        draggedNote &&
                        draggedNote.trackId === track.id &&
                        draggedNote.originalTick === tick;

                      const displayTick = isBeingDragged
                        ? draggedNote.currentTick
                        : tick;

                      return (
                        <div
                          key={`${track.id}-${tick}`}
                          className="timeline-note"
                          style={{
                            position: "absolute",
                            left: `${displayTick * PIXELS_PER_TICK}px`,
                            width: "20px",
                            height: "40px",
                            top: "5px",
                            background: isBeingDragged
                              ? "#e67e22"
                              : track.color,
                            cursor: "grab",
                            borderRadius: "4px",
                            transition: isBeingDragged
                              ? "none"
                              : "background-color 0.1s ease",
                            zIndex: isBeingDragged ? 10 : 2,
                            border: "2px solid rgba(255,255,255,0.3)",
                          }}
                          onMouseDown={(e) =>
                            handleNoteMouseDown(e, track.id, tick)
                          }
                          onClick={(e) => handleNoteClick(e, track.id, tick)}
                          onMouseEnter={(e) => {
                            if (!isDragging) {
                              e.target.style.opacity = "0.8";
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.opacity = "1";
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Playhead */}
              <div
                ref={playheadRef}
                className="position-absolute"
                style={{
                  width: "2px",
                  background: "#e74c3c",
                  zIndex: 10,
                  pointerEvents: "none",
                  boxShadow: "0 0 4px rgba(231, 76, 60, 0.5)",
                  transition: isPlaying ? "none" : "left 0.1s ease",
                  top: 0,
                  height: `${tracks.length * 60}px`, // Dynamic height based on number of tracks (50px + 10px margin)
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PatternTimeline;
