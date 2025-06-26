// src/stores/usePatternStore.js
import { create } from "zustand";

export const usePatternStore = create((set, get) => ({
  // Pattern state - object where keys are trackIds and values are arrays of ticks
  pattern: {},

  // Actions for pattern manipulation
  addNote: (trackId, tick) => {
    set((state) => {
      const newPattern = { ...state.pattern };

      if (!newPattern[trackId]) {
        newPattern[trackId] = [];
      }

      if (!newPattern[trackId].includes(tick)) {
        newPattern[trackId] = [...newPattern[trackId], tick];
      }

      return { pattern: newPattern };
    });
  },

  removeNote: (trackId, tick) => {
    set((state) => {
      const newPattern = { ...state.pattern };

      if (newPattern[trackId]) {
        newPattern[trackId] = newPattern[trackId].filter((t) => t !== tick);
      }

      return { pattern: newPattern };
    });
  },

  moveNote: (trackId, fromTick, toTick) => {
    set((state) => {
      const newPattern = { ...state.pattern };

      if (newPattern[trackId]) {
        newPattern[trackId] = newPattern[trackId]
          .filter((t) => t !== fromTick)
          .concat(toTick);
      }

      return { pattern: newPattern };
    });
  },

  clearTrack: (trackId) => {
    set((state) => ({
      pattern: {
        ...state.pattern,
        [trackId]: [],
      },
    }));
  },

  clearAllTracks: () => {
    set({ pattern: {} });
  },

  // Apply a pattern change (for WebSocket updates)
  applyPatternChange: (change) => {
    switch (change.type) {
      case "add-note":
        get().addNote(change.trackId, change.tick);
        break;
      case "remove-note":
        get().removeNote(change.trackId, change.tick);
        break;
      case "move-note":
        get().moveNote(change.trackId, change.fromTick, change.toTick);
        break;
      case "clear-track":
        get().clearTrack(change.trackId);
        break;
      default:
        console.warn("Unknown pattern change type:", change.type);
    }
  },

  // Set entire pattern (useful for room sync)
  setPattern: (newPattern) => {
    set({ pattern: newPattern });
  },

  // Clean up pattern when track is removed
  removeTrackFromPattern: (trackId) => {
    set((state) => {
      const newPattern = { ...state.pattern };
      delete newPattern[trackId];
      return { pattern: newPattern };
    });
  },

  // Getter helpers
  getNotesForTrack: (trackId) => {
    return get().pattern[trackId] || [];
  },

  hasNoteAt: (trackId, tick) => {
    const notes = get().getNotesForTrack(trackId);
    return notes.includes(tick);
  },

  getTotalNotes: () => {
    const pattern = get().pattern;
    return Object.values(pattern).reduce(
      (total, notes) => total + notes.length,
      0
    );
  },

  getActiveTrackIds: () => {
    const pattern = get().pattern;
    return Object.keys(pattern).filter(
      (trackId) => pattern[trackId].length > 0
    );
  },
}));
