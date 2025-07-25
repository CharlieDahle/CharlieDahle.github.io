import React, { useEffect, useRef, useState } from "react";
import { Settings } from "lucide-react";
import { useUIStore } from "../../stores/useUIStore";
import { usePatternStore } from "../../stores/usePatternStore";
import { useTrackStore } from "../../stores/useTrackStore";
import { useTransportStore } from "../../stores/useTransportStore";
import { useWebSocketStore } from "../../stores/useWebSocketStore";
import drumSounds from "../../assets/data/drum-sounds.json";
import "./PatternTimeline.css";

// TrackLabel component with hover controls
function TrackLabel({ track }) {
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
            className="btn btn-sm btn-outline-secondary"
            style={{
              fontSize: "12px",
              width: "24px",
              height: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0",
            }}
            onClick={() => openSoundModal(track)}
            title="Change sound"
          >
            <Settings size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function PatternTimeline({ onPlay, onPause, onStop }) {
  // Get all state from stores
  const {
    pattern,
    addNote,
    removeNote,
    moveNote,
    clearTrack,
    updateNoteVelocity,
    getNoteAt,
  } = usePatternStore();
  const { tracks, addTrack, removeTrack, updateTrackSound } = useTrackStore();
  const {
    bpm,
    currentTick,
    isPlaying,
    measureCount,
    setBpm,
    addMeasure,
    removeMeasure,
    TICKS_PER_BEAT,
    BEATS_PER_LOOP,
    getTotalTicks,
  } = useTransportStore();
  const {
    sendPatternChange,
    sendBpmChange,
    sendMeasureCountChange,
    sendAddTrack,
    sendRemoveTrack,
  } = useWebSocketStore();

  // Get snap state from UI store
  const { snapToGrid, setSnapToGrid } = useUIStore();

  const gridRef = useRef(null);
  const playheadRef = useRef(null);
  const [draggedNote, setDraggedNote] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);

  // Ghost note state
  const [ghostNote, setGhostNote] = useState(null); // { trackId, tick, position }

  // FIXED WIDTH CALCULATIONS
  const MEASURES_PER_PAGE = 4; // Always show 4 measures
  const BEATS_PER_PAGE = MEASURES_PER_PAGE * 4; // 16 beats total
  const PIXELS_PER_TICK = 0.15;
  const BEAT_WIDTH = TICKS_PER_BEAT * PIXELS_PER_TICK; // 48px per beat
  const FIXED_GRID_WIDTH = BEATS_PER_PAGE * BEAT_WIDTH; // 768px total grid
  const SIDEBAR_WIDTH = 170; // From CSS
  const TOTAL_WIDTH = SIDEBAR_WIDTH + FIXED_GRID_WIDTH; // 938px total

  // Use fixed values instead of dynamic ones
  const TOTAL_TICKS = TICKS_PER_BEAT * BEATS_PER_PAGE; // Fixed to 16 beats

  // Helper function to get note height based on velocity
  const getNoteHeight = (velocity) => {
    const baseHeight = 40; // From CSS --note-height
    const heightPercentage = velocity / 4; // velocity 1-4 maps to 25%-100%
    return baseHeight * heightPercentage;
  };

  // Helper function to get note top position (for vertical centering)
  const getNoteTop = (velocity) => {
    const baseHeight = 40;
    const actualHeight = getNoteHeight(velocity);
    const baseTop = 10; // From CSS --note-margin
    return baseTop + (baseHeight - actualHeight) / 2;
  };

  // Calculate ghost note position and tick
  const calculateGhostNote = (e, trackId) => {
    const track = e.currentTarget;
    const rect = track.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Convert click position to tick with snap offset adjustment
    const SNAP_OFFSET_PIXELS = -12; // Adjust this value to align with grid lines (negative to shift left)
    const adjustedX = x + SNAP_OFFSET_PIXELS;
    const clickTick = adjustedX / PIXELS_PER_TICK;

    // Center the note (subtract half note width in ticks)
    const noteWidthInTicks = 24 / PIXELS_PER_TICK;
    const centeredTick = clickTick - noteWidthInTicks / 2;

    // Apply snap-to-grid logic
    let snappedTick;
    if (snapToGrid) {
      const eighthNoteIndex = Math.round(centeredTick / (TICKS_PER_BEAT / 2));
      snappedTick = eighthNoteIndex * (TICKS_PER_BEAT / 2);
    } else {
      snappedTick = Math.round(centeredTick);
    }

    const clampedTick = Math.max(0, Math.min(TOTAL_TICKS - 1, snappedTick));

    // Check if this position is in a disabled measure
    const beatPosition = clampedTick / TICKS_PER_BEAT;
    const measureIndex = Math.floor(beatPosition / 4);
    const isInDisabledMeasure = measureIndex >= measureCount;

    // Check if there's already a note at this position
    const existingNote = getNoteAt(trackId, clampedTick);

    return {
      trackId,
      tick: clampedTick,
      position: clampedTick * PIXELS_PER_TICK,
      isInDisabledMeasure,
      hasExistingNote: !!existingNote,
    };
  };

  // Handle mouse enter track
  const handleTrackMouseEnter = (e, trackId) => {
    // Only show ghost in free placement mode (not during drag)
    if (isDragging) return;

    const ghostData = calculateGhostNote(e, trackId);

    // Only show ghost if it's valid (not in disabled measure, not over existing note)
    if (!ghostData.isInDisabledMeasure && !ghostData.hasExistingNote) {
      setGhostNote(ghostData);
    }
  };

  // Handle mouse move on track
  const handleTrackMouseMove = (e, trackId) => {
    // Only update ghost in free placement mode
    if (isDragging) return;

    // Check if we're hovering over a real note
    const target = e.target;
    if (target.classList.contains("timeline-note")) {
      // Hide ghost when hovering over a real note
      setGhostNote(null);
      return;
    }

    const ghostData = calculateGhostNote(e, trackId);

    // Only show ghost if it's valid
    if (!ghostData.isInDisabledMeasure && !ghostData.hasExistingNote) {
      setGhostNote(ghostData);
    } else {
      setGhostNote(null);
    }
  };

  // Handle mouse leave track
  const handleTrackMouseLeave = () => {
    setGhostNote(null);
  };

  // Update playhead position when currentTick changes
  useEffect(() => {
    if (playheadRef.current) {
      const position = currentTick * PIXELS_PER_TICK;
      playheadRef.current.style.transform = `translateX(${position}px)`;
    }
  }, [currentTick, PIXELS_PER_TICK]);

  // Handle pattern changes
  const handlePatternChange = (change) => {
    // Check if track still exists
    const trackExists = tracks.some((track) => track.id === change.trackId);
    if (!trackExists) {
      console.warn("Pattern change for non-existent track:", change.trackId);
      return;
    }

    // Update store directly
    switch (change.type) {
      case "add-note":
        addNote(change.trackId, change.tick, change.velocity);
        break;
      case "remove-note":
        removeNote(change.trackId, change.tick);
        break;
      case "move-note":
        moveNote(change.trackId, change.fromTick, change.toTick);
        break;
      case "update-note-velocity":
        updateNoteVelocity(change.trackId, change.tick, change.velocity);
        break;
      case "clear-track":
        clearTrack(change.trackId);
        break;
      default:
        console.warn("Unknown pattern change type:", change.type);
    }

    // Send to server
    sendPatternChange(change);
  };

  // Handle BPM changes
  const handleBpmChange = (newBpm) => {
    setBpm(newBpm);
    sendBpmChange(newBpm);
  };

  // Handle measure changes
  const handleMeasureChange = (newMeasureCount) => {
    // Just notify server for sync - store is already updated by button handlers
    sendMeasureCountChange(newMeasureCount);
  };

  // Handle track management
  const handleAddTrack = () => {
    const trackData = {
      name: `Track ${tracks.length + 1}`,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      soundFile: null,
      availableSounds: [],
    };

    const newTrack = addTrack(trackData);
    sendAddTrack(newTrack);
  };

  // Handle track clicks for note placement
  const handleTrackMouseDown = (e, trackId) => {
    if (e.target.classList.contains("timeline-note")) return;

    const track = e.currentTarget;
    const rect = track.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Convert click position to tick with same snap offset as ghost note
    const SNAP_OFFSET_PIXELS = -12; // Same offset as ghost note calculation (negative to shift left)
    const adjustedX = x + SNAP_OFFSET_PIXELS;
    const clickTick = adjustedX / PIXELS_PER_TICK;

    // STEP 1: Center the note (subtract half note width in ticks)
    const noteWidthInTicks = 24 / PIXELS_PER_TICK; // 24px converted to ticks
    const centeredTick = clickTick - noteWidthInTicks / 2;

    // STEP 2: Apply snap-to-grid on the centered position
    let snappedTick;
    if (snapToGrid) {
      const eighthNoteIndex = Math.round(centeredTick / (TICKS_PER_BEAT / 2));
      snappedTick = eighthNoteIndex * (TICKS_PER_BEAT / 2);
    } else {
      snappedTick = Math.round(centeredTick);
    }

    const clampedTick = Math.max(0, Math.min(TOTAL_TICKS - 1, snappedTick));
    const existingNote = getNoteAt(trackId, clampedTick);

    if (existingNote) {
      handlePatternChange({
        type: "remove-note",
        trackId,
        tick: clampedTick,
      });
    } else {
      handlePatternChange({
        type: "add-note",
        trackId,
        tick: clampedTick,
        velocity: 4, // Default to max velocity
      });
    }
  };

  // Handle note dragging start
  const handleNoteMouseDown = (e, trackId, tick) => {
    e.stopPropagation();

    // Clear ghost note when starting to drag
    setGhostNote(null);

    setIsDragging(true);
    setHasDragged(false);
    setDraggedNote({
      trackId,
      originalTick: tick,
      currentTick: tick,
    });
  };

  // Handle mouse move during drag
  const handleMouseMove = (e) => {
    if (!isDragging || !draggedNote) return;

    setHasDragged(true);

    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Convert position to tick (now cursor will be centered on note)
    const dragTick = x / PIXELS_PER_TICK;

    // STEP 1: Center the note (subtract half note width in ticks)
    const noteWidthInTicks = 24 / PIXELS_PER_TICK; // 24px converted to ticks
    const centeredTick = dragTick - noteWidthInTicks / 2;

    // STEP 2: Apply snap-to-grid on the centered position
    let snappedTick;
    if (snapToGrid) {
      const eighthNoteIndex = Math.round(centeredTick / (TICKS_PER_BEAT / 2));
      snappedTick = eighthNoteIndex * (TICKS_PER_BEAT / 2);
    } else {
      snappedTick = Math.round(centeredTick);
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
      handlePatternChange({
        type: "move-note",
        trackId: draggedNote.trackId,
        fromTick: draggedNote.originalTick,
        toTick: draggedNote.currentTick,
      });
    }

    setIsDragging(false);
    setDraggedNote(null);
    setTimeout(() => setHasDragged(false), 10);

    // Ghost note will reappear naturally on next mouse move
  };

  // Handle note click (delete if not dragged, velocity change if Ctrl+click)
  const handleNoteClick = (e, trackId, tick) => {
    e.stopPropagation();
    if (!hasDragged) {
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+click: cycle velocity down from max
        const currentNote = getNoteAt(trackId, tick);
        const currentVelocity = currentNote ? currentNote.velocity : 4;
        const nextVelocity = currentVelocity === 1 ? 4 : currentVelocity - 1; // Cycle 4→3→2→1→4

        handlePatternChange({
          type: "update-note-velocity",
          trackId,
          tick,
          velocity: nextVelocity,
        });
      } else {
        // Regular click: delete note
        handlePatternChange({
          type: "remove-note",
          trackId,
          tick,
        });
      }
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
    <div className="pattern-timeline" style={{ width: `${TOTAL_WIDTH}px` }}>
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

          {/* Measure Controls */}
          <div className="measure-controls d-flex align-items-center gap-2">
            <span className="text-muted fw-bold">Measures:</span>

            {/* Subtract button - only show if more than 1 measure */}
            {measureCount > 1 && (
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => {
                  removeMeasure();
                  handleMeasureChange(measureCount - 1);
                }}
                title="Remove measure"
              >
                −
              </button>
            )}

            <span className="badge bg-secondary">{measureCount}</span>

            {/* Add button - only show if less than 4 measures */}
            {measureCount < 4 && (
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => {
                  addMeasure();
                  handleMeasureChange(measureCount + 1);
                }}
                title="Add measure"
              >
                +
              </button>
            )}
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
              Snap to grid
            </label>
          </div>

          {/* BPM Control */}
          <div className="bmp-control">
            <label className="bmp-label">BPM</label>
            <input
              type="range"
              className="bmp-slider"
              min="60"
              max="300"
              value={bpm}
              onChange={(e) => handleBpmChange(parseInt(e.target.value))}
            />
            <span className="bmp-value">{bpm}</span>
          </div>
        </div>
      </div>

      {/* Grid Container - Fixed width, no scrolling */}
      <div className="timeline-grid-container">
        {/* Track Labels Sidebar */}
        <div className="track-sidebar">
          <div className="sidebar-header">TRACKS</div>

          {tracks.map((track) => (
            <TrackLabel key={`label-${track.id}`} track={track} />
          ))}

          <div className="add-track-container">
            <button className="btn btn-add-track" onClick={handleAddTrack}>
              + Add Track
            </button>
          </div>
        </div>

        {/* Grid Area - Fixed width */}
        <div
          className="timeline-grid-area"
          style={{ width: `${FIXED_GRID_WIDTH}px` }}
        >
          {/* Beat Header */}
          <div className="beat-header">
            {/* Measure Numbers - Always show 4 measures */}
            <div className="measure-row">
              {Array.from({ length: MEASURES_PER_PAGE }, (_, i) => (
                <div
                  key={`measure-${i}`}
                  className={`measure-cell ${
                    i >= measureCount ? "measure-cell--disabled" : ""
                  }`}
                  style={{ width: `${BEAT_WIDTH * 4}px` }}
                >
                  {i < measureCount ? i + 1 : ""}
                </div>
              ))}
            </div>

            {/* Beat Numbers - Always show 16 beats */}
            <div className="beat-row">
              {Array.from({ length: BEATS_PER_PAGE }, (_, i) => (
                <div
                  key={`beat-${i}`}
                  className={`beat-cell ${
                    i % 4 === 0 ? "beat-cell--downbeat" : ""
                  } ${
                    Math.floor(i / 4) >= measureCount
                      ? "beat-cell--disabled"
                      : ""
                  }`}
                  style={{ width: `${BEAT_WIDTH}px` }}
                >
                  {Math.floor(i / 4) < measureCount ? (i % 4) + 1 : ""}
                </div>
              ))}
            </div>
          </div>

          {/* Track Grid */}
          <div
            ref={gridRef}
            className="track-grid"
            style={{ width: `${FIXED_GRID_WIDTH}px` }}
          >
            {/* Track Lanes */}
            {tracks.map((track, trackIndex) => (
              <div
                key={`track-${track.id}`}
                className={`track-lane ${
                  trackIndex % 2 === 0 ? "track-lane--even" : "track-lane--odd"
                }`}
                onMouseDown={(e) => handleTrackMouseDown(e, track.id)}
                onMouseEnter={(e) => handleTrackMouseEnter(e, track.id)}
                onMouseMove={(e) => handleTrackMouseMove(e, track.id)}
                onMouseLeave={handleTrackMouseLeave}
              >
                {/* Subdivision lines - 16th, 8th, and quarter notes */}
                {Array.from(
                  { length: TOTAL_TICKS / (TICKS_PER_BEAT / 4) + 1 },
                  (_, subdivisionIndex) => {
                    const tickPosition =
                      subdivisionIndex * (TICKS_PER_BEAT / 4); // Every 16th note
                    const beatPosition = tickPosition / TICKS_PER_BEAT;
                    const measureIndex = Math.floor(beatPosition / 4);

                    // Determine line type
                    let lineType;
                    if (tickPosition % TICKS_PER_BEAT === 0) {
                      // Quarter note (beat)
                      lineType =
                        beatPosition % 4 === 0
                          ? "beat-line--measure"
                          : "beat-line--beat";
                    } else if (tickPosition % (TICKS_PER_BEAT / 2) === 0) {
                      // 8th note
                      lineType = "beat-line--eighth";
                    } else {
                      // 16th note
                      lineType = "beat-line--sixteenth";
                    }

                    return (
                      <div
                        key={`subdivision-${subdivisionIndex}`}
                        className={`beat-line ${lineType} ${
                          measureIndex >= measureCount
                            ? "beat-line--disabled"
                            : ""
                        }`}
                        style={{ left: `${tickPosition * PIXELS_PER_TICK}px` }}
                      />
                    );
                  }
                )}

                {/* Disabled overlay for unused measures */}
                {measureCount < MEASURES_PER_PAGE && (
                  <div
                    className="disabled-measures-overlay"
                    style={{
                      left: `${measureCount * 4 * BEAT_WIDTH}px`,
                      width: `${
                        (MEASURES_PER_PAGE - measureCount) * 4 * BEAT_WIDTH
                      }px`,
                    }}
                  />
                )}

                {/* Real Notes */}
                {pattern[track.id]?.map((noteData) => {
                  // Handle both old format (numbers) and new format (objects)
                  const note =
                    typeof noteData === "number"
                      ? { tick: noteData, velocity: 4 }
                      : noteData;

                  const isBeingDragged =
                    draggedNote &&
                    draggedNote.trackId === track.id &&
                    draggedNote.originalTick === note.tick;

                  const displayTick = isBeingDragged
                    ? draggedNote.currentTick
                    : note.tick;

                  return (
                    <div
                      key={`${track.id}-${note.tick}`}
                      className={`timeline-note ${
                        isBeingDragged ? "timeline-note--dragging" : ""
                      }`}
                      style={{
                        left: `${displayTick * PIXELS_PER_TICK}px`,
                        height: `${getNoteHeight(note.velocity)}px`,
                        top: `${getNoteTop(note.velocity)}px`,
                        backgroundColor: track.color,
                      }}
                      onMouseDown={(e) =>
                        handleNoteMouseDown(e, track.id, note.tick)
                      }
                      onClick={(e) => handleNoteClick(e, track.id, note.tick)}
                      title={`Velocity: ${note.velocity}/4 (Ctrl+click to change)`}
                    />
                  );
                })}

                {/* Ghost Note */}
                {ghostNote && ghostNote.trackId === track.id && (
                  <div
                    className="timeline-note timeline-note--ghost"
                    style={{
                      left: `${ghostNote.position}px`,
                      height: `${getNoteHeight(4)}px`, // Default velocity for ghost
                      top: `${getNoteTop(4)}px`,
                    }}
                  />
                )}
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
