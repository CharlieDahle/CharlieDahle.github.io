import { create } from "zustand";
import io from "socket.io-client";
import drumSounds from "../assets/data/drum-sounds.json";

// Helper function to normalize notes - converts old format to new format
const normalizeNote = (note) => {
  if (typeof note === "number") {
    return { tick: note, velocity: 4 };
  }
  return note;
};

// Helper function to ensure velocity is valid (1-4)
const clampVelocity = (velocity) => {
  return Math.max(1, Math.min(4, velocity || 4));
};

export const useAppStore = create((set, get) => ({
  // ============================================================================
  // PATTERN SLICE
  // ============================================================================
  pattern: {
    data: {},

    addNote: (trackId, tick, velocity = 4) => {
      set((state) => {
        const newData = { ...state.pattern.data };

        if (!newData[trackId]) {
          newData[trackId] = [];
        }

        const normalizedNotes = newData[trackId].map(normalizeNote);
        const existingNoteIndex = normalizedNotes.findIndex(
          (note) => note.tick === tick
        );

        if (existingNoteIndex === -1) {
          newData[trackId] = [
            ...normalizedNotes,
            { tick, velocity: clampVelocity(velocity) },
          ];
        }

        return { pattern: { ...state.pattern, data: newData } };
      });

      // Send to server
      get().websocket.sendPatternChange({
        type: "add-note",
        trackId,
        tick,
        velocity,
      });
    },

    removeNote: (trackId, tick) => {
      set((state) => {
        const newData = { ...state.pattern.data };

        if (newData[trackId]) {
          const normalizedNotes = newData[trackId].map(normalizeNote);
          newData[trackId] = normalizedNotes.filter(
            (note) => note.tick !== tick
          );
        }

        return { pattern: { ...state.pattern, data: newData } };
      });

      // Send to server
      get().websocket.sendPatternChange({
        type: "remove-note",
        trackId,
        tick,
      });
    },

    updateNoteVelocity: (trackId, tick, velocity) => {
      set((state) => {
        const newData = { ...state.pattern.data };

        if (newData[trackId]) {
          const normalizedNotes = newData[trackId].map(normalizeNote);
          newData[trackId] = normalizedNotes.map((note) =>
            note.tick === tick
              ? { ...note, velocity: clampVelocity(velocity) }
              : note
          );
        }

        return { pattern: { ...state.pattern, data: newData } };
      });

      // Send to server
      get().websocket.sendPatternChange({
        type: "update-note-velocity",
        trackId,
        tick,
        velocity,
      });
    },

    moveNote: (trackId, fromTick, toTick) => {
      set((state) => {
        const newData = { ...state.pattern.data };

        if (newData[trackId]) {
          const normalizedNotes = newData[trackId].map(normalizeNote);
          const noteToMove = normalizedNotes.find(
            (note) => note.tick === fromTick
          );

          if (noteToMove) {
            newData[trackId] = normalizedNotes
              .filter((note) => note.tick !== fromTick)
              .concat({ ...noteToMove, tick: toTick });
          }
        }

        return { pattern: { ...state.pattern, data: newData } };
      });

      // Send to server
      get().websocket.sendPatternChange({
        type: "move-note",
        trackId,
        fromTick,
        toTick,
      });
    },

    clearTrack: (trackId) => {
      set((state) => ({
        pattern: {
          ...state.pattern,
          data: {
            ...state.pattern.data,
            [trackId]: [],
          },
        },
      }));

      // Send to server
      get().websocket.sendPatternChange({
        type: "clear-track",
        trackId,
      });
    },

    clearAllTracks: () => {
      set((state) => ({ pattern: { ...state.pattern, data: {} } }));
    },

    setPattern: (newPattern) => {
      const normalizedPattern = {};
      Object.keys(newPattern).forEach((trackId) => {
        normalizedPattern[trackId] = newPattern[trackId].map(normalizeNote);
      });
      set((state) => ({
        pattern: { ...state.pattern, data: normalizedPattern },
      }));
    },

    removeTrackFromPattern: (trackId) => {
      set((state) => {
        const newData = { ...state.pattern.data };
        delete newData[trackId];
        return { pattern: { ...state.pattern, data: newData } };
      });
    },

    // Getter helpers
    getNotesForTrack: (trackId) => {
      const notes = get().pattern.data[trackId] || [];
      return notes.map(normalizeNote);
    },

    hasNoteAt: (trackId, tick) => {
      const notes = get().pattern.getNotesForTrack(trackId);
      return notes.some((note) => note.tick === tick);
    },

    getNoteAt: (trackId, tick) => {
      const notes = get().pattern.getNotesForTrack(trackId);
      return notes.find((note) => note.tick === tick) || null;
    },

    getTotalNotes: () => {
      const data = get().pattern.data;
      return Object.values(data).reduce(
        (total, notes) => total + notes.length,
        0
      );
    },

    getActiveTrackIds: () => {
      const data = get().pattern.data;
      return Object.keys(data).filter((trackId) => data[trackId].length > 0);
    },
  },

  // ============================================================================
  // TRANSPORT SLICE
  // ============================================================================
  transport: {
    isPlaying: false,
    currentTick: 0,
    bpm: 120,
    TICKS_PER_BEAT: 480,
    BEATS_PER_LOOP: 16,
    measureCount: 4,

    play: () => {
      set((state) => ({ transport: { ...state.transport, isPlaying: true } }));
      get().websocket.sendTransportCommand({ type: "play" });
    },

    pause: () => {
      set((state) => ({ transport: { ...state.transport, isPlaying: false } }));
      get().websocket.sendTransportCommand({ type: "pause" });
    },

    stop: () => {
      set((state) => ({
        transport: {
          ...state.transport,
          isPlaying: false,
          currentTick: 0,
        },
      }));
      get().websocket.sendTransportCommand({ type: "stop" });
    },

    setCurrentTick: (tick) => {
      set((state) => ({
        transport: { ...state.transport, currentTick: tick },
      }));
    },

    setBpm: (newBpm) => {
      const clampedBpm = Math.max(60, Math.min(300, newBpm));
      set((state) => ({ transport: { ...state.transport, bpm: clampedBpm } }));
      get().websocket.sendBpmChange(clampedBpm);
    },

    addMeasure: () => {
      set((state) => {
        const newMeasureCount = state.transport.measureCount + 1;
        return {
          transport: {
            ...state.transport,
            measureCount: newMeasureCount,
            BEATS_PER_LOOP: newMeasureCount * 4,
          },
        };
      });
      get().websocket.sendMeasureCountChange(get().transport.measureCount);
    },

    removeMeasure: () => {
      set((state) => {
        const newMeasureCount = Math.max(1, state.transport.measureCount - 1);
        return {
          transport: {
            ...state.transport,
            measureCount: newMeasureCount,
            BEATS_PER_LOOP: newMeasureCount * 4,
          },
        };
      });
      get().websocket.sendMeasureCountChange(get().transport.measureCount);
    },

    setMeasureCount: (count) => {
      const clampedCount = Math.max(1, Math.min(16, count));
      set((state) => ({
        transport: {
          ...state.transport,
          measureCount: clampedCount,
          BEATS_PER_LOOP: clampedCount * 4,
        },
      }));
    },

    // Sync methods (for WebSocket updates)
    syncBpm: (serverBpm) => {
      set((state) => ({ transport: { ...state.transport, bpm: serverBpm } }));
    },

    syncMeasureCount: (serverMeasureCount) => {
      set((state) => ({
        transport: {
          ...state.transport,
          measureCount: serverMeasureCount,
          BEATS_PER_LOOP: serverMeasureCount * 4,
        },
      }));
    },

    syncTransportCommand: (command) => {
      const currentState = get().transport;
      switch (command.type) {
        case "play":
          if (!currentState.isPlaying) {
            set((state) => ({
              transport: { ...state.transport, isPlaying: true },
            }));
          }
          break;
        case "pause":
          if (currentState.isPlaying) {
            set((state) => ({
              transport: { ...state.transport, isPlaying: false },
            }));
          }
          break;
        case "stop":
          set((state) => ({
            transport: {
              ...state.transport,
              isPlaying: false,
              currentTick: 0,
            },
          }));
          break;
        default:
          console.warn("Unknown transport command type:", command.type);
      }
    },

    // Computed getters
    getTotalTicks: () => {
      const { TICKS_PER_BEAT, BEATS_PER_LOOP } = get().transport;
      return TICKS_PER_BEAT * BEATS_PER_LOOP;
    },

    getCurrentBeat: () => {
      const { currentTick, TICKS_PER_BEAT } = get().transport;
      return Math.floor(currentTick / TICKS_PER_BEAT) + 1;
    },

    getCurrentMeasure: () => {
      const { currentTick, TICKS_PER_BEAT } = get().transport;
      return Math.floor(currentTick / (TICKS_PER_BEAT * 4)) + 1;
    },

    getProgress: () => {
      const { currentTick } = get().transport;
      const totalTicks = get().transport.getTotalTicks();
      return (currentTick / totalTicks) * 100;
    },
  },

  // ============================================================================
  // TRACKS SLICE
  // ============================================================================
  tracks: {
    list: [
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

    addTrack: (trackData) => {
      const newTrack = {
        id: `track_${Date.now()}`,
        name: trackData?.name || "New Track",
        color: trackData?.color || "#9b59b6",
        soundFile: trackData?.soundFile || null,
        availableSounds: trackData?.availableSounds || [],
      };

      set((state) => ({
        tracks: {
          ...state.tracks,
          list: [...state.tracks.list, newTrack],
        },
      }));

      // Send to server
      get().websocket.sendAddTrack(newTrack);

      return newTrack;
    },

    removeTrack: (trackId) => {
      set((state) => ({
        tracks: {
          ...state.tracks,
          list: state.tracks.list.filter((track) => track.id !== trackId),
        },
      }));

      // Clean up pattern
      get().pattern.removeTrackFromPattern(trackId);

      // Clean up effects - ADD THIS LINE:
      get().effects.removeTrackEffects(trackId);

      // Send to server
      get().websocket.sendRemoveTrack(trackId);
    },

    updateTrackSound: (trackId, newSoundFile) => {
      set((state) => ({
        tracks: {
          ...state.tracks,
          list: state.tracks.list.map((track) =>
            track.id === trackId ? { ...track, soundFile: newSoundFile } : track
          ),
        },
      }));

      // Send to server
      get().websocket.sendUpdateTrackSound(trackId, newSoundFile);
    },

    updateTrack: (trackId, updates) => {
      set((state) => ({
        tracks: {
          ...state.tracks,
          list: state.tracks.list.map((track) =>
            track.id === trackId ? { ...track, ...updates } : track
          ),
        },
      }));
    },

    setTracks: (newTracks) => {
      set((state) => ({ tracks: { ...state.tracks, list: newTracks } }));
    },

    // Sync methods (for WebSocket updates)
    syncAddTrack: (trackData) => {
      set((state) => ({
        tracks: {
          ...state.tracks,
          list: [...state.tracks.list, trackData],
        },
      }));
    },

    syncRemoveTrack: (trackId) => {
      set((state) => ({
        tracks: {
          ...state.tracks,
          list: state.tracks.list.filter((track) => track.id !== trackId),
        },
      }));
      get().pattern.removeTrackFromPattern(trackId);
    },

    syncUpdateTrackSound: (trackId, newSoundFile) => {
      set((state) => ({
        tracks: {
          ...state.tracks,
          list: state.tracks.list.map((track) =>
            track.id === trackId ? { ...track, soundFile: newSoundFile } : track
          ),
        },
      }));
    },

    // Getter helpers
    getTrackById: (trackId) => {
      return get().tracks.list.find((track) => track.id === trackId);
    },

    getTrackCount: () => {
      return get().tracks.list.length;
    },
  },

  // ============================================================================
  // UI SLICE
  // ============================================================================
  ui: {
    snapToGrid: true,
    soundModalOpen: false,
    soundModalTrack: null,
    error: null,
    isLoading: false,
    effectsModalOpen: false,
    effectsModalTrack: null,
    error: null,
    isLoading: false,

    setSnapToGrid: (value) => {
      set((state) => ({ ui: { ...state.ui, snapToGrid: value } }));
    },

    openSoundModal: (track) => {
      set((state) => ({
        ui: {
          ...state.ui,
          soundModalOpen: true,
          soundModalTrack: track,
        },
      }));
    },

    closeSoundModal: () => {
      set((state) => ({
        ui: {
          ...state.ui,
          soundModalOpen: false,
          soundModalTrack: null,
        },
      }));
    },

    openEffectsModal: (track) => {
      set((state) => ({
        ui: {
          ...state.ui,
          effectsModalOpen: true,
          effectsModalTrack: track,
        },
      }));
    },

    closeEffectsModal: () => {
      set((state) => ({
        ui: {
          ...state.ui,
          effectsModalOpen: false,
          effectsModalTrack: null,
        },
      }));
    },

    setError: (error) => {
      set((state) => ({ ui: { ...state.ui, error } }));
    },

    clearError: () => {
      set((state) => ({ ui: { ...state.ui, error: null } }));
    },

    setLoading: (loading) => {
      set((state) => ({ ui: { ...state.ui, isLoading: loading } }));
    },
  },

  // ============================================================================
  // WEBSOCKET SLICE
  // ============================================================================
  websocket: {
    socket: null,
    isConnected: false,
    error: null,
    roomId: null,
    isInRoom: false,
    users: [],
    lastRemoteTransportCommand: null,

    initializeConnection: () => {
      console.log("Connecting to server...");
      const newSocket = io("https://api.charliedahle.me");

      // Connection events
      newSocket.on("connect", () => {
        console.log(`Connected to server, ID: ${newSocket.id}`);
        set((state) => ({
          websocket: { ...state.websocket, isConnected: true, error: null },
        }));
      });

      newSocket.on("disconnect", () => {
        console.log("Disconnected from server");
        set((state) => ({
          websocket: {
            ...state.websocket,
            isConnected: false,
            isInRoom: false,
            error: "Disconnected from server",
          },
        }));
      });

      newSocket.on("connect_error", (err) => {
        console.error("Connection error:", err.message);
        set((state) => ({
          websocket: {
            ...state.websocket,
            error: "Failed to connect to server",
          },
        }));
      });

      // Room events
      newSocket.on("user-joined", ({ userId, userCount }) => {
        console.log("User joined:", userId);
        set((state) => ({
          websocket: {
            ...state.websocket,
            users: [...state.websocket.users, userId],
          },
        }));
      });

      newSocket.on("user-left", ({ userId, userCount }) => {
        console.log("User left:", userId);
        set((state) => ({
          websocket: {
            ...state.websocket,
            users: state.websocket.users.filter((id) => id !== userId),
          },
        }));
      });

      newSocket.on(
        "effect-change",
        ({ trackId, effectType, parameter, value }) => {
          console.log("Effect change received:", {
            trackId,
            effectType,
            parameter,
            value,
          });
          get().effects.syncTrackEffect(trackId, effectType, parameter, value);
        }
      );

      newSocket.on("effect-reset", ({ trackId }) => {
        console.log("Effect reset received:", trackId);
        get().effects.syncTrackEffectReset(trackId);
      });

      // Pattern events - direct store updates (no more dynamic imports!)
      newSocket.on("pattern-update", (change) => {
        console.log("Pattern update received:", change);
        const { pattern } = get();

        // Apply change directly to pattern slice
        switch (change.type) {
          case "add-note":
            // Update pattern data directly without triggering WebSocket send
            set((state) => {
              const newData = { ...state.pattern.data };
              if (!newData[change.trackId]) {
                newData[change.trackId] = [];
              }
              const normalizedNotes =
                newData[change.trackId].map(normalizeNote);
              const existingNoteIndex = normalizedNotes.findIndex(
                (note) => note.tick === change.tick
              );
              if (existingNoteIndex === -1) {
                newData[change.trackId] = [
                  ...normalizedNotes,
                  {
                    tick: change.tick,
                    velocity: clampVelocity(change.velocity),
                  },
                ];
              }
              return { pattern: { ...state.pattern, data: newData } };
            });
            break;

          case "remove-note":
            set((state) => {
              const newData = { ...state.pattern.data };
              if (newData[change.trackId]) {
                const normalizedNotes =
                  newData[change.trackId].map(normalizeNote);
                newData[change.trackId] = normalizedNotes.filter(
                  (note) => note.tick !== change.tick
                );
              }
              return { pattern: { ...state.pattern, data: newData } };
            });
            break;

          case "update-note-velocity":
            set((state) => {
              const newData = { ...state.pattern.data };
              if (newData[change.trackId]) {
                const normalizedNotes =
                  newData[change.trackId].map(normalizeNote);
                newData[change.trackId] = normalizedNotes.map((note) =>
                  note.tick === change.tick
                    ? { ...note, velocity: clampVelocity(change.velocity) }
                    : note
                );
              }
              return { pattern: { ...state.pattern, data: newData } };
            });
            break;

          case "move-note":
            set((state) => {
              const newData = { ...state.pattern.data };
              if (newData[change.trackId]) {
                const normalizedNotes =
                  newData[change.trackId].map(normalizeNote);
                const noteToMove = normalizedNotes.find(
                  (note) => note.tick === change.fromTick
                );
                if (noteToMove) {
                  newData[change.trackId] = normalizedNotes
                    .filter((note) => note.tick !== change.fromTick)
                    .concat({ ...noteToMove, tick: change.toTick });
                }
              }
              return { pattern: { ...state.pattern, data: newData } };
            });
            break;

          case "clear-track":
            set((state) => ({
              pattern: {
                ...state.pattern,
                data: {
                  ...state.pattern.data,
                  [change.trackId]: [],
                },
              },
            }));
            break;

          default:
            console.warn("Unknown pattern change type:", change.type);
        }
      });

      // Transport events
      newSocket.on("transport-sync", (command) => {
        console.log("Transport sync received:", command);
        get().transport.syncTransportCommand(command);
        set((state) => ({
          websocket: {
            ...state.websocket,
            lastRemoteTransportCommand: { ...command, timestamp: Date.now() },
          },
        }));
      });

      // BPM events
      newSocket.on("bpm-change", ({ bpm: newBpm }) => {
        console.log("BPM changed to:", newBpm);
        get().transport.syncBpm(newBpm);
      });

      // Measure count events
      newSocket.on("measure-count-change", ({ measureCount }) => {
        console.log("Measure count changed to:", measureCount);
        get().transport.syncMeasureCount(measureCount);
      });

      // Track events
      newSocket.on("track-added", ({ trackData }) => {
        console.log("Track added:", trackData);
        get().tracks.syncAddTrack(trackData);
      });

      newSocket.on("track-removed", ({ trackId }) => {
        console.log("Track removed:", trackId);
        get().tracks.syncRemoveTrack(trackId);
      });

      newSocket.on("track-sound-updated", ({ trackId, soundFile }) => {
        console.log("Track sound updated:", trackId, soundFile);
        get().tracks.syncUpdateTrackSound(trackId, soundFile);
      });

      set((state) => ({
        websocket: { ...state.websocket, socket: newSocket },
      }));

      return newSocket;
    },

    createRoom: () => {
      const { socket, isConnected } = get().websocket;
      if (!socket || !isConnected) return Promise.reject("Not connected");

      return new Promise((resolve, reject) => {
        console.log("Creating room...");
        socket.emit("create-room", (response) => {
          if (response.success) {
            console.log("Room created:", response.roomId);
            set((state) => ({
              websocket: {
                ...state.websocket,
                roomId: response.roomId,
                isInRoom: true,
                users: response.roomState.users,
                error: null,
              },
            }));
            resolve(response.roomState);
          } else {
            console.error("Failed to create room:", response.error);
            set((state) => ({
              websocket: { ...state.websocket, error: "Failed to create room" },
            }));
            reject(response.error);
          }
        });
      });
    },

    joinRoom: (targetRoomId) => {
      const { socket, isConnected } = get().websocket;
      if (!socket || !isConnected || !targetRoomId.trim()) {
        return Promise.reject("Invalid connection or room ID");
      }

      return new Promise((resolve, reject) => {
        console.log("Joining room:", targetRoomId);

        const timeout = setTimeout(() => {
          reject(new Error("Join room request timed out"));
        }, 10000);

        socket.emit(
          "join-room",
          { roomId: targetRoomId.trim() },
          (response) => {
            clearTimeout(timeout);

            if (response && response.success) {
              console.log("Successfully joined room:", targetRoomId);
              set((state) => ({
                websocket: {
                  ...state.websocket,
                  roomId: targetRoomId.trim(),
                  isInRoom: true,
                  users: response.roomState.users,
                  error: null,
                },
              }));
              resolve(response.roomState);
            } else {
              const errorMsg = response?.error || "Unknown error";
              console.error("Failed to join room:", errorMsg);
              set((state) => ({
                websocket: {
                  ...state.websocket,
                  error: `Failed to join room: ${errorMsg}`,
                },
              }));
              reject(new Error(errorMsg));
            }
          }
        );
      });
    },

    leaveRoom: () => {
      const { socket, isInRoom, roomId } = get().websocket;
      if (!socket || !isInRoom) return;

      console.log("Leaving room:", roomId);
      socket.emit("leave-room", { roomId });

      set((state) => ({
        websocket: {
          ...state.websocket,
          isInRoom: false,
          roomId: null,
          users: [],
          lastRemoteTransportCommand: null,
        },
      }));
    },

    // Send methods
    sendPatternChange: (change) => {
      const { socket, isInRoom, roomId } = get().websocket;
      if (!socket || !isInRoom) return;

      console.log("Sending pattern change:", change);
      socket.emit("pattern-change", { roomId, change });
    },

    sendBpmChange: (newBpm) => {
      const { socket, isInRoom, roomId } = get().websocket;
      if (!socket || !isInRoom) return;

      const clampedBpm = Math.max(60, Math.min(300, newBpm));
      console.log("Sending BPM change:", clampedBpm);
      socket.emit("set-bpm", { roomId, bpm: clampedBpm });
    },

    sendMeasureCountChange: (measureCount) => {
      const { socket, isInRoom, roomId } = get().websocket;
      if (!socket || !isInRoom) return;

      console.log("Sending measure count change:", measureCount);
      socket.emit("set-measure-count", { roomId, measureCount });
    },

    sendTransportCommand: (command) => {
      const { socket, isInRoom, roomId } = get().websocket;
      if (!socket || !isInRoom) return;

      console.log("Sending transport command:", command);
      socket.emit("transport-command", { roomId, command });
    },

    sendAddTrack: (trackData) => {
      const { socket, isInRoom, roomId } = get().websocket;
      if (!socket || !isInRoom) return;

      console.log("Sending add track:", trackData);
      socket.emit("add-track", { roomId, trackData });
    },

    sendRemoveTrack: (trackId) => {
      const { socket, isInRoom, roomId } = get().websocket;
      if (!socket || !isInRoom) return;

      console.log("Sending remove track:", trackId);
      socket.emit("remove-track", { roomId, trackId });
    },

    sendUpdateTrackSound: (trackId, soundFile) => {
      const { socket, isInRoom, roomId } = get().websocket;
      if (!socket || !isInRoom) return;

      console.log("Sending track sound update:", trackId, soundFile);
      socket.emit("update-track-sound", { roomId, trackId, soundFile });
    },

    sendEffectChange: (trackId, effectType, parameter, value) => {
      const { socket, isInRoom, roomId } = get().websocket;
      if (!socket || !isInRoom) return;

      console.log("Sending effect change:", {
        trackId,
        effectType,
        parameter,
        value,
      });
      socket.emit("effect-change", {
        roomId,
        trackId,
        effectType,
        parameter,
        value,
      });
    },

    sendEffectReset: (trackId) => {
      const { socket, isInRoom, roomId } = get().websocket;
      if (!socket || !isInRoom) return;

      console.log("Sending effect reset:", trackId);
      socket.emit("effect-reset", { roomId, trackId });
    },

    cleanup: () => {
      const { socket } = get().websocket;
      if (socket) {
        console.log("Cleaning up socket connection");
        socket.close();
      }
      set((state) => ({
        websocket: {
          ...state.websocket,
          socket: null,
          isConnected: false,
          isInRoom: false,
          roomId: null,
          users: [],
          error: null,
          lastRemoteTransportCommand: null,
        },
      }));
    },
  },

  // ============================================================================
  // PATTERN CHANGE HANDLER (for WebSocket sync)
  // ============================================================================
  applyPatternChange: (change) => {
    // This method is kept for backward compatibility with any existing WebSocket events
    // that might still call it, but the actual logic is now in the websocket slice
    console.log(
      "applyPatternChange called - this should use websocket slice instead"
    );
  },

  // ============================================================================
  // EFFECTS SLICE
  // ============================================================================
  effects: {
    // Store effects state per track
    trackEffects: {},

    // Default effect settings
    getDefaultEffects: () => ({
      eq: {
        high: 0, // -12 to +12 dB
        mid: 0, // -12 to +12 dB
        low: 0, // -12 to +12 dB
      },
      filter: {
        frequency: 20000, // 100Hz to 20kHz
        Q: 1, // 0.1 to 30
      },
      compressor: {
        threshold: -24, // -60 to 0 dB
        ratio: 4, // 1 to 20
        attack: 0.01, // 0 to 0.1 seconds
        release: 0.1, // 0.01 to 1 seconds
      },
      chorus: {
        rate: 2, // 0.1 to 10 Hz
        depth: 0.3, // 0 to 1
        wet: 0, // 0 to 1 (0% to 100%)
      },
      vibrato: {
        rate: 5, // 0.1 to 20 Hz
        depth: 0.1, // 0 to 1
        wet: 0, // 0 to 1 (0% to 100%)
      },
      distortion: {
        amount: 0, // 0 to 1
        oversample: "2x", // '2x' or '4x'
      },
      pitchShift: {
        pitch: 0, // -12 to +12 semitones
        windowSize: 0.03, // 0.01 to 0.1 seconds
        wet: 0, // 0 to 1 (0% to 100%)
      },
      reverb: {
        roomSize: 0.3, // 0.1 to 0.9
        decay: 1.5, // 0.1s to 10s
        wet: 0, // 0 to 1 (0% to 100%)
      },
      delay: {
        delayTime: 0.25, // 0.01s to 1s
        feedback: 0.3, // 0 to 0.95 (0% to 95%)
        wet: 0, // 0 to 1 (0% to 100%)
      },
    }),

    // Initialize effects for a track
    initializeTrackEffects: (trackId) => {
      set((state) => {
        if (!state.effects.trackEffects[trackId]) {
          return {
            effects: {
              ...state.effects,
              trackEffects: {
                ...state.effects.trackEffects,
                [trackId]: state.effects.getDefaultEffects(),
              },
            },
          };
        }
        return state;
      });
    },

    // Update a specific effect parameter
    updateTrackEffect: (trackId, effectType, parameter, value) => {
      // Initialize if doesn't exist
      get().effects.initializeTrackEffects(trackId);

      set((state) => ({
        effects: {
          ...state.effects,
          trackEffects: {
            ...state.effects.trackEffects,
            [trackId]: {
              ...state.effects.trackEffects[trackId],
              [effectType]: {
                ...state.effects.trackEffects[trackId][effectType],
                [parameter]: value,
              },
            },
          },
        },
      }));

      // Send to WebSocket for collaboration
      get().websocket.sendEffectChange(trackId, effectType, parameter, value);
    },

    // Reset track effects to defaults
    resetTrackEffects: (trackId) => {
      set((state) => ({
        effects: {
          ...state.effects,
          trackEffects: {
            ...state.effects.trackEffects,
            [trackId]: state.effects.getDefaultEffects(),
          },
        },
      }));

      // Send reset to WebSocket
      get().websocket.sendEffectReset(trackId);
    },

    // Get effects for a specific track
    getTrackEffects: (trackId) => {
      const effects = get().effects.trackEffects[trackId];
      return effects || get().effects.getDefaultEffects();
    },

    // Remove track effects when track is deleted
    removeTrackEffects: (trackId) => {
      set((state) => {
        const newTrackEffects = { ...state.effects.trackEffects };
        delete newTrackEffects[trackId];
        return {
          effects: {
            ...state.effects,
            trackEffects: newTrackEffects,
          },
        };
      });
    },

    // Sync methods for WebSocket updates
    syncTrackEffect: (trackId, effectType, parameter, value) => {
      get().effects.initializeTrackEffects(trackId);

      set((state) => ({
        effects: {
          ...state.effects,
          trackEffects: {
            ...state.effects.trackEffects,
            [trackId]: {
              ...state.effects.trackEffects[trackId],
              [effectType]: {
                ...state.effects.trackEffects[trackId][effectType],
                [parameter]: value,
              },
            },
          },
        },
      }));
    },

    syncTrackEffectReset: (trackId) => {
      set((state) => ({
        effects: {
          ...state.effects,
          trackEffects: {
            ...state.effects.trackEffects,
            [trackId]: state.effects.getDefaultEffects(),
          },
        },
      }));
    },
  },
}));
