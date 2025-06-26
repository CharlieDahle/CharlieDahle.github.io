import { create } from "zustand";

export const useUIStore = create((set) => ({
  // Snap to grid setting
  snapToGrid: true,
  setSnapToGrid: (value) => set({ snapToGrid: value }),

  // Sound selector modal state
  soundModalOpen: false,
  soundModalTrack: null,
  openSoundModal: (track) =>
    set({
      soundModalOpen: true,
      soundModalTrack: track,
    }),
  closeSoundModal: () =>
    set({
      soundModalOpen: false,
      soundModalTrack: null,
    }),

  // Error state for the app
  error: null,
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  // Loading states
  isLoading: false,
  setLoading: (loading) => set({ isLoading: loading }),
}));
