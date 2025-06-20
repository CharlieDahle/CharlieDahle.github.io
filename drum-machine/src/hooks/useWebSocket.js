import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";

export function useWebSocket() {
  // Connection state
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  // Room state
  const [roomId, setRoomId] = useState(null);
  const [isInRoom, setIsInRoom] = useState(false);
  const [users, setUsers] = useState([]);

  // Event handlers that components can subscribe to
  const eventHandlers = useRef({
    onPatternUpdate: null,
    onBpmChange: null,
    onTransportSync: null,
  });

  // Initialize WebSocket connection
  useEffect(() => {
    console.log("Connecting to server...");
    const newSocket = io("https://api.charliedahle.me");

    // Connection events
    newSocket.on("connect", () => {
      console.log(
        `[${new Date().toISOString()}] Connected to server, ID: ${newSocket.id}`
      );
      setIsConnected(true);
      setError(null);
    });

    newSocket.on("disconnect", () => {
      console.log(
        `[${new Date().toISOString()}] Disconnected from server, reason: ${reason}`
      );
      setIsConnected(false);
      setIsInRoom(false);
      setError("Disconnected from server");
    });

    newSocket.on("connect_error", (err) => {
      console.error(
        `[${new Date().toISOString()}] Connection error:`,
        err.message
      );
      setError("Failed to connect to server");
    });

    // Room events
    newSocket.on("user-joined", ({ userId, userCount }) => {
      console.log("User joined:", userId, "Total users:", userCount);
      setUsers((prev) => [...prev, userId]);
    });

    newSocket.on("user-left", ({ userId, userCount }) => {
      console.log("User left:", userId, "Total users:", userCount);
      setUsers((prev) => prev.filter((id) => id !== userId));
    });

    // Pattern and playback events
    newSocket.on("pattern-update", (change) => {
      console.log("Pattern update received:", change);
      eventHandlers.current.onPatternUpdate?.(change);
    });

    newSocket.on("bpm-change", ({ bpm: newBpm }) => {
      console.log("BPM changed to:", newBpm);
      eventHandlers.current.onBpmChange?.(newBpm);
    });

    newSocket.on("transport-sync", (command) => {
      console.log("Transport command received:", command);
      eventHandlers.current.onTransportSync?.(command);
    });

    setSocket(newSocket);

    return () => {
      console.log("Cleaning up socket connection");
      newSocket.close();
    };
  }, []);

  // API methods for components to use
  const api = {
    // Room management
    createRoom: () => {
      if (!socket || !isConnected) return Promise.reject("Not connected");

      return new Promise((resolve, reject) => {
        console.log("Creating room...");
        socket.emit("create-room", (response) => {
          if (response.success) {
            console.log("Room created:", response.roomId);
            setRoomId(response.roomId);
            setIsInRoom(true);
            setUsers(response.roomState.users);
            setError(null);
            resolve(response.roomState);
          } else {
            console.error("Failed to create room:", response.error);
            setError("Failed to create room");
            reject(response.error);
          }
        });
      });
    },

    joinRoom: (targetRoomId) => {
      if (!socket || !isConnected || !targetRoomId.trim()) {
        return Promise.reject("Invalid connection or room ID");
      }

      return new Promise((resolve, reject) => {
        console.log("Joining room:", targetRoomId);
        socket.emit(
          "join-room",
          { roomId: targetRoomId.trim() },
          (response) => {
            if (response.success) {
              console.log("Joined room:", targetRoomId);
              setRoomId(targetRoomId.trim());
              setIsInRoom(true);
              setUsers(response.roomState.users);
              setError(null);
              resolve(response.roomState);
            } else {
              console.error("Failed to join room:", response.error);
              setError(`Failed to join room: ${response.error}`);
              reject(response.error);
            }
          }
        );
      });
    },

    // Pattern management
    sendPatternChange: (change) => {
      if (!socket || !isInRoom) return;

      console.log("Sending pattern change:", change);
      socket.emit("pattern-change", {
        roomId,
        change,
      });
    },

    // BPM management
    setBpm: (newBpm) => {
      if (!socket || !isInRoom) return;

      const clampedBpm = Math.max(60, Math.min(300, newBpm));
      console.log("Changing BPM to:", clampedBpm);
      socket.emit("set-bpm", {
        roomId,
        bpm: clampedBpm,
      });
    },

    // Transport controls
    sendTransportCommand: (command) => {
      if (!socket || !isInRoom) return;

      console.log("Sending transport command:", command);
      socket.emit("transport-command", {
        roomId,
        command,
      });
    },

    // Event subscription
    subscribe: (eventName, handler) => {
      eventHandlers.current[eventName] = handler;
    },

    unsubscribe: (eventName) => {
      eventHandlers.current[eventName] = null;
    },
  };

  return {
    // State
    isConnected,
    isInRoom,
    roomId,
    users,
    error,

    // API
    ...api,
  };
}
