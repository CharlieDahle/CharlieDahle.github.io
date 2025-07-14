// src/stores/useDrumDataStore.js
import { create } from "zustand";
import io from "socket.io-client";
import { useTransportStore } from "./useTransportStore";
import drumSounds from "../assets/data/drum-sounds.json";

export const useDrumDataStore = create((set, get) => ({
  // ============ WARM STATE (updates on user actions) ============

  // Pattern data
  pattern: {}, // { trackId: [tick1, tick2, ...] }

  // Track data
  tracks: [
    {
      id: "kick",
      name: "Kick",
      color: "#e74c3c",
      soundFile: drumSounds.kicks[0].file,
    },
    {
      id: "snare",
      name: "Snare",
      color: "#f39c12",
      soundFile: drumSounds.snares[0].file,
    },
    {
      id: "hihat",
      name: "Hi-Hat",
      color: "#2ecc71",
      soundFile: drumSounds.hihats[0].file,
    },
    {
      id: "openhat",
      name: "Open Hat",
      color: "#3498db",
      soundFile: drumSounds.cymbals[0].file,
    },
  ],

  // Timing data
  bpm: 120,
  measureCount: 4,

  // Connection state
  socket: null,
  isConnected: false,
  roomId: null,
  isInRoom: false,
  users: [],
  error: null,

  // ============ COMPUTED VALUES ============
  getTotalTicks: () => {
    const { measureCount } = get();
    return measureCount * 4 * 480; // measures * beats * ticks
  },

  getCurrentBeat: () => {
    const transportState = useTransportStore.getState();
    return Math.floor(transportState.currentTick / 480) + 1;
  },

  // ============ LOCAL ACTIONS (update state immediately) ============

  // Pattern actions
  addNote: (trackId, tick) => {
    set((state) => ({
      pattern: {
        ...state.pattern,
        [trackId]: [...(state.pattern[trackId] || []), tick]
          .filter((t, i, arr) => arr.indexOf(t) === i) // Remove duplicates
          .sort((a, b) => a - b), // Keep sorted
      },
    }));
  },

  removeNote: (trackId, tick) => {
    set((state) => ({
      pattern: {
        ...state.pattern,
        [trackId]: (state.pattern[trackId] || []).filter((t) => t !== tick),
      },
    }));
  },

  moveNote: (trackId, fromTick, toTick) => {
    set((state) => ({
      pattern: {
        ...state.pattern,
        [trackId]: (state.pattern[trackId] || [])
          .filter((t) => t !== fromTick)
          .concat(toTick)
          .filter((t, i, arr) => arr.indexOf(t) === i) // Remove duplicates
          .sort((a, b) => a - b), // Keep sorted
      },
    }));
  },

  clearTrack: (trackId) => {
    set((state) => ({
      pattern: {
        ...state.pattern,
        [trackId]: [],
      },
    }));
  },

  // Track actions
  addTrack: (trackData) => {
    const newTrack = {
      id: `track_${Date.now()}`,
      name: trackData?.name || "New Track",
      color: trackData?.color || "#9b59b6",
      soundFile: trackData?.soundFile || null,
    };

    set((state) => ({
      tracks: [...state.tracks, newTrack],
    }));

    return newTrack;
  },

  removeTrack: (trackId) => {
    set((state) => ({
      tracks: state.tracks.filter((track) => track.id !== trackId),
      pattern: {
        ...state.pattern,
        [trackId]: undefined, // Remove track's pattern data
      },
    }));
  },

  updateTrackSound: (trackId, soundFile) => {
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === trackId ? { ...track, soundFile } : track
      ),
    }));
  },

  // Timing actions
  setBpm: (bpm) => {
    const clampedBpm = Math.max(60, Math.min(300, bpm));
    set({ bpm: clampedBpm });
  },

  addMeasure: () => {
    set((state) => ({
      measureCount: Math.min(16, state.measureCount + 1), // Max 16 measures
    }));
  },

  removeMeasure: () => {
    set((state) => ({
      measureCount: Math.max(1, state.measureCount - 1), // Min 1 measure
    }));
  },

  // ============ COORDINATED ACTIONS (local update + server sync) ============

  // Transport coordination
  playAndSync: () => {
    const transportStore = useTransportStore.getState();
    transportStore.play();
    get().sendToServer("transport", { type: "play" });
  },

  pauseAndSync: () => {
    const transportStore = useTransportStore.getState();
    transportStore.pause();
    get().sendToServer("transport", { type: "pause" });
  },

  stopAndSync: () => {
    const transportStore = useTransportStore.getState();
    transportStore.stop();
    get().sendToServer("transport", { type: "stop" });
  },

  // Pattern coordination
  addNoteAndSync: (trackId, tick) => {
    get().addNote(trackId, tick);
    get().sendToServer("pattern", { type: "add-note", trackId, tick });
  },

  removeNoteAndSync: (trackId, tick) => {
    get().removeNote(trackId, tick);
    get().sendToServer("pattern", { type: "remove-note", trackId, tick });
  },

  moveNoteAndSync: (trackId, fromTick, toTick) => {
    get().moveNote(trackId, fromTick, toTick);
    get().sendToServer("pattern", {
      type: "move-note",
      trackId,
      fromTick,
      toTick,
    });
  },

  // Track coordination
  addTrackAndSync: (trackData) => {
    const newTrack = get().addTrack(trackData);
    get().sendToServer("track", { type: "add-track", trackData: newTrack });
    return newTrack;
  },

  removeTrackAndSync: (trackId) => {
    get().removeTrack(trackId);
    get().sendToServer("track", { type: "remove-track", trackId });
  },

  updateTrackSoundAndSync: (trackId, soundFile) => {
    get().updateTrackSound(trackId, soundFile);
    get().sendToServer("track", { type: "update-sound", trackId, soundFile });
  },

  // Timing coordination
  setBpmAndSync: (bpm) => {
    get().setBpm(bpm);
    get().sendToServer("timing", { type: "bpm", bpm });
  },

  addMeasureAndSync: () => {
    get().addMeasure();
    const { measureCount } = get();
    get().sendToServer("timing", { type: "measure-count", measureCount });
  },

  removeMeasureAndSync: () => {
    get().removeMeasure();
    const { measureCount } = get();
    get().sendToServer("timing", { type: "measure-count", measureCount });
  },

  // ============ SERVER SYNC (apply updates from other users) ============
  applyServerUpdate: (type, data) => {
    const transportStore = useTransportStore.getState();

    switch (type) {
      case "transport":
        if (data.type === "play") transportStore.play();
        else if (data.type === "pause") transportStore.pause();
        else if (data.type === "stop") transportStore.stop();
        break;

      case "pattern":
        if (data.type === "add-note") get().addNote(data.trackId, data.tick);
        else if (data.type === "remove-note")
          get().removeNote(data.trackId, data.tick);
        else if (data.type === "move-note")
          get().moveNote(data.trackId, data.fromTick, data.toTick);
        break;

      case "track":
        if (data.type === "add-track") {
          set((state) => ({ tracks: [...state.tracks, data.trackData] }));
        } else if (data.type === "remove-track")
          get().removeTrack(data.trackId);
        else if (data.type === "update-sound")
          get().updateTrackSound(data.trackId, data.soundFile);
        break;

      case "timing":
        if (data.type === "bpm") get().setBpm(data.bpm);
        else if (data.type === "measure-count") {
          set({ measureCount: data.measureCount });
        }
        break;

      default:
        console.warn("Unknown server update type:", type);
    }
  },

  // ============ WEBSOCKET MANAGEMENT ============
  connect: () => {
    console.log("Connecting to server...");
    const socket = io("https://api.charliedahle.me");

    // Connection events
    socket.on("connect", () => {
      console.log("Connected to server, ID:", socket.id);
      set({ socket, isConnected: true, error: null });
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from server");
      set({
        isConnected: false,
        isInRoom: false,
        error: "Disconnected from server",
      });
    });

    socket.on("connect_error", (err) => {
      console.error("Connection error:", err.message);
      set({ error: "Failed to connect to server" });
    });

    // Room events
    socket.on("user-joined", ({ userId, userCount }) => {
      console.log("User joined:", userId, "Total users:", userCount);
      set((state) => ({ users: [...state.users, userId] }));
    });

    socket.on("user-left", ({ userId, userCount }) => {
      console.log("User left:", userId, "Total users:", userCount);
      set((state) => ({ users: state.users.filter((id) => id !== userId) }));
    });

    // Server sync events
    socket.on("transport-sync", (data) => {
      console.log("Transport sync received:", data);
      get().applyServerUpdate("transport", data);
    });

    socket.on("pattern-update", (data) => {
      console.log("Pattern update received:", data);
      get().applyServerUpdate("pattern", data);
    });

    socket.on("track-update", (data) => {
      console.log("Track update received:", data);
      get().applyServerUpdate("track", data);
    });

    socket.on("timing-update", (data) => {
      console.log("Timing update received:", data);
      get().applyServerUpdate("timing", data);
    });

    set({ socket });
  },

  sendToServer: (category, data) => {
    const { socket, roomId, isInRoom } = get();
    if (!socket || !isInRoom) {
      console.warn("Cannot send to server: not connected or not in room");
      return;
    }

    console.log(`Sending ${category} update:`, data);
    socket.emit(`${category}-update`, { roomId, ...data });
  },

  // ============ ROOM MANAGEMENT ============
  createRoom: async () => {
    const { socket } = get();
    if (!socket) throw new Error("Not connected to server");

    return new Promise((resolve, reject) => {
      console.log("Creating room...");
      socket.emit("create-room", (response) => {
        if (response.success) {
          console.log("Room created:", response.roomId);
          set({
            roomId: response.roomId,
            isInRoom: true,
            users: response.roomState.users || [],
            error: null,
          });
          resolve(response.roomState);
        } else {
          console.error("Failed to create room:", response.error);
          set({ error: "Failed to create room" });
          reject(new Error(response.error));
        }
      });
    });
  },

  joinRoom: async (targetRoomId) => {
    const { socket } = get();
    if (!socket || !targetRoomId?.trim()) {
      throw new Error("Invalid connection or room ID");
    }

    return new Promise((resolve, reject) => {
      console.log("Joining room:", targetRoomId);
      socket.emit("join-room", { roomId: targetRoomId.trim() }, (response) => {
        if (response.success) {
          console.log("Joined room:", targetRoomId);

          // Sync entire state from server
          const roomState = response.roomState;
          set({
            roomId: targetRoomId.trim(),
            isInRoom: true,
            users: roomState.users || [],
            pattern: roomState.pattern || {},
            tracks: roomState.tracks || get().tracks,
            bpm: roomState.bpm || get().bpm,
            measureCount: roomState.measureCount || get().measureCount,
            error: null,
          });

          resolve(roomState);
        } else {
          console.error("Failed to join room:", response.error);
          set({ error: `Failed to join room: ${response.error}` });
          reject(new Error(response.error));
        }
      });
    });
  },

  // ============ CLEANUP ============
  disconnect: () => {
    const { socket } = get();
    if (socket) {
      console.log("Disconnecting from server");
      socket.close();
    }

    set({
      socket: null,
      isConnected: false,
      isInRoom: false,
      roomId: null,
      users: [],
      error: null,
    });
  },

  // ============ STATE SYNC UTILITIES ============
  syncFromServer: (serverState) => {
    // Helper to sync entire state from server (used in room join)
    set({
      pattern: serverState.pattern || {},
      tracks: serverState.tracks || get().tracks,
      bpm: serverState.bpm || get().bpm,
      measureCount: serverState.measureCount || get().measureCount,
    });
  },
}));
