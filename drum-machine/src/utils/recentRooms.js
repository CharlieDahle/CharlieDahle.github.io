// src/utils/recentRooms.js
// Utility functions for managing recent rooms in localStorage

const RECENT_ROOMS_KEY = 'drumMachine_recentRooms';
const MAX_RECENT_ROOMS = 10;
const ROOM_EXPIRY_HOURS = 10;

/**
 * Get all recent rooms from localStorage
 * Filters out rooms older than ROOM_EXPIRY_HOURS
 */
export const getRecentRooms = () => {
  try {
    const stored = localStorage.getItem(RECENT_ROOMS_KEY);
    if (!stored) return [];

    const rooms = JSON.parse(stored);
    const now = Date.now();
    const expiryMs = ROOM_EXPIRY_HOURS * 60 * 60 * 1000;

    // Filter out expired rooms
    const validRooms = rooms.filter(room =>
      (now - room.lastJoined) < expiryMs
    );

    // Save back the filtered list if any were removed
    if (validRooms.length !== rooms.length) {
      localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(validRooms));
    }

    return validRooms;
  } catch (error) {
    console.error('Failed to get recent rooms:', error);
    return [];
  }
};

/**
 * Add a room to recent rooms list
 * Moves to top if already exists, otherwise adds new entry
 */
export const addRecentRoom = (roomId) => {
  try {
    const recent = getRecentRooms();

    // Remove if already exists
    const filtered = recent.filter(r => r.roomId !== roomId);

    // Add to front
    const updated = [
      { roomId, lastJoined: Date.now() },
      ...filtered
    ].slice(0, MAX_RECENT_ROOMS); // Keep only MAX_RECENT_ROOMS

    localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to add recent room:', error);
  }
};

/**
 * Remove a specific room from recent rooms
 */
export const removeRecentRoom = (roomId) => {
  try {
    const recent = getRecentRooms();
    const filtered = recent.filter(r => r.roomId !== roomId);
    localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to remove recent room:', error);
  }
};

/**
 * Clear all recent rooms
 */
export const clearRecentRooms = () => {
  try {
    localStorage.removeItem(RECENT_ROOMS_KEY);
  } catch (error) {
    console.error('Failed to clear recent rooms:', error);
  }
};
