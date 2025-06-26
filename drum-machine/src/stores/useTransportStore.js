// src/stores/useTransportStore.js
import { create } from "zustand";

export const useTransportStore = create((set, get) => ({
  // Transport state
  isPlaying: false,
  currentTick: 0,
  bpm: 120,

  // Constants
  TICKS_PER_BEAT: 480,
  BEATS_PER_LOOP: 16,

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

  // Getter helpers
  getCurrentBeat: () => {
    const { currentTick, TICKS_PER_BEAT } = get();
    return Math.floor(currentTick / TICKS_PER_BEAT) + 1;
  },

  getCurrentMeasure: () => {
    const { currentTick, TICKS_PER_BEAT } = get();
    return Math.floor(currentTick / (TICKS_PER_BEAT * 4)) + 1;
  },

  getProgress: () => {
    const { currentTick, TICKS_PER_BEAT, BEATS_PER_LOOP } = get();
    const totalTicks = TICKS_PER_BEAT * BEATS_PER_LOOP;
    return (currentTick / totalTicks) * 100;
  },

  getTotalTicks: () => {
    const { TICKS_PER_BEAT, BEATS_PER_LOOP } = get();
    return TICKS_PER_BEAT * BEATS_PER_LOOP;
  },
}));
