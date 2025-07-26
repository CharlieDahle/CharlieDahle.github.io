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

  // Remote transport command state for DrumMachine coordination
  lastRemoteTransportCommand: null,

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

    // Pattern and playback events - call other stores directly
    newSocket.on("pattern-update", (change) => {
      console.log("Pattern update received:", change);
      // Import and call the store directly
      import("./usePatternStore").then(({ usePatternStore }) => {
        usePatternStore.getState().applyPatternChange(change);
      });
    });

    newSocket.on("bpm-change", ({ bpm: newBpm }) => {
      console.log("BPM changed to:", newBpm);
      // Import and call the store directly
      import("./useTransportStore").then(({ useTransportStore }) => {
        useTransportStore.getState().syncBpm(newBpm);
      });
    });

    newSocket.on("measure-count-change", ({ measureCount }) => {
      console.log("Measure count changed to:", measureCount);
      // Import and call the store directly
      import("./useTransportStore").then(({ useTransportStore }) => {
        useTransportStore.getState().syncMeasureCount(measureCount);
      });
    });

    // Track management events
    newSocket.on("track-added", ({ trackData }) => {
      console.log("Track added:", trackData);
      // Import and call the store directly
      import("./useTrackStore").then(({ useTrackStore }) => {
        useTrackStore.getState().syncAddTrack(trackData);
      });
    });

    newSocket.on("track-removed", ({ trackId }) => {
      console.log("Track removed:", trackId);
      // Import and call the store directly
      import("./useTrackStore").then(({ useTrackStore }) => {
        useTrackStore.getState().syncRemoveTrack(trackId);
      });
    });

    newSocket.on("track-sound-updated", ({ trackId, soundFile }) => {
      console.log("Track sound updated:", trackId, soundFile);
      // Import and call the store directly
      import("./useTrackStore").then(({ useTrackStore }) => {
        useTrackStore.getState().syncUpdateTrackSound(trackId, soundFile);
      });
    });

    newSocket.on("transport-sync", (command) => {
      console.log(`🌐 RECEIVED transport sync:`, command);

      // Import and call the transport store directly
      import("./useTransportStore").then(({ useTransportStore }) => {
        useTransportStore.getState().syncTransportCommand(command);
      });

      // Set a flag that DrumMachine can listen to for audio coordination
      set({
        lastRemoteTransportCommand: { ...command, timestamp: Date.now() },
      });
    });

    set({ socket: newSocket });

    return newSocket;
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
      console.log("WebSocketStore: Joining room:", targetRoomId);

      // Add timeout to prevent hanging promises
      const timeout = setTimeout(() => {
        console.error("WebSocketStore: Join room timed out");
        reject(new Error("Join room request timed out"));
      }, 10000);

      socket.emit("join-room", { roomId: targetRoomId.trim() }, (response) => {
        clearTimeout(timeout);

        console.log("WebSocketStore: Received join-room response:", response);

        if (response && response.success) {
          console.log(
            "WebSocketStore: Successfully joined room:",
            targetRoomId
          );
          set({
            roomId: targetRoomId.trim(),
            isInRoom: true,
            users: response.roomState.users,
            error: null,
          });
          resolve(response.roomState);
        } else {
          const errorMsg = response?.error || "Unknown error";
          console.error("WebSocketStore: Failed to join room:", errorMsg);
          set({ error: `Failed to join room: ${errorMsg}` });
          reject(new Error(errorMsg));
        }
      });
    });
  },

  // Send pattern change to server (now handles velocity changes)
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

  // Send measure count change to server
  sendMeasureCountChange: (measureCount) => {
    const { socket, isInRoom, roomId } = get();
    if (!socket || !isInRoom) return;

    console.log("Sending measure count change:", measureCount);
    socket.emit("set-measure-count", {
      roomId,
      measureCount,
    });
  },

  // Track management methods
  sendAddTrack: (trackData) => {
    const { socket, isInRoom, roomId } = get();
    if (!socket || !isInRoom) return;

    console.log("Sending add track:", trackData);
    socket.emit("add-track", {
      roomId,
      trackData,
    });
  },

  sendRemoveTrack: (trackId) => {
    const { socket, isInRoom, roomId } = get();
    if (!socket || !isInRoom) return;

    console.log("Sending remove track:", trackId);
    socket.emit("remove-track", {
      roomId,
      trackId,
    });
  },

  sendUpdateTrackSound: (trackId, soundFile) => {
    const { socket, isInRoom, roomId } = get();
    if (!socket || !isInRoom) return;

    console.log("Sending track sound update:", trackId, soundFile);
    socket.emit("update-track-sound", {
      roomId,
      trackId,
      soundFile,
    });
  },

  // Send transport command to server
  sendTransportCommand: (command) => {
    const { socket, isInRoom, roomId } = get();
    if (!socket || !isInRoom) return;

    console.log(`🌐 [${roomId}] SENDING transport command:`, command);
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
      lastRemoteTransportCommand: null,
    });
  },
}));
