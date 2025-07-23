// src/stores/usePatternStore.js
import { create } from "zustand";

// Helper function to normalize notes - converts old format to new format
const normalizeNote = (note) => {
  if (typeof note === "number") {
    // Old format: just a tick number
    return { tick: note, velocity: 4 }; // Default to max velocity
  }
  // New format: already an object with tick and velocity
  return note;
};

// Helper function to ensure velocity is valid (1-4)
const clampVelocity = (velocity) => {
  return Math.max(1, Math.min(4, velocity || 4));
};

export const usePatternStore = create((set, get) => ({
  // Pattern state - object where keys are trackIds and values are arrays of note objects
  // Format: { trackId: [{ tick: 120, velocity: 3 }, { tick: 480, velocity: 1 }] }
  pattern: {},

  // Actions for pattern manipulation
  addNote: (trackId, tick, velocity = 4) => {
    set((state) => {
      const newPattern = { ...state.pattern };

      if (!newPattern[trackId]) {
        newPattern[trackId] = [];
      }

      // Normalize existing notes and check if tick already exists
      const normalizedNotes = newPattern[trackId].map(normalizeNote);
      const existingNoteIndex = normalizedNotes.findIndex(
        (note) => note.tick === tick
      );

      if (existingNoteIndex === -1) {
        // Add new note
        newPattern[trackId] = [
          ...normalizedNotes,
          { tick, velocity: clampVelocity(velocity) },
        ];
      }
      // If note already exists, don't add duplicate

      return { pattern: newPattern };
    });
  },

  removeNote: (trackId, tick) => {
    set((state) => {
      const newPattern = { ...state.pattern };

      if (newPattern[trackId]) {
        const normalizedNotes = newPattern[trackId].map(normalizeNote);
        newPattern[trackId] = normalizedNotes.filter(
          (note) => note.tick !== tick
        );
      }

      return { pattern: newPattern };
    });
  },

  updateNoteVelocity: (trackId, tick, velocity) => {
    set((state) => {
      const newPattern = { ...state.pattern };

      if (newPattern[trackId]) {
        const normalizedNotes = newPattern[trackId].map(normalizeNote);
        newPattern[trackId] = normalizedNotes.map((note) =>
          note.tick === tick
            ? { ...note, velocity: clampVelocity(velocity) }
            : note
        );
      }

      return { pattern: newPattern };
    });
  },

  moveNote: (trackId, fromTick, toTick) => {
    set((state) => {
      const newPattern = { ...state.pattern };

      if (newPattern[trackId]) {
        const normalizedNotes = newPattern[trackId].map(normalizeNote);
        const noteToMove = normalizedNotes.find(
          (note) => note.tick === fromTick
        );

        if (noteToMove) {
          // Remove old note and add at new position
          newPattern[trackId] = normalizedNotes
            .filter((note) => note.tick !== fromTick)
            .concat({ ...noteToMove, tick: toTick });
        }
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
    const { addNote, removeNote, moveNote, clearTrack, updateNoteVelocity } =
      get();

    switch (change.type) {
      case "add-note":
        addNote(change.trackId, change.tick, change.velocity);
        break;
      case "remove-note":
        removeNote(change.trackId, change.tick);
        break;
      case "move-note":
        moveNote(change.trackId, change.fromTick, change.toTick);
        break;
      case "update-note-velocity":
        updateNoteVelocity(change.trackId, change.tick, change.velocity);
        break;
      case "clear-track":
        clearTrack(change.trackId);
        break;
      default:
        console.warn("Unknown pattern change type:", change.type);
    }
  },

  // Set entire pattern (useful for room sync)
  setPattern: (newPattern) => {
    // Normalize all notes when setting pattern
    const normalizedPattern = {};
    Object.keys(newPattern).forEach((trackId) => {
      normalizedPattern[trackId] = newPattern[trackId].map(normalizeNote);
    });
    set({ pattern: normalizedPattern });
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
    const notes = get().pattern[trackId] || [];
    return notes.map(normalizeNote);
  },

  hasNoteAt: (trackId, tick) => {
    const notes = get().getNotesForTrack(trackId);
    return notes.some((note) => note.tick === tick);
  },

  getNoteAt: (trackId, tick) => {
    const notes = get().getNotesForTrack(trackId);
    return notes.find((note) => note.tick === tick) || null;
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
