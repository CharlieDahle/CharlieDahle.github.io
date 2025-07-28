import React, { useEffect, useRef } from "react";
import { usePatternStore } from "../../stores/usePatternStore";
import { useTrackStore } from "../../stores/useTrackStore";
import { useTransportStore } from "../../stores/useTransportStore";
import { useWebSocketStore } from "../../stores/useWebSocketStore";
import PatternTimeline from "../PatternTimeline/PatternTimeline";
import DrumScheduler from "../DrumScheduler/DrumScheduler";
import RoomHeader from "../RoomHeader/RoomHeader";

function DrumMachine({ roomId, userCount, remoteTransportCommand }) {
  // Get all state from stores directly
  const { pattern, addNote, removeNote, moveNote, clearTrack } =
    usePatternStore();
  const { tracks, addTrack, removeTrack, updateTrackSound } = useTrackStore();
  const {
    isPlaying,
    currentTick,
    bpm,
    measureCount,
    play,
    pause,
    stop,
    setBpm,
    setCurrentTick,
    addMeasure,
    removeMeasure,
    TICKS_PER_BEAT,
    BEATS_PER_LOOP,
    getTotalTicks,
  } = useTransportStore();

  // Get WebSocket methods
  const {
    sendPatternChange,
    sendBpmChange,
    sendMeasureCountChange,
    sendAddTrack,
    sendRemoveTrack,
    sendUpdateTrackSound,
    sendTransportCommand,
    cleanup, // ADDED: Import cleanup function
  } = useWebSocketStore();

  // Scheduler instance
  const schedulerRef = useRef(null);

  // Track the last processed remote command to avoid re-processing
  const lastProcessedCommandRef = useRef(null);

  // Initialize scheduler with transport store reference
  useEffect(() => {
    const scheduler = new DrumScheduler(
      bpm,
      (tick) => {
        setCurrentTick(tick);
      },
      useTransportStore
    );

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
  }, [remoteTransportCommand, roomId, isPlaying, currentTick]);

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
      availableSounds: [], // Will be set by sound selector
    };

    const newTrack = addTrack(trackData);
    sendAddTrack(newTrack);
  };

  const handleRemoveTrack = (trackId) => {
    removeTrack(trackId);
    sendRemoveTrack(trackId);
  };

  const handleUpdateTrackSound = (trackId, newSoundFile) => {
    updateTrackSound(trackId, newSoundFile);
    sendUpdateTrackSound(trackId, newSoundFile);
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
    sendTransportCommand({ type: "play" });

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
    sendTransportCommand({ type: "pause" });
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
    sendTransportCommand({ type: "stop" });
  };

  return (
    <div className="drum-machine-layout">
      <RoomHeader
        roomId={roomId}
        userCount={userCount}
        onLeaveRoom={() => {
          // Clean WebSocket connection and reset state
          cleanup();
          // This will automatically trigger the transition back to RoomInterface
          // because DrumMachineApp checks isInRoom from the WebSocket store
        }}
      />

      <PatternTimeline
        onPatternChange={handlePatternChange}
        onBpmChange={handleBpmChange}
        onAddTrack={handleAddTrack}
        onRemoveTrack={handleRemoveTrack}
        onUpdateTrackSound={handleUpdateTrackSound}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onAddMeasure={() => {
          addMeasure();
          handleMeasureChange(measureCount + 1);
        }}
        onRemoveMeasure={() => {
          removeMeasure();
          handleMeasureChange(Math.max(1, measureCount - 1));
        }}
      />
    </div>
  );
}

export default DrumMachine;
