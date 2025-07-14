// src/stores/useUIStore.js
import { create } from "zustand";

export const useUIStore = create((set, get) => ({
  // ============ COLD STATE (updates rarely - user preferences) ============

  // Modal state
  soundModalOpen: false,
  soundModalTrack: null,

  // User preferences
  snapToGrid: true,

  // App-level UI state
  isLoading: false,
  error: null,

  // ============ MODAL ACTIONS ============

  openSoundModal: (track) => {
    set({
      soundModalOpen: true,
      soundModalTrack: track,
    });
  },

  closeSoundModal: () => {
    set({
      soundModalOpen: false,
      soundModalTrack: null,
    });
  },

  // ============ PREFERENCE ACTIONS ============

  setSnapToGrid: (enabled) => {
    set({ snapToGrid: enabled });
  },

  // ============ LOADING/ERROR ACTIONS ============

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  setError: (error) => {
    set({ error });
  },

  clearError: () => {
    set({ error: null });
  },

  // ============ HELPER GETTERS ============

  hasError: () => {
    return get().error !== null;
  },

  isModalOpen: () => {
    return get().soundModalOpen;
  },
}));
