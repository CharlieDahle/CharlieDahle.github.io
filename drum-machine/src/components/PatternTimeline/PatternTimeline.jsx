// src/components/PatternTimeline/PatternTimeline.jsx
import React, { useEffect, useRef, useState } from "react";
import { useDrumDataStore } from "../../stores/useDrumDataStore";
import { useTransportStore } from "../../stores/useTransportStore";
import { useUIStore } from "../../stores/useUIStore";
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

    // Hard-coded mapping for default tracks (you can expand this)
    const defaultSoundNames = {
      "kicks/Ac_K.wav": "Acoustic Kick",
      "snares/Box_Snr2.wav": "Box Snare 2",
      "hihats/Jls_H.wav": "Jealous Hat",
      "cymbals/CL_OHH1.wav": "Closed Hi-Hat 1",
    };

    return defaultSoundNames[track.soundFile] || track.name;
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

function PatternTimeline({ onPlay, onPause, onStop }) {
  // ============ STORE SUBSCRIPTIONS ============

  // Hot state (playhead position)
  const { isPlaying, currentTick } = useTransportStore();

  // Warm state (pattern data and coordination)
  const {
    pattern,
    tracks,
    bpm,
    measureCount,
    addNoteAndSync,
    removeNoteAndSync,
    moveNoteAndSync,
    setBpmAndSync,
    addMeasureAndSync,
    removeMeasureAndSync,
    addTrackAndSync,
    getTotalTicks,
  } = useDrumDataStore();

  // UI preferences
  const { snapToGrid, setSnapToGrid } = useUIStore();

  // ============ REFS AND LOCAL STATE ============

  const gridRef = useRef(null);
  const playheadRef = useRef(null);

  // Drag state
  const [draggedNote, setDraggedNote] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);

  // ============ CONSTANTS ============

  const MEASURES_PER_PAGE = 4;
  const BEATS_PER_PAGE = MEASURES_PER_PAGE * 4;
  const TICKS_PER_BEAT = 480;
  const PIXELS_PER_TICK = 0.15;
  const BEAT_WIDTH = TICKS_PER_BEAT * PIXELS_PER_TICK;
  const FIXED_GRID_WIDTH = BEATS_PER_PAGE * BEAT_WIDTH;
  const SIDEBAR_WIDTH = 170;
  const TOTAL_WIDTH = SIDEBAR_WIDTH + FIXED_GRID_WIDTH;
  const TOTAL_TICKS = TICKS_PER_BEAT * BEATS_PER_PAGE;

  // ============ COMPUTED VALUES ============

  const currentBeat = Math.floor(currentTick / TICKS_PER_BEAT) + 1;

  // ============ PLAYHEAD UPDATE ============

  useEffect(() => {
    if (playheadRef.current) {
      const position = currentTick * PIXELS_PER_TICK;
      playheadRef.current.style.transform = `translateX(${position}px)`;
    }
  }, [currentTick]);

  // ============ HELPER FUNCTIONS ============

  const convertClickToTick = (clickX) => {
    const rawTick = clickX / PIXELS_PER_TICK;
    const noteWidthInTicks = 24 / PIXELS_PER_TICK;
    const centeredTick = rawTick - noteWidthInTicks / 2;

    let snappedTick;
    if (snapToGrid) {
      const eighthNoteIndex = Math.round(centeredTick / (TICKS_PER_BEAT / 2));
      snappedTick = eighthNoteIndex * (TICKS_PER_BEAT / 2);
    } else {
      snappedTick = Math.round(centeredTick);
    }

    return Math.max(0, Math.min(TOTAL_TICKS - 1, snappedTick));
  };

  // ============ TRACK INTERACTION HANDLERS ============

  const handleTrackMouseDown = (e, trackId) => {
    if (e.target.classList.contains("timeline-note")) return;

    const track = e.currentTarget;
    const rect = track.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const tick = convertClickToTick(x);

    const existingNote = pattern[trackId]?.includes(tick);

    if (existingNote) {
      removeNoteAndSync(trackId, tick);
    } else {
      addNoteAndSync(trackId, tick);
    }
  };

  // ============ NOTE DRAGGING HANDLERS ============

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

  const handleMouseMove = (e) => {
    if (!isDragging || !draggedNote) return;

    setHasDragged(true);

    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - draggedNote.offsetX;
    const tick = convertClickToTick(x + 24 / 2); // Adjust for note center

    setDraggedNote((prev) => ({
      ...prev,
      currentTick: tick,
    }));
  };

  const handleMouseUp = () => {
    if (isDragging && draggedNote && hasDragged) {
      if (draggedNote.originalTick !== draggedNote.currentTick) {
        moveNoteAndSync(
          draggedNote.trackId,
          draggedNote.originalTick,
          draggedNote.currentTick
        );
      }
    }

    setIsDragging(false);
    setDraggedNote(null);
    setTimeout(() => setHasDragged(false), 10);
  };

  const handleNoteClick = (e, trackId, tick) => {
    e.stopPropagation();
    if (!hasDragged) {
      removeNoteAndSync(trackId, tick);
    }
  };

  // ============ MOUSE EVENT LISTENERS ============

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, draggedNote, snapToGrid]);

  // ============ TRACK MANAGEMENT HANDLERS ============

  const handleAddTrack = () => {
    const trackData = {
      name: `Track ${tracks.length + 1}`,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      soundFile: null,
    };

    addTrackAndSync(trackData);
  };

  // ============ RENDER ============

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

          {/* Position Display */}
          <div className="position-display">
            <span className="position-badge position-badge--beat">
              Beat: {currentBeat}/{BEATS_PER_PAGE}
            </span>
            <span className="position-badge position-badge--tick">
              Tick: {currentTick}
            </span>
          </div>

          {/* Measure Controls */}
          <div className="measure-controls d-flex align-items-center gap-2">
            <span className="text-muted fw-bold">Measures:</span>

            {measureCount > 1 && (
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={removeMeasureAndSync}
                title="Remove measure"
              >
                −
              </button>
            )}

            <span className="badge bg-secondary">{measureCount}</span>

            {measureCount < 4 && (
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={addMeasureAndSync}
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
          <div className="bpm-control">
            <label className="bpm-label">BPM</label>
            <input
              type="range"
              className="bpm-slider"
              min="60"
              max="300"
              value={bpm}
              onChange={(e) => setBpmAndSync(parseInt(e.target.value))}
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
            <TrackLabel key={`label-${track.id}`} track={track} />
          ))}

          <div className="add-track-container">
            <button className="btn btn-add-track" onClick={handleAddTrack}>
              + Add Track
            </button>
          </div>
        </div>

        {/* Grid Area */}
        <div
          className="timeline-grid-area"
          style={{ width: `${FIXED_GRID_WIDTH}px` }}
        >
          {/* Beat Header */}
          <div className="beat-header">
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
              >
                {/* Subdivision lines */}
                {Array.from(
                  { length: TOTAL_TICKS / (TICKS_PER_BEAT / 4) + 1 },
                  (_, subdivisionIndex) => {
                    const tickPosition =
                      subdivisionIndex * (TICKS_PER_BEAT / 4);
                    const beatPosition = tickPosition / TICKS_PER_BEAT;
                    const measureIndex = Math.floor(beatPosition / 4);

                    let lineType;
                    if (tickPosition % TICKS_PER_BEAT === 0) {
                      lineType =
                        beatPosition % 4 === 0
                          ? "beat-line--measure"
                          : "beat-line--beat";
                    } else if (tickPosition % (TICKS_PER_BEAT / 2) === 0) {
                      lineType = "beat-line--eighth";
                    } else {
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
