// src/stores/useTransportStore.js
import { create } from "zustand";

export const useTransportStore = create((set, get) => ({
  // ============ HOT STATE (updates frequently) ============
  isPlaying: false,
  currentTick: 0,

  // ============ SIMPLE TRANSPORT ACTIONS ============
  // These only update local state - no network, no coordination

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

  setTick: (tick) => {
    // Clamp tick to valid range (0 or positive)
    const clampedTick = Math.max(0, tick);
    set({ currentTick: clampedTick });
  },

  // ============ HELPER GETTERS ============
  getState: () => {
    const { isPlaying, currentTick } = get();
    return { isPlaying, currentTick };
  },
}));
