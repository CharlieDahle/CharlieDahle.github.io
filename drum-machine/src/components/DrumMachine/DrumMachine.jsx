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
  const { pattern } = usePatternStore();
  const { tracks } = useTrackStore();
  const {
    isPlaying,
    currentTick,
    bpm,
    play,
    pause,
    stop,
    setCurrentTick,
    TICKS_PER_BEAT,
    BEATS_PER_LOOP,
    getTotalTicks,
  } = useTransportStore();

  // Get WebSocket methods for transport commands only
  const { sendTransportCommand, leaveRoom } = useWebSocketStore();

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
          // Leave the room but keep WebSocket connection alive
          leaveRoom();
          // This will set isInRoom to false, triggering transition back to RoomInterface
        }}
      />

      <PatternTimeline
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
      />
    </div>
  );
}

export default DrumMachine;
