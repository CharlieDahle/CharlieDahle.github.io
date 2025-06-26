import React, { useEffect, useRef } from "react";
import { usePatternStore } from "../../stores/usePatternStore";
import { useTrackStore } from "../../stores/useTrackStore";
import { useTransportStore } from "../../stores/useTransportStore";
import PatternTimeline from "../PatternTimeline/PatternTimeline";
import DrumScheduler from "../DrumScheduler/DrumScheduler";

function DrumMachine({
  roomId,
  userCount,
  remoteTransportCommand,
  onPatternChange,
  onBpmChange,
  onTransportCommand,
  onAddTrack,
  onRemoveTrack,
  onUpdateTrackSound,
}) {
  // Get all state from stores
  const { pattern, addNote, removeNote, moveNote, clearTrack } =
    usePatternStore();

  const { tracks } = useTrackStore();

  const {
    isPlaying,
    currentTick,
    bpm,
    play,
    pause,
    stop,
    setBpm,
    setCurrentTick,
    TICKS_PER_BEAT,
    BEATS_PER_LOOP,
  } = useTransportStore();

  // Scheduler instance
  const schedulerRef = useRef(null);

  // Track the last processed remote command to avoid re-processing
  const lastProcessedCommandRef = useRef(null);

  // Initialize scheduler
  useEffect(() => {
    const scheduler = new DrumScheduler(bpm, (tick) => {
      setCurrentTick(tick);
    });

    scheduler.init();
    schedulerRef.current = scheduler;

    return () => {
      if (schedulerRef.current) {
        schedulerRef.current.destroy();
      }
    };
  }, [setCurrentTick]);

  // Update scheduler when pattern, BPM, or tracks change
  useEffect(() => {
    if (schedulerRef.current) {
      schedulerRef.current.setPattern(pattern);
      schedulerRef.current.setBpm(bpm);
      schedulerRef.current.setTracks(tracks);
    }
  }, [pattern, bpm, tracks]);

  // Handle remote transport commands (from other users)
  useEffect(() => {
    if (!remoteTransportCommand || !schedulerRef.current) return;

    // Check if we've already processed this exact command
    if (
      lastProcessedCommandRef.current?.timestamp ===
      remoteTransportCommand.timestamp
    ) {
      return;
    }

    // Remember this command so we don't process it again
    lastProcessedCommandRef.current = remoteTransportCommand;

    console.log("📡 [" + roomId + "] REMOTE COMMAND received:", {
      command: remoteTransportCommand,
      storeIsPlaying: isPlaying,
      schedulerIsPlaying: schedulerRef.current.isPlaying,
      currentTick,
    });

    // Handle audio scheduling based on the remote command
    // The state is already updated by the WebSocket store
    switch (remoteTransportCommand.type) {
      case "play":
        if (!schedulerRef.current.isPlaying) {
          console.log(
            "📡 [" + roomId + "] Starting scheduler from remote play"
          );
          schedulerRef.current.start(currentTick);
        } else {
          console.log(
            "📡 [" +
              roomId +
              "] Scheduler already playing, ignoring remote play"
          );
        }
        break;
      case "pause":
        if (schedulerRef.current.isPlaying) {
          console.log(
            "📡 [" + roomId + "] Pausing scheduler from remote pause"
          );
          schedulerRef.current.pause();
        } else {
          console.log(
            "📡 [" +
              roomId +
              "] Scheduler already paused, ignoring remote pause"
          );
        }
        break;
      case "stop":
        console.log("📡 [" + roomId + "] Stopping scheduler from remote stop");
        schedulerRef.current.stop();
        break;
    }
  }, [remoteTransportCommand, roomId, isPlaying, currentTick]); // Keep currentTick for the start() call

  // Handle pattern changes
  const handlePatternChange = (change) => {
    // Check if track still exists
    const trackExists = tracks.some((track) => track.id === change.trackId);
    if (!trackExists) {
      console.warn("Pattern change for non-existent track:", change.trackId);
      return;
    }

    // Update store immediately for responsive UI
    switch (change.type) {
      case "add-note":
        addNote(change.trackId, change.tick);
        break;
      case "remove-note":
        removeNote(change.trackId, change.tick);
        break;
      case "move-note":
        moveNote(change.trackId, change.fromTick, change.toTick);
        break;
      case "clear-track":
        clearTrack(change.trackId);
        break;
      default:
        console.warn("Unknown pattern change type:", change.type);
    }

    // Notify parent for WebSocket sync
    onPatternChange(change);
  };

  // Handle BPM changes
  const handleBpmChange = (newBpm) => {
    setBpm(newBpm);
    onBpmChange(newBpm);
  };

  // Transport control handlers
  const handlePlay = async () => {
    console.log("🎵 [" + roomId + "] LOCAL PLAY clicked - Current state:", {
      storeIsPlaying: isPlaying,
      schedulerIsPlaying: schedulerRef.current?.isPlaying,
      currentTick,
    });

    // Initialize audio context on first play
    if (schedulerRef.current) {
      await schedulerRef.current.init();
    }

    // Update store state
    play();

    // Start local playback
    if (schedulerRef.current) {
      await schedulerRef.current.start(currentTick);
    }

    // Notify server
    onTransportCommand({ type: "play" });

    console.log("🎵 [" + roomId + "] LOCAL PLAY completed - Scheduler started");
  };

  const handlePause = () => {
    console.log("⏸️ [" + roomId + "] LOCAL PAUSE clicked - Current state:", {
      storeIsPlaying: isPlaying,
      schedulerIsPlaying: schedulerRef.current?.isPlaying,
    });

    // Update store state
    pause();

    // Pause local playback
    if (schedulerRef.current) {
      schedulerRef.current.pause();
    }

    // Notify server
    onTransportCommand({ type: "pause" });
  };

  const handleStop = () => {
    console.log("⏹️ [" + roomId + "] LOCAL STOP clicked - Current state:", {
      storeIsPlaying: isPlaying,
      schedulerIsPlaying: schedulerRef.current?.isPlaying,
    });

    // Update store state
    stop();

    // Stop local playback
    if (schedulerRef.current) {
      schedulerRef.current.stop();
    }

    // Notify server
    onTransportCommand({ type: "stop" });
  };

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

      {/* Pattern Timeline */}
      <div className="row">
        <div className="col">
          <PatternTimeline
            pattern={pattern}
            bpm={bpm}
            currentTick={currentTick}
            isPlaying={isPlaying}
            tracks={tracks}
            onPatternChange={handlePatternChange}
            onBpmChange={handleBpmChange}
            onAddTrack={onAddTrack}
            onRemoveTrack={onRemoveTrack}
            onUpdateTrackSound={onUpdateTrackSound}
            onPlay={handlePlay}
            onPause={handlePause}
            onStop={handleStop}
            TICKS_PER_BEAT={TICKS_PER_BEAT}
            BEATS_PER_LOOP={BEATS_PER_LOOP}
            PIXELS_PER_TICK={0.1}
          />
        </div>
      </div>

      {/* Debug info */}
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
                Tick: {currentTick}, BPM: {bpm}
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DrumMachine;
