// src/stores/useTrackStore.js
import { create } from "zustand";
import drumSounds from "../assets/data/drum-sounds.json";

export const useTrackStore = create((set, get) => ({
  // Track state
  tracks: [
    {
      id: "kick",
      name: "Kick",
      color: "#e74c3c",
      soundFile: drumSounds.kicks[0].file,
      availableSounds: drumSounds.kicks,
    },
    {
      id: "snare",
      name: "Snare",
      color: "#f39c12",
      soundFile: drumSounds.snares[0].file,
      availableSounds: drumSounds.snares,
    },
    {
      id: "hihat",
      name: "Hi-Hat",
      color: "#2ecc71",
      soundFile: drumSounds.hihats[0].file,
      availableSounds: drumSounds.hihats,
    },
    {
      id: "openhat",
      name: "Open Hat",
      color: "#3498db",
      soundFile: drumSounds.cymbals[0].file,
      availableSounds: drumSounds.cymbals,
    },
  ],

  // Actions
  addTrack: (trackData) => {
    const newTrack = {
      id: `track_${Date.now()}`, // Simple unique ID
      name: trackData?.name || "New Track",
      color: trackData?.color || "#9b59b6",
      soundFile: trackData?.soundFile || null,
      availableSounds: trackData?.availableSounds || [],
    };

    set((state) => ({
      tracks: [...state.tracks, newTrack],
    }));

    return newTrack; // Return the new track for any needed follow-up
  },

  removeTrack: (trackId) => {
    set((state) => ({
      tracks: state.tracks.filter((track) => track.id !== trackId),
    }));
  },

  updateTrackSound: (trackId, newSoundFile) => {
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === trackId ? { ...track, soundFile: newSoundFile } : track
      ),
    }));
  },

  updateTrack: (trackId, updates) => {
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === trackId ? { ...track, ...updates } : track
      ),
    }));
  },

  // Getter helpers
  getTrackById: (trackId) => {
    return get().tracks.find((track) => track.id === trackId);
  },

  getTrackCount: () => {
    return get().tracks.length;
  },

  // Reset tracks (useful for room changes)
  setTracks: (newTracks) => {
    set({ tracks: newTracks });
  },
}));
