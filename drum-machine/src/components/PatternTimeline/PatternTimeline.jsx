import React, { useEffect, useRef, useState } from "react";
import { Drum, Sliders } from "lucide-react";
import { useAppStore } from "../../stores";
import TransportControls from "../TransportControls/TransportControls";
import drumSounds from "../../assets/data/drum-sounds.json";
import "./PatternTimeline.css";

function TrackLabel({ track, drumSounds }) {
  const openSoundModal = useAppStore((state) => state.ui.openSoundModal);
  const openEffectsModal = useAppStore((state) => state.ui.openEffectsModal);

  // Get display name - either sound name or "Choose Sound..."
  const getDisplayName = () => {
    if (!track.soundFile) {
      return "Choose Sound...";
    }

    // Find the sound in the flat drumSounds array
    const soundObj = drumSounds.find((sound) => sound.file === track.soundFile);

    if (soundObj) {
      return soundObj.name;
    }

    // Hard-coded mapping for backward compatibility with old default tracks
    const defaultSoundNames = {
      "kicks/Ac_K.wav": "Acoustic Kick",
      "snares/Box_Snr2.wav": "Box Snare 2",
      "hihats/Jls_H.wav": "Jealous Hat",
      "cymbals/CL_OHH1.wav": "Closed Hi-Hat 1",
    };

    if (defaultSoundNames[track.soundFile]) {
      return defaultSoundNames[track.soundFile];
    }

    // Fallback to track name if sound not found
    return track.name;
  };

  return (
    <div className="track-label">
      <div
        className="track-color-indicator"
        style={{ backgroundColor: track.color }}
      />
      <span className="track-name">{getDisplayName()}</span>

      {/* Always visible controls - removed hover state logic */}
      <div className="track-controls">
        <button
          className="track-settings-btn"
          onClick={() => openSoundModal(track)}
          title="Change sound"
        >
          <Drum size={16} />
        </button>
        <button
          className="track-effects-btn"
          onClick={() => openEffectsModal(track)}
          title="Track effects"
        >
          <Sliders size={16} />
        </button>
      </div>
    </div>
  );
}

