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
  // NEW: Transport control props
  onPlay,
  onPause,
  onStop,
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

  // Calculate current position for display
  const currentBeat = Math.floor(currentTick / TICKS_PER_BEAT) + 1;

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
    <div className="bg-white rounded-3 shadow" style={{ overflow: "hidden" }}>
      {/* Integrated Controls Bar */}
      <div className="bg-light border-bottom px-4 py-3">
        <div className="row align-items-center">
          {/* Transport Controls */}
          <div className="col-auto">
            <div className="btn-group me-3" role="group">
              <button
                className={`btn ${isPlaying ? "btn-warning" : "btn-success"}`}
                onClick={isPlaying ? onPause : onPlay}
              >
                {isPlaying ? "⏸ Pause" : "▶ Play"}
              </button>
              <button className="btn btn-danger" onClick={onStop}>
                ⏹ Stop
              </button>
            </div>
            <button className="btn btn-warning">Loop</button>
          </div>

          {/* Position Display */}
          <div className="col-auto">
            <span className="badge bg-info me-2">
              Beat: {currentBeat}/{BEATS_PER_LOOP}
            </span>
            <span className="badge bg-secondary me-3">Tick: {currentTick}</span>
          </div>

          {/* Spacer */}
          <div className="col"></div>

          {/* Snap Toggle */}
          <div className="col-auto">
            <div className="form-check me-4">
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

          {/* BPM Control */}
          <div className="col-auto">
            <div className="d-flex align-items-center">
              <label className="form-label mb-0 me-2 fw-bold text-muted">
                BPM
              </label>
              <input
                type="range"
                className="form-range me-2"
                style={{ width: "120px" }}
                min="60"
                max="300"
                value={bpm}
                onChange={(e) => onBpmChange(parseInt(e.target.value))}
              />
              <span className="badge bg-primary fw-bold">{bpm}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Area */}
      <div
        className="position-relative"
        style={{ height: "400px", overflow: "auto" }}
      >
        {/* Track Labels (fixed position on left) */}
        <div
          className="position-absolute bg-light border-end"
          style={{
            left: 0,
            top: 0,
            width: "140px",
            bottom: 0,
            zIndex: 20,
          }}
        >
          {/* Beat Header */}
          <div
            className="border-bottom bg-white d-flex align-items-center justify-content-center fw-bold text-muted"
            style={{ height: "50px", fontSize: "12px" }}
          >
            TRACKS
          </div>

          {/* Track Labels */}
          {tracks.map((track) => (
            <div
              key={`label-${track.id}`}
              className="d-flex align-items-center px-3 py-2 border-bottom"
              style={{
                height: "60px",
                fontWeight: "600",
                color: "#495057",
                cursor: "pointer",
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

          {/* Add Track Button */}
          <div className="p-3 border-bottom d-flex justify-content-center">
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={onAddTrack}
            >
              + Add Track
            </button>
          </div>
        </div>

        {/* Grid Canvas Container */}
        <div style={{ marginLeft: "140px" }}>
          {/* Beat Indicators */}
          <div
            className="position-absolute bg-white border-bottom"
            style={{
              top: 0,
              left: "140px",
              right: 0,
              height: "50px",
              zIndex: 9,
            }}
          >
            {/* Measure Numbers */}
            <div className="d-flex h-50 border-bottom">
              {Array.from({ length: BEATS_PER_LOOP / 4 }, (_, i) => (
                <div
                  key={`measure-${i}`}
                  className="d-flex align-items-center justify-content-center fw-bold text-success"
                  style={{
                    width: `${BEAT_WIDTH * 4}px`,
                    fontSize: "14px",
                    borderRight:
                      i < BEATS_PER_LOOP / 4 - 1 ? "2px solid #dee2e6" : "none",
                    backgroundColor: "rgba(40,167,69,0.05)",
                  }}
                >
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Beat Numbers */}
            <div className="d-flex h-50">
              {Array.from({ length: BEATS_PER_LOOP }, (_, i) => (
                <div
                  key={`beat-${i}`}
                  className="d-flex align-items-center justify-content-center text-muted"
                  style={{
                    width: `${BEAT_WIDTH}px`,
                    fontSize: "10px",
                    borderRight: "1px solid #f1f3f4",
                    backgroundColor:
                      i % 4 === 0 ? "rgba(40,167,69,0.1)" : "transparent",
                    fontWeight: i % 4 === 0 ? "600" : "normal",
                  }}
                >
                  {(i % 4) + 1}
                </div>
              ))}
            </div>
          </div>

          {/* Grid Canvas */}
          <div
            ref={gridRef}
            className="position-relative"
            style={{
              marginTop: "50px",
              width: `${GRID_WIDTH}px`,
              height: "calc(100% - 50px)",
            }}
          >
            {/* Track Lanes */}
            <div>
              {tracks.map((track, trackIndex) => (
                <div
                  key={`track-${track.id}`}
                  className={
                    trackIndex % 2 === 0 ? "bg-white" : "bg-light bg-opacity-50"
                  }
                  style={{
                    position: "relative",
                    height: "60px",
                    cursor: "crosshair",
                    borderBottom: "1px solid #f1f3f4",
                  }}
                  onMouseDown={(e) => handleTrackMouseDown(e, track.id)}
                >
                  {/* Beat separator lines */}
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
                          background:
                            beatIndex % 4 === 0 ? "#adb5bd" : "#dee2e6",
                          pointerEvents: "none",
                          zIndex: 1,
                        }}
                      />
                    )
                  )}

                  {/* Notes */}
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
                        className="timeline-note shadow-sm"
                        style={{
                          position: "absolute",
                          left: `${displayTick * PIXELS_PER_TICK}px`,
                          width: "24px",
                          height: "40px",
                          top: "10px",
                          background: isBeingDragged ? "#fd7e14" : track.color,
                          cursor: "grab",
                          borderRadius: "6px",
                          transition: isBeingDragged
                            ? "none"
                            : "all 0.15s ease",
                          zIndex: isBeingDragged ? 10 : 2,
                          border: "2px solid rgba(255,255,255,0.4)",
                        }}
                        onMouseDown={(e) =>
                          handleNoteMouseDown(e, track.id, tick)
                        }
                        onClick={(e) => handleNoteClick(e, track.id, tick)}
                        onMouseEnter={(e) => {
                          if (!isDragging) {
                            e.target.style.transform = "scale(1.05)";
                            e.target.style.opacity = "0.9";
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = "scale(1)";
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
                width: "3px",
                background: "linear-gradient(to bottom, #007bff, #0056b3)",
                zIndex: 10,
                pointerEvents: "none",
                boxShadow: "0 0 8px rgba(0, 123, 255, 0.6)",
                borderRadius: "1px",
                transition: isPlaying ? "none" : "left 0.1s ease",
                top: 0,
                height: `${tracks.length * 60}px`,
              }}
            >
              {/* Playhead indicator triangle */}
              <div
                style={{
                  position: "absolute",
                  top: "-8px",
                  left: "-6px",
                  width: 0,
                  height: 0,
                  borderLeft: "6px solid transparent",
                  borderRight: "6px solid transparent",
                  borderTop: "8px solid #007bff",
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
