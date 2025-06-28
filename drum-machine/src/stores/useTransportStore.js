// src/stores/useTransportStore.js
import { create } from "zustand";

export const useTransportStore = create((set, get) => ({
  // Transport state
  isPlaying: false,
  currentTick: 0,
  bpm: 120,

  // Dynamic timing constants (moved from hardcoded)
  TICKS_PER_BEAT: 480,
  BEATS_PER_LOOP: 16, // Now dynamic!
  measureCount: 4, // Number of measures (4 beats per measure)

  // Transport control actions
  play: () => {
    set({ isPlaying: true });
  },

  pause: () => {
    set({ isPlaying: false });
  },

  stop: () => {
    set({
      isPlaying: false,
      currentTick: 0,
    });
  },

  // Tick management
  setCurrentTick: (tick) => {
    set({ currentTick: tick });
  },

  // BPM management
  setBpm: (newBpm) => {
    const clampedBpm = Math.max(60, Math.min(300, newBpm));
    set({ bpm: clampedBpm });
  },

  // Sync from server
  syncBpm: (serverBpm) => {
    set({ bpm: serverBpm });
  },

  syncMeasureCount: (serverMeasureCount) => {
    set({
      measureCount: serverMeasureCount,
      BEATS_PER_LOOP: serverMeasureCount * 4,
    });
  },

  // Measure management
  addMeasure: () => {
    set((state) => ({
      measureCount: state.measureCount + 1,
      BEATS_PER_LOOP: (state.measureCount + 1) * 4,
    }));
  },

  removeMeasure: () => {
    set((state) => {
      const newMeasureCount = Math.max(1, state.measureCount - 1); // Minimum 1 measure
      return {
        measureCount: newMeasureCount,
        BEATS_PER_LOOP: newMeasureCount * 4,
      };
    });
  },

  setMeasureCount: (count) => {
    const clampedCount = Math.max(1, Math.min(16, count)); // 1-16 measures max
    set({
      measureCount: clampedCount,
      BEATS_PER_LOOP: clampedCount * 4,
    });
  },

  // Sync transport state from remote commands
  syncTransportCommand: (command) => {
    switch (command.type) {
      case "play":
        if (!get().isPlaying) {
          set({ isPlaying: true });
        }
        break;
      case "pause":
        if (get().isPlaying) {
          set({ isPlaying: false });
        }
        break;
      case "stop":
        set({
          isPlaying: false,
          currentTick: 0,
        });
        break;
      default:
        console.warn("Unknown transport command type:", command.type);
    }
  },

  // Computed getters that use the dynamic constants
  getTotalTicks: () => {
    const { TICKS_PER_BEAT, BEATS_PER_LOOP } = get();
    return TICKS_PER_BEAT * BEATS_PER_LOOP;
  },

  getTotalMeasures: () => {
    return get().measureCount;
  },

  getCurrentBeat: () => {
    const { currentTick, TICKS_PER_BEAT } = get();
    return Math.floor(currentTick / TICKS_PER_BEAT) + 1;
  },

  getCurrentMeasure: () => {
    const { currentTick, TICKS_PER_BEAT } = get();
    return Math.floor(currentTick / (TICKS_PER_BEAT * 4)) + 1;
  },

  getProgress: () => {
    const { currentTick } = get();
    const totalTicks = get().getTotalTicks();
    return (currentTick / totalTicks) * 100;
  },
}));