function PatternTimeline() {
  // Get all state from the single store
  const pattern = useAppStore((state) => state.pattern.data);
  const tracks = useAppStore((state) => state.tracks.list);
  const currentTick = useAppStore((state) => state.transport.currentTick);
  const isPlaying = useAppStore((state) => state.transport.isPlaying);
  const measureCount = useAppStore((state) => state.transport.measureCount);
  const TICKS_PER_BEAT = useAppStore((state) => state.transport.TICKS_PER_BEAT);
  const BEATS_PER_LOOP = useAppStore((state) => state.transport.BEATS_PER_LOOP);
  const snapToGrid = useAppStore((state) => state.ui.snapToGrid);

  // Get all pattern actions
  const addNote = useAppStore((state) => state.pattern.addNote);
  const removeNote = useAppStore((state) => state.pattern.removeNote);
  const moveNote = useAppStore((state) => state.pattern.moveNote);
  const updateNoteVelocity = useAppStore(
    (state) => state.pattern.updateNoteVelocity
  );
  const getNoteAt = useAppStore((state) => state.pattern.getNoteAt);

  // Get track actions
  const addTrack = useAppStore((state) => state.tracks.addTrack);

  const gridRef = useRef(null);
  const playheadRef = useRef(null);
  const [draggedNote, setDraggedNote] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);

  // Ghost note state
  const [ghostNote, setGhostNote] = useState(null);

  const MEASURES_PER_PAGE = 4;
  const BEATS_PER_PAGE = MEASURES_PER_PAGE * 4; // 16 beats total
  const PIXELS_PER_TICK = 0.128906;
  const BEAT_WIDTH = TICKS_PER_BEAT * PIXELS_PER_TICK;
  const GRID_WIDTH = BEATS_PER_PAGE * BEAT_WIDTH;

  const TOTAL_TICKS = TICKS_PER_BEAT * BEATS_PER_PAGE;

  // Helper function to get note height based on velocity
  const getNoteHeight = (velocity) => {
    const baseHeight = 40;
    const heightPercentage = velocity / 4;
    return baseHeight * heightPercentage;
  };

  // Helper function to get note top position (for vertical centering)
  const getNoteTop = (velocity) => {
    const baseHeight = 40;
    const actualHeight = getNoteHeight(velocity);
    const baseTop = 10;
    return baseTop + (baseHeight - actualHeight) / 2;
  };

  // Calculate ghost note position and tick
  const calculateGhostNote = (e, trackId) => {
    const track = e.currentTarget;
    const rect = track.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Convert click position to tick
    const clickTick = x / PIXELS_PER_TICK;

    // Center the note (subtract half note width in ticks)
    const noteWidthInTicks = 32 / PIXELS_PER_TICK;
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
    if (isDragging) return;

    const ghostData = calculateGhostNote(e, trackId);

    if (!ghostData.isInDisabledMeasure && !ghostData.hasExistingNote) {
      setGhostNote(ghostData);
    }
  };

  // Handle mouse move on track
  const handleTrackMouseMove = (e, trackId) => {
    if (isDragging) return;

    const target = e.target;
    if (target.classList.contains("timeline-note")) {
      setGhostNote(null);
      return;
    }

    const ghostData = calculateGhostNote(e, trackId);

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

  // Handle track clicks for note placement
  const handleTrackMouseDown = (e, trackId) => {
    if (e.target.classList.contains("timeline-note")) return;

    const track = e.currentTarget;
    const rect = track.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Convert click position to tick
    const clickTick = x / PIXELS_PER_TICK;

    const noteWidthInTicks = 32 / PIXELS_PER_TICK;
    const centeredTick = clickTick - noteWidthInTicks / 2;

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
      // Remove existing note - store handles WebSocket automatically
      removeNote(trackId, clampedTick);
    } else {
      // Add new note - store handles WebSocket automatically
      addNote(trackId, clampedTick, 4);
    }
  };

  // Handle note dragging start
  const handleNoteMouseDown = (e, trackId, tick) => {
    e.stopPropagation();
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

    const dragTick = x / PIXELS_PER_TICK;
    const noteWidthInTicks = 32 / PIXELS_PER_TICK;
    const centeredTick = dragTick - noteWidthInTicks / 2;

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
      // Move note - store handles WebSocket automatically
      moveNote(
        draggedNote.trackId,
        draggedNote.originalTick,
        draggedNote.currentTick
      );
    }

    setIsDragging(false);
    setDraggedNote(null);
    setTimeout(() => setHasDragged(false), 10);
  };

  // Handle note click
  const handleNoteClick = (e, trackId, tick) => {
    e.stopPropagation();
    if (!hasDragged) {
      if (e.ctrlKey || e.metaKey) {
        const currentNote = getNoteAt(trackId, tick);
        const currentVelocity = currentNote ? currentNote.velocity : 4;
        const nextVelocity = currentVelocity === 1 ? 4 : currentVelocity - 1;

        // Update velocity - store handles WebSocket automatically
        updateNoteVelocity(trackId, tick, nextVelocity);
      } else {
        // Remove note - store handles WebSocket automatically
        removeNote(trackId, tick);
      }
    }
  };

  // Handle track management
  const handleAddTrack = () => {
    const trackData = {
      name: `Track ${tracks.length + 1}`,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      soundFile: null,
      availableSounds: [],
    };

    // Add track - store handles WebSocket automatically
    addTrack(trackData);
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
    <div className="floating-card pattern-timeline">
      {/* Transport Controls Bar - INSIDE the card */}
      <TransportControls />

      {/* Grid Container - Now uses flexible layout */}
      <div className="timeline-grid-container">
        {/* Track Labels Sidebar - Fixed width */}
        <div className="track-sidebar">
          <div className="sidebar-header">TRACKS</div>

          {tracks.map((track) => (
            <TrackLabel
              key={`label-${track.id}`}
              track={track}
              drumSounds={drumSounds}
            />
          ))}

          <div className="add-track-container">
            <button className="add-track-btn" onClick={handleAddTrack}>
              + Add Track
            </button>
          </div>
        </div>

        {/* Grid Area - Flexible with scroll */}
        <div className="timeline-grid-area">
          {/* Beat Header */}
          <div className="beat-header">
            {/* Positioned Divider Lines - match grid exactly */}
            {Array.from({ length: BEATS_PER_PAGE }, (_, i) => {
              const tickPosition = (i + 1) * TICKS_PER_BEAT;
              const measureIndex = Math.floor(i / 4);
              const nextMeasureIndex = Math.floor((i + 1) / 4);

              const isCurrentDisabled = measureIndex >= measureCount;
              const isNextDisabled = nextMeasureIndex >= measureCount;

              if (
                i < BEATS_PER_PAGE - 1 &&
                !isCurrentDisabled &&
                !isNextDisabled
              ) {
                return (
                  <div
                    key={`header-divider-${i}`}
                    className={`header-divider ${
                      (i + 1) % 4 === 0 ? "header-divider--measure" : ""
                    }`}
                    style={{ left: `${tickPosition * PIXELS_PER_TICK}px` }}
                  />
                );
              }
              return null;
            })}

            {/* Measure Numbers */}
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

            {/* Beat Numbers */}
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

          {/* Track Grid - Fixed width */}
          <div ref={gridRef} className="track-grid">
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
                {/* Subdivision lines */}
                {Array.from(
                  { length: TOTAL_TICKS / (TICKS_PER_BEAT / 2) + 1 },
                  (_, subdivisionIndex) => {
                    const tickPosition =
                      subdivisionIndex * (TICKS_PER_BEAT / 2);
                    const beatPosition = tickPosition / TICKS_PER_BEAT;
                    const measureIndex = Math.floor(beatPosition / 4);

                    // Determine line type - only beat, measure, and eighth
                    let lineType;
                    if (tickPosition % TICKS_PER_BEAT === 0) {
                      lineType =
                        beatPosition % 4 === 0
                          ? "beat-line--measure"
                          : "beat-line--beat";
                    } else {
                      // All remaining lines are eighth notes
                      lineType = "beat-line--eighth";
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
                      height: `${getNoteHeight(4)}px`,
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
