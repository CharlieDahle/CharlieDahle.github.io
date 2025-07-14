// src/stores/useSchedulerStore.js
import { create } from "zustand";
import DrumScheduler from "../components/DrumScheduler/DrumScheduler";
import { useTransportStore } from "./useTransportStore";

export const useSchedulerStore = create((set, get) => ({
  // ============ SCHEDULER STATE ============
  scheduler: null,
  isInitialized: false,

  // ============ INITIALIZATION ============
  init: async () => {
    try {
      console.log("Initializing scheduler...");

      const scheduler = new DrumScheduler(
        120, // Default BPM (will be updated)
        (tick) => {
          // Callback to update transport store with current tick
          const transportStore = useTransportStore.getState();
          transportStore.setTick(tick);
        }
      );

      await scheduler.init();

      set({
        scheduler,
        isInitialized: true,
      });

      console.log("Scheduler initialized successfully");
      return scheduler;
    } catch (error) {
      console.error("Failed to initialize scheduler:", error);
      throw error;
    }
  },

  // ============ PLAYBACK CONTROL ============
  start: async (fromTick = 0) => {
    const { scheduler, isInitialized } = get();

    if (!scheduler || !isInitialized) {
      console.warn("Scheduler not initialized");
      return;
    }

    try {
      console.log("Starting scheduler from tick:", fromTick);
      await scheduler.start(fromTick);
    } catch (error) {
      console.error("Failed to start scheduler:", error);
      throw error;
    }
  },

  pause: () => {
    const { scheduler, isInitialized } = get();

    if (!scheduler || !isInitialized) {
      console.warn("Scheduler not initialized");
      return;
    }

    console.log("Pausing scheduler");
    scheduler.pause();
  },

  stop: () => {
    const { scheduler, isInitialized } = get();

    if (!scheduler || !isInitialized) {
      console.warn("Scheduler not initialized");
      return;
    }

    console.log("Stopping scheduler");
    scheduler.stop();
  },

  // ============ AUDIO DATA UPDATES ============
  updatePattern: (pattern) => {
    const { scheduler, isInitialized } = get();

    if (!scheduler || !isInitialized) {
      console.warn("Scheduler not initialized - skipping pattern update");
      return;
    }

    console.log("Updating scheduler pattern");
    scheduler.setPattern(pattern);
  },

  updateTracks: async (tracks) => {
    const { scheduler, isInitialized } = get();

    if (!scheduler || !isInitialized) {
      console.warn("Scheduler not initialized - skipping tracks update");
      return;
    }

    console.log("Updating scheduler tracks");
    await scheduler.setTracks(tracks);
  },

  updateBpm: (bpm) => {
    const { scheduler, isInitialized } = get();

    if (!scheduler || !isInitialized) {
      console.warn("Scheduler not initialized - skipping BPM update");
      return;
    }

    console.log("Updating scheduler BPM to:", bpm);
    scheduler.setBpm(bpm);
  },

  // ============ AUDIO CONTEXT MANAGEMENT ============
  resumeAudioContext: async () => {
    const { scheduler, isInitialized } = get();

    if (!scheduler || !isInitialized) {
      await get().init();
      return;
    }

    // Resume audio context if suspended (for user gesture requirements)
    if (
      scheduler.audioContext &&
      scheduler.audioContext.state === "suspended"
    ) {
      console.log("Resuming audio context");
      await scheduler.audioContext.resume();
    }
  },

  // ============ STATE QUERIES ============
  getSchedulerState: () => {
    const { scheduler, isInitialized } = get();

    if (!scheduler || !isInitialized) {
      return {
        isPlaying: false,
        currentTick: 0,
        bpm: 120,
        isInitialized: false,
      };
    }

    return {
      isPlaying: scheduler.isPlaying || false,
      currentTick: scheduler.currentTick || 0,
      bpm: scheduler.bpm || 120,
      isInitialized: true,
    };
  },

  isReady: () => {
    const { scheduler, isInitialized } = get();
    return scheduler && isInitialized;
  },

  // ============ CLEANUP ============
  destroy: () => {
    const { scheduler } = get();

    if (scheduler) {
      console.log("Destroying scheduler");
      scheduler.destroy();
    }

    set({
      scheduler: null,
      isInitialized: false,
    });
  },

  // ============ ERROR RECOVERY ============
  reinitialize: async () => {
    console.log("Reinitializing scheduler...");

    // Clean up existing scheduler
    get().destroy();

    // Initialize fresh scheduler
    await get().init();
  },
}));
