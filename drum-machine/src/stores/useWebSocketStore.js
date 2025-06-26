// src/stores/useWebSocketStore.js
import { create } from "zustand";
import io from "socket.io-client";

export const useWebSocketStore = create((set, get) => ({
  // Connection state
  socket: null,
  isConnected: false,
  error: null,

  // Room state
  roomId: null,
  isInRoom: false,
  users: [],

  // Store references for coordination (will be set by the app)
  patternStore: null,
  transportStore: null,

  // Initialize WebSocket connection
  initializeConnection: () => {
    console.log("Connecting to server...");
    const newSocket = io("https://api.charliedahle.me");
    // const newSocket = io("http://localhost:3001");

    // Connection events
    newSocket.on("connect", () => {
      console.log(
        `[${new Date().toISOString()}] Connected to server, ID: ${newSocket.id}`
      );
      set({ isConnected: true, error: null });
    });

    newSocket.on("disconnect", () => {
      console.log(`[${new Date().toISOString()}] Disconnected from server`);
      set({
        isConnected: false,
        isInRoom: false,
        error: "Disconnected from server",
      });
    });

    newSocket.on("connect_error", (err) => {
      console.error(
        `[${new Date().toISOString()}] Connection error:`,
        err.message
      );
      set({ error: "Failed to connect to server" });
    });

    // Room events
    newSocket.on("user-joined", ({ userId, userCount }) => {
      console.log("User joined:", userId, "Total users:", userCount);
      set((state) => ({ users: [...state.users, userId] }));
    });

    newSocket.on("user-left", ({ userId, userCount }) => {
      console.log("User left:", userId, "Total users:", userCount);
      set((state) => ({ users: state.users.filter((id) => id !== userId) }));
    });

    // Pattern and playback events - coordinate with other stores
    newSocket.on("pattern-update", (change) => {
      console.log("Pattern update received:", change);
      const { patternStore } = get();
      if (patternStore) {
        patternStore.getState().applyPatternChange(change);
      }
    });

    newSocket.on("bpm-change", ({ bpm: newBpm }) => {
      console.log("BPM changed to:", newBpm);
      const { transportStore } = get();
      if (transportStore) {
        transportStore.getState().syncBpm(newBpm);
      }
    });

    newSocket.on("transport-sync", (command) => {
      console.log("Transport command received:", command);
      const { transportStore } = get();
      if (transportStore) {
        transportStore.getState().syncTransportCommand(command);
      }
    });

    set({ socket: newSocket });

    return newSocket;
  },

  // Set store references for coordination
  setStoreReferences: (patternStore, transportStore) => {
    set({ patternStore, transportStore });
  },

  // Room management
  createRoom: () => {
    const { socket, isConnected } = get();
    if (!socket || !isConnected) return Promise.reject("Not connected");

    return new Promise((resolve, reject) => {
      console.log("Creating room...");
      socket.emit("create-room", (response) => {
        if (response.success) {
          console.log("Room created:", response.roomId);
          set({
            roomId: response.roomId,
            isInRoom: true,
            users: response.roomState.users,
            error: null,
          });
          resolve(response.roomState);
        } else {
          console.error("Failed to create room:", response.error);
          set({ error: "Failed to create room" });
          reject(response.error);
        }
      });
    });
  },

  joinRoom: (targetRoomId) => {
    const { socket, isConnected } = get();
    if (!socket || !isConnected || !targetRoomId.trim()) {
      return Promise.reject("Invalid connection or room ID");
    }

    return new Promise((resolve, reject) => {
      console.log("Joining room:", targetRoomId);
      socket.emit("join-room", { roomId: targetRoomId.trim() }, (response) => {
        if (response.success) {
          console.log("Joined room:", targetRoomId);
          set({
            roomId: targetRoomId.trim(),
            isInRoom: true,
            users: response.roomState.users,
            error: null,
          });
          resolve(response.roomState);
        } else {
          console.error("Failed to join room:", response.error);
          set({ error: `Failed to join room: ${response.error}` });
          reject(response.error);
        }
      });
    });
  },

  // Send pattern change to server
  sendPatternChange: (change) => {
    const { socket, isInRoom, roomId } = get();
    if (!socket || !isInRoom) return;

    console.log("Sending pattern change:", change);
    socket.emit("pattern-change", {
      roomId,
      change,
    });
  },

  // Send BPM change to server
  sendBpmChange: (newBpm) => {
    const { socket, isInRoom, roomId } = get();
    if (!socket || !isInRoom) return;

    const clampedBpm = Math.max(60, Math.min(300, newBpm));
    console.log("Changing BPM to:", clampedBpm);
    socket.emit("set-bpm", {
      roomId,
      bpm: clampedBpm,
    });
  },

  // Send transport command to server
  sendTransportCommand: (command) => {
    const { socket, isInRoom, roomId } = get();
    if (!socket || !isInRoom) return;

    console.log("Sending transport command:", command);
    socket.emit("transport-command", {
      roomId,
      command,
    });
  },

  // Cleanup
  cleanup: () => {
    const { socket } = get();
    if (socket) {
      console.log("Cleaning up socket connection");
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
}));
