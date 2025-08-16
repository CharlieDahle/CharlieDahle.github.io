// src/components/DrumMachine/DrumMachine.jsx
import React, { useEffect, useRef, useState } from "react";
import { useAppStore } from "../../stores";
import PatternTimeline from "../PatternTimeline/PatternTimeline";
import DrumScheduler from "../DrumScheduler/DrumScheduler";
import RoomHeader from "../RoomHeader/RoomHeader";
import DebugPanel from "../DebugPanel/DebugPanel";

function DrumMachine({ remoteTransportCommand }) {
  // Get all state from the single store
  const pattern = useAppStore((state) => state.pattern.data);
  const tracks = useAppStore((state) => state.tracks.list);
  const isPlaying = useAppStore((state) => state.transport.isPlaying);
  const currentTick = useAppStore((state) => state.transport.currentTick);
  const bpm = useAppStore((state) => state.transport.bpm);
  const setCurrentTick = useAppStore((state) => state.transport.setCurrentTick);
  const TICKS_PER_BEAT = useAppStore((state) => state.transport.TICKS_PER_BEAT);
  const BEATS_PER_LOOP = useAppStore((state) => state.transport.BEATS_PER_LOOP);
  const getTotalTicks = useAppStore((state) => state.transport.getTotalTicks);

  // Get effects state
  const trackEffects = useAppStore((state) => state.effects.trackEffects);
  const getTrackEffects = useAppStore((state) => state.effects.getTrackEffects);

  // Scheduler instance
  const schedulerRef = useRef(null);

  // Debug data state - extracted from scheduler for debug panel
  const [toneEffectsData, setToneEffectsData] = useState(null);
  const [debugMode, setDebugMode] = useState(false);

  // Track the last processed remote command to avoid re-processing
  const lastProcessedCommandRef = useRef(null);

  // Initialize scheduler with transport store reference
  useEffect(() => {
    const scheduler = new DrumScheduler(
      bpm,
      (tick) => {
        setCurrentTick(tick);
      },
      useAppStore
    );

    scheduler.init();
    schedulerRef.current = scheduler;

    return () => {
      if (schedulerRef.current) {
        schedulerRef.current.destroy();
      }
    };
  }, [setCurrentTick]);

  // Update debug data whenever scheduler state changes
  useEffect(() => {
    if (schedulerRef.current) {
      const updateDebugData = () => {
        const scheduler = schedulerRef.current;
        setToneEffectsData({
          tonePlayers: scheduler.tonePlayers || {},
          trackEffects: scheduler.trackEffects || {},
          audioContext: scheduler.context?.state || "unknown",
          isPlaying: scheduler.isPlaying,
          currentTick: scheduler.currentTick,
          trackSounds: scheduler.trackSounds || {},
          bpm: scheduler.bpm || bpm, // Use scheduler BPM or fallback to store BPM
          soundsLoaded: scheduler.soundsLoaded,
          // Add debug method to check Tone.js state
          toneContextState: window.Tone?.context?.state || "Tone.js not loaded",
        });
      };

      // Update immediately
      updateDebugData();

      // Update every second while debug panel might be open
      const interval = setInterval(updateDebugData, 1000);

      return () => clearInterval(interval);
    }
  }, [pattern, tracks, isPlaying, currentTick, bpm]); // Added bpm to dependencies

  // Update scheduler when pattern, BPM, or tracks change
  useEffect(() => {
    if (schedulerRef.current) {
      schedulerRef.current.setPattern(pattern);
      schedulerRef.current.setBpm(bpm);
      schedulerRef.current.setTracks(tracks);
    }
  }, [pattern, bpm, tracks]);

  // Update effects when they change
  useEffect(() => {
    if (schedulerRef.current) {
      // Update effects for each track
      tracks.forEach((track) => {
        const effects = getTrackEffects(track.id);
        schedulerRef.current.updateTrackEffects(track.id, effects);
      });
    }
  }, [trackEffects, tracks, getTrackEffects]);

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

    console.log("📡 REMOTE COMMAND received:", {
      command: remoteTransportCommand,
      storeIsPlaying: isPlaying,
      schedulerIsPlaying: schedulerRef.current.isPlaying,
      currentTick,
    });

    // Log to debug panel if available
    if (window.debugPanel) {
      window.debugPanel.addMessageToLog(
        "in",
        "remote-transport-command",
        remoteTransportCommand
      );
    }

    // The state is already updated by the WebSocket store
    // The audio coordination useEffect above will handle the scheduler
  }, [remoteTransportCommand, isPlaying, currentTick]);

  return (
    <div className="drum-machine-layout">
      <RoomHeader debugMode={debugMode} setDebugMode={setDebugMode} />
      <PatternTimeline />
      {/* Debug panel appears as its own card below PatternTimeline */}
      <DebugPanel
        isOpen={debugMode}
        onClose={() => setDebugMode(false)}
        toneEffectsData={toneEffectsData}
      />
    </div>
  );
}

export default DrumMachine;
