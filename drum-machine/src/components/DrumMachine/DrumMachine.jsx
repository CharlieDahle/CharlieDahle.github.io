import React, { useEffect, useRef } from "react";
import { usePatternStore } from "../../stores/usePatternStore";
import { useTrackStore } from "../../stores/useTrackStore";
import { useTransportStore } from "../../stores/useTransportStore";
import { useWebSocketStore } from "../../stores/useWebSocketStore";
import TransportControls from "../TransportControls/TransportControls";
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

  // Audio coordination - listen to store changes and handle audio
  useEffect(() => {
    if (!schedulerRef.current) return;

    const handleAudioCoordination = async () => {
      if (isPlaying && !schedulerRef.current.isPlaying) {
        // Initialize audio context on first play
        await schedulerRef.current.init();
        console.log("🔊 Starting scheduler from store state change");
        schedulerRef.current.start(currentTick);
      } else if (!isPlaying && schedulerRef.current.isPlaying) {
        console.log("🔊 Pausing scheduler from store state change");
        schedulerRef.current.pause();
      }
    };

    handleAudioCoordination();
  }, [isPlaying, currentTick]);

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

    // The state is already updated by the WebSocket store
    // The audio coordination useEffect above will handle the scheduler
  }, [remoteTransportCommand, roomId, isPlaying, currentTick]);

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

      <PatternTimeline />
    </div>
  );
}

export default DrumMachine;
