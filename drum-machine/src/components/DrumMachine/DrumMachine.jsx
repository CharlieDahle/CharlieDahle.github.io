// src/components/DrumMachine/DrumMachine.jsx
import React, { useEffect } from "react";
import { useDrumDataStore } from "../../stores/useDrumDataStore";
import { useTransportStore } from "../../stores/useTransportStore";
import { useSchedulerStore } from "../../stores/useSchedulerStore";
import { useUIStore } from "../../stores/useUIStore";
import PatternTimeline from "../PatternTimeline/PatternTimeline";
import SoundSelectorModal from "../SoundSelectorModal/SoundSelectorModal";
import drumSounds from "../../assets/data/drum-sounds.json";

function DrumMachine({ roomId, userCount }) {
  // ============ STORE SUBSCRIPTIONS ============

  // Hot state (for UI display only)
  const { isPlaying, currentTick } = useTransportStore();

  // Warm state (business logic)
  const {
    pattern,
    tracks,
    bpm,
    measureCount,
    playAndSync,
    pauseAndSync,
    stopAndSync,
    getTotalTicks,
  } = useDrumDataStore();

  // Audio system
  const {
    init: initScheduler,
    start: startScheduler,
    pause: pauseScheduler,
    stop: stopScheduler,
    updatePattern,
    updateTracks,
    updateBpm,
    resumeAudioContext,
    isReady: isSchedulerReady,
  } = useSchedulerStore();

  // UI state
  const { error, clearError } = useUIStore();

  // ============ INITIALIZATION ============

  useEffect(() => {
    console.log("DrumMachine: Initializing scheduler");
    initScheduler();
  }, [initScheduler]);

  // ============ SYNC SCHEDULER WITH APP STATE ============

  // Sync pattern when it changes
  useEffect(() => {
    if (isSchedulerReady()) {
      updatePattern(pattern);
    }
  }, [pattern, updatePattern, isSchedulerReady]);

  // Sync tracks when they change
  useEffect(() => {
    if (isSchedulerReady()) {
      updateTracks(tracks);
    }
  }, [tracks, updateTracks, isSchedulerReady]);

  // Sync BPM when it changes
  useEffect(() => {
    if (isSchedulerReady()) {
      updateBpm(bpm);
    }
  }, [bpm, updateBpm, isSchedulerReady]);

  // ============ TRANSPORT HANDLERS ============

  const handlePlay = async () => {
    try {
      console.log("DrumMachine: Play requested");

      // Ensure audio context is ready (user gesture requirement)
      await resumeAudioContext();

      // Update app state and sync to server
      playAndSync();

      // Start audio playback
      await startScheduler(currentTick);

      console.log("DrumMachine: Play completed");
    } catch (error) {
      console.error("DrumMachine: Play failed:", error);
    }
  };

  const handlePause = () => {
    try {
      console.log("DrumMachine: Pause requested");

      // Update app state and sync to server
      pauseAndSync();

      // Pause audio playback
      pauseScheduler();

      console.log("DrumMachine: Pause completed");
    } catch (error) {
      console.error("DrumMachine: Pause failed:", error);
    }
  };

  const handleStop = () => {
    try {
      console.log("DrumMachine: Stop requested");

      // Update app state and sync to server
      stopAndSync();

      // Stop audio playback
      stopScheduler();

      console.log("DrumMachine: Stop completed");
    } catch (error) {
      console.error("DrumMachine: Stop failed:", error);
    }
  };

  // ============ COMPUTED VALUES ============

  const currentBeat = Math.floor(currentTick / 480) + 1;
  const totalTicks = getTotalTicks();

  // ============ RENDER ============

  return (
    <div
      className="container-fluid py-4"
      style={{ backgroundColor: "#f8f9fa", minHeight: "100vh" }}
    >
      {/* Header */}
      <div className="row mb-4">
        <div className="col">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h2 className="mb-1 fw-bold">Drum Machine</h2>
              <small className="text-muted">Room: {roomId}</small>
            </div>
            <div>
              <span className="badge bg-success me-2 fs-6">
                {userCount} user{userCount !== 1 ? "s" : ""} online
              </span>
              <span className="badge bg-success fs-6">Connected</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="row mb-3">
          <div className="col">
            <div className="alert alert-danger alert-dismissible" role="alert">
              {error}
              <button
                type="button"
                className="btn-close"
                onClick={clearError}
                aria-label="Close"
              ></button>
            </div>
          </div>
        </div>
      )}

      {/* Pattern Timeline */}
      <div className="row">
        <div className="col">
          <PatternTimeline
            onPlay={handlePlay}
            onPause={handlePause}
            onStop={handleStop}
          />
        </div>
      </div>

      {/* Debug Info */}
      <div className="row mt-4">
        <div className="col">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-light">
              <h6 className="mb-0 text-muted">Debug Info</h6>
            </div>
            <div className="card-body">
              <small className="text-muted">
                <strong>Tracks:</strong> {tracks.map((t) => t.name).join(", ")}
                <br />
                <strong>Active Notes:</strong>{" "}
                {Object.keys(pattern)
                  .map(
                    (trackId) =>
                      `${
                        tracks.find((t) => t.id === trackId)?.name || trackId
                      }: ${pattern[trackId]?.length || 0}`
                  )
                  .join(", ")}
                <br />
                <strong>Playback:</strong> Playing: {isPlaying ? "Yes" : "No"},
                Beat: {currentBeat}, Tick: {currentTick}, BPM: {bpm}
                <br />
                <strong>Grid:</strong> {measureCount} measures, Total ticks:{" "}
                {totalTicks}
                <br />
                <strong>Scheduler:</strong> Ready:{" "}
                {isSchedulerReady() ? "Yes" : "No"}
              </small>
            </div>
          </div>
        </div>
      </div>

      {/* Global Sound Selector Modal */}
      <SoundSelectorModal drumSounds={drumSounds} />
    </div>
  );
}

export default DrumMachine;
