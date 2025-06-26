import React, { useEffect, useRef, useState } from "react";
import { useUIStore } from "../../stores/useUIStore";
import drumSounds from "../../assets/data/drum-sounds.json";
import "./PatternTimeline.css";

// TrackLabel component with hover controls
function TrackLabel({ track, onSoundChange }) {
  const [showControls, setShowControls] = useState(false);
  const { openSoundModal } = useUIStore();

  // Get display name - either sound name or "Choose Sound..."
  const getDisplayName = () => {
    if (!track.soundFile) {
      return "Choose Sound...";
    }

    // Hard-coded mapping for the first four default tracks
    const defaultSoundNames = {
      "kicks/Ac_K.wav": "Acoustic Kick",
      "snares/Box_Snr2.wav": "Box Snare 2",
      "hihats/Jls_H.wav": "Jealous Hat",
      "cymbals/CL_OHH1.wav": "Closed Hi-Hat 1",
    };

    if (defaultSoundNames[track.soundFile]) {
      return defaultSoundNames[track.soundFile];
    }

    // Find the sound name from drumSounds for other sounds
    for (const category of Object.values(drumSounds)) {
      const sound = category.find((s) => s.file === track.soundFile);
      if (sound) {
        return sound.name;
      }
    }

    // Fallback to track name if sound not found
    return track.name;
  };

  return (
    <div
      className="track-label"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <div
        className="track-color-indicator"
        style={{ backgroundColor: track.color }}
      />
      <span className="track-name">{getDisplayName()}</span>

      {showControls && (
        <div className="ms-auto d-flex gap-1">
          <button
            className="btn btn-sm btn-outline-secondary p-1"
            style={{ fontSize: "12px", width: "24px", height: "24px" }}
            onClick={() => openSoundModal(track)}
            title="Change sound"
          >
            ⚙
          </button>
        </div>
      )}
    </div>
  );
}

function PatternTimeline({
  pattern,
  bpm,
  currentTick = 0,
  isPlaying = false,
  tracks,
  onPatternChange,
  onBpmChange,
  onAddTrack,
  onRemoveTrack,
  onUpdateTrackSound,
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

  // Get snap state from UI store
  const { snapToGrid, setSnapToGrid } = useUIStore();

  const TOTAL_TICKS = TICKS_PER_BEAT * BEATS_PER_LOOP;
  const BEAT_WIDTH = TICKS_PER_BEAT * PIXELS_PER_TICK;
  const GRID_WIDTH = TOTAL_TICKS * PIXELS_PER_TICK;

  // Calculate current position for display
  const currentBeat = Math.floor(currentTick / TICKS_PER_BEAT) + 1;

  // Update playhead position when currentTick changes
  useEffect(() => {
    if (playheadRef.current) {
      const position = currentTick * PIXELS_PER_TICK;
      playheadRef.current.style.transform = `translateX(${position}px)`;
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

  const TRACK_HEIGHT = 60;

  return (
    <div className="pattern-timeline">
      {/* Transport Controls Bar */}
      <div className="timeline-controls">
        <div className="controls-section">
          {/* Transport Controls */}
          <div className="transport-controls">
            <button
              className={`btn btn-transport ${
                isPlaying ? "btn-pause" : "btn-play"
              }`}
              onClick={isPlaying ? onPause : onPlay}
            >
              {isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>
            <button className="btn btn-transport btn-stop" onClick={onStop}>
              ⏹ Stop
            </button>
            <button className="btn btn-transport btn-loop">Loop</button>
          </div>

          {/* Position Display */}
          <div className="position-display">
            <span className="position-badge position-badge--beat">
              Beat: {currentBeat}/{BEATS_PER_LOOP}
            </span>
            <span className="position-badge position-badge--tick">
              Tick: {currentTick}
            </span>
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
              Snap to beat
            </label>
          </div>

          {/* BPM Control */}
          <div className="bpm-control">
            <label className="bpm-label">BPM</label>
            <input
              type="range"
              className="bmp-slider"
              min="60"
              max="300"
              value={bpm}
              onChange={(e) => onBpmChange(parseInt(e.target.value))}
            />
            <span className="bpm-value">{bpm}</span>
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <div className="timeline-grid-container">
        {/* Track Labels Sidebar */}
        <div className="track-sidebar">
          <div className="sidebar-header">TRACKS</div>

          {tracks.map((track) => (
            <TrackLabel
              key={`label-${track.id}`}
              track={track}
              onSoundChange={onUpdateTrackSound}
            />
          ))}

          <div className="add-track-container">
            <button className="btn btn-add-track" onClick={onAddTrack}>
              + Add Track
            </button>
          </div>
        </div>

        {/* Grid Area */}
        <div className="timeline-grid-area">
          {/* Beat Header */}
          <div className="beat-header">
            {/* Measure Numbers */}
            <div className="measure-row">
              {Array.from({ length: BEATS_PER_LOOP / 4 }, (_, i) => (
                <div
                  key={`measure-${i}`}
                  className="measure-cell"
                  style={{ width: `${BEAT_WIDTH * 4}px` }}
                >
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Beat Numbers */}
            <div className="beat-row">
              {Array.from({ length: BEATS_PER_LOOP }, (_, i) => (
                <div
                  key={`beat-${i}`}
                  className={`beat-cell ${
                    i % 4 === 0 ? "beat-cell--downbeat" : ""
                  }`}
                  style={{ width: `${BEAT_WIDTH}px` }}
                >
                  {(i % 4) + 1}
                </div>
              ))}
            </div>
          </div>

          {/* Track Grid */}
          <div
            ref={gridRef}
            className="track-grid"
            style={{ width: `${GRID_WIDTH}px` }}
          >
            {/* Track Lanes */}
            {tracks.map((track, trackIndex) => (
              <div
                key={`track-${track.id}`}
                className={`track-lane ${
                  trackIndex % 2 === 0 ? "track-lane--even" : "track-lane--odd"
                }`}
                onMouseDown={(e) => handleTrackMouseDown(e, track.id)}
              >
                {/* Beat separator lines */}
                {Array.from({ length: BEATS_PER_LOOP + 1 }, (_, beatIndex) => (
                  <div
                    key={`line-${beatIndex}`}
                    className={`beat-line ${
                      beatIndex % 4 === 0
                        ? "beat-line--measure"
                        : "beat-line--beat"
                    }`}
                    style={{ left: `${beatIndex * BEAT_WIDTH}px` }}
                  />
                ))}

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
                      className={`timeline-note ${
                        isBeingDragged ? "timeline-note--dragging" : ""
                      }`}
                      style={{
                        left: `${displayTick * PIXELS_PER_TICK}px`,
                        backgroundColor: track.color,
                      }}
                      onMouseDown={(e) =>
                        handleNoteMouseDown(e, track.id, tick)
                      }
                      onClick={(e) => handleNoteClick(e, track.id, tick)}
                    />
                  );
                })}
              </div>
            ))}

            {/* Playhead */}
            <div
              ref={playheadRef}
              className={`playhead ${isPlaying ? "playhead--playing" : ""}`}
              style={{ height: `${tracks.length * TRACK_HEIGHT}px` }}
            >
              <div className="playhead-indicator" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PatternTimeline;
