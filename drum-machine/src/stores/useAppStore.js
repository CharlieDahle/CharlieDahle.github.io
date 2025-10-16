import { create } from "zustand";
import io from "socket.io-client";
import drumSounds from "../assets/data/drum-sounds.json";
import { interceptWebSocketMessages, debugLog } from "./websocketInterceptor";
import { addRecentRoom } from "../utils/recentRooms";

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

// Helper function for throttling
const throttle = (func, limit) => {
  let lastFunc;
  let lastRan;
  return function (...args) {
    if (!lastRan) {
      func.apply(this, args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(() => {
        if ((Date.now() - lastRan) >= limit) {
          func.apply(this, args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
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

      // Mark as modified for beat tracking
      if (get().auth.isAuthenticated) {
        get().beats.markAsModified();
      }

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

      // Mark as modified for beat tracking
      if (get().auth.isAuthenticated) {
        get().beats.markAsModified();
      }

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

      // Mark as modified for beat tracking
      if (get().auth.isAuthenticated) {
        get().beats.markAsModified();
      }

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

      // Mark as modified for beat tracking
      if (get().auth.isAuthenticated) {
        get().beats.markAsModified();
      }

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

      // Mark as modified for beat tracking
      if (get().auth.isAuthenticated) {
        get().beats.markAsModified();
      }

      // Send to server
      get().websocket.sendPatternChange({
        type: "clear-track",
        trackId,
      });
    },

    clearAllTracks: () => {
      set((state) => ({ pattern: { ...state.pattern, data: {} } }));

      // Mark as modified for beat tracking
      if (get().auth.isAuthenticated) {
        get().beats.markAsModified();
      }
    },

    setPattern: (newPattern) => {
      const normalizedPattern = {};
      Object.keys(newPattern).forEach((trackId) => {
        normalizedPattern[trackId] = newPattern[trackId].map(normalizeNote);
      });
      set((state) => ({
        pattern: { ...state.pattern, data: normalizedPattern },
      }));

      // Don't mark as modified when loading from server or loading a beat
      // This method is used for those cases
    },

    removeTrackFromPattern: (trackId) => {
      set((state) => {
        const newData = { ...state.pattern.data };
        delete newData[trackId];
        return { pattern: { ...state.pattern, data: newData } };
      });

      // Mark as modified for beat tracking
      if (get().auth.isAuthenticated) {
        get().beats.markAsModified();
      }
    },

    // ... rest of pattern methods remain the same
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

    // Transport control actions (user-initiated)
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

    // BPM control (user-initiated - triggers change tracking)
    setBpm: (newBpm) => {
      const clampedBpm = Math.max(60, Math.min(300, newBpm));
      set((state) => ({ transport: { ...state.transport, bpm: clampedBpm } }));

      // Mark as modified for beat tracking
      if (get().auth.isAuthenticated) {
        get().beats.markAsModified();
      }

      get().websocket.sendBpmChange(clampedBpm);
    },

    // Measure control (user-initiated - triggers change tracking)
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

      // Mark as modified for beat tracking
      if (get().auth.isAuthenticated) {
        get().beats.markAsModified();
      }

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

      // Mark as modified for beat tracking
      if (get().auth.isAuthenticated) {
        get().beats.markAsModified();
      }

      get().websocket.sendMeasureCountChange(get().transport.measureCount);
    },

    // Direct setter (for internal use, loading beats, etc. - NO change tracking)
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

    // Sync methods (for WebSocket updates - these DON'T trigger change tracking)
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
        soundFile: (() => {
          // Find first kick sound from the flat array
          const kickSound = drumSounds.find(
            (sound) => sound.category === "kicks"
          );
          return kickSound ? kickSound.file : "kicks/Ac_K.wav"; // fallback
        })(),
        availableSounds: drumSounds.filter(
          (sound) => sound.category === "kicks"
        ),
        volume: 1.0,
      },
      {
        id: "snare",
        name: "Snare",
        color: "#f39c12",
        soundFile: (() => {
          const snareSound = drumSounds.find(
            (sound) => sound.category === "snares"
          );
          return snareSound ? snareSound.file : "snares/Box_Snr2.wav"; // fallback
        })(),
        availableSounds: drumSounds.filter(
          (sound) => sound.category === "snares"
        ),
        volume: 1.0,
      },
      {
        id: "hihat",
        name: "Hi-Hat",
        color: "#2ecc71",
        soundFile: (() => {
          const hihatSound = drumSounds.find(
            (sound) => sound.category === "hihats"
          );
          return hihatSound ? hihatSound.file : "hihats/Jls_H.wav"; // fallback
        })(),
        availableSounds: drumSounds.filter(
          (sound) => sound.category === "hihats"
        ),
        volume: 1.0,
      },
      {
        id: "openhat",
        name: "Open Hat",
        color: "#3498db",
        soundFile: (() => {
          const openhatSound = drumSounds.find(
            (sound) =>
              sound.category === "openhats" || sound.category === "cymbals"
          );
          return openhatSound ? openhatSound.file : "cymbals/CL_OHH1.wav"; // fallback
        })(),
        availableSounds: drumSounds.filter(
          (sound) =>
            sound.category === "openhats" || sound.category === "cymbals"
        ),
        volume: 1.0,
      },
    ],

    addTrack: (trackData) => {
      const newTrack = {
        id: `track_${Date.now()}`,
        name: trackData?.name || "New Track",
        color: trackData?.color || "#9b59b6",
        soundFile: trackData?.soundFile || null,
        availableSounds: trackData?.availableSounds || [],
        volume: trackData?.volume || 1.0,
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

      // Clean up effects
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

    updateTrackVolume: (trackId, volume) => {
      // Clamp volume between 0.0 and 1.0
      const clampedVolume = Math.max(0.0, Math.min(1.0, volume));

      set((state) => ({
        tracks: {
          ...state.tracks,
          list: state.tracks.list.map((track) =>
            track.id === trackId ? { ...track, volume: clampedVolume } : track
          ),
        },
      }));

      // Send to server
      get().websocket.sendUpdateTrackVolume(trackId, clampedVolume);
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

    syncUpdateTrackVolume: (trackId, volume) => {
      set((state) => ({
        tracks: {
          ...state.tracks,
          list: state.tracks.list.map((track) =>
            track.id === trackId ? { ...track, volume } : track
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
    effectsModalOpen: false,
    effectsModalTrack: null,
    volumePopupOpen: false,
    volumePopupTrack: null,
    volumePopupPosition: { x: 0, y: 0 },
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

    openVolumePopup: (track, position) => {
      set((state) => ({
        ui: {
          ...state.ui,
          volumePopupOpen: true,
          volumePopupTrack: track,
          volumePopupPosition: position,
        },
      }));
    },

    closeVolumePopup: () => {
      set((state) => ({
        ui: {
          ...state.ui,
          volumePopupOpen: false,
          volumePopupTrack: null,
          volumePopupPosition: { x: 0, y: 0 },
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
    connectionState: "disconnected", // 'connected', 'disconnected', 'syncing', 'failed'
    error: null,
    roomId: null,
    isInRoom: false,
    users: [],
    lastRemoteTransportCommand: null,

    // Reconnection state
    reconnectAttempts: 0,
    reconnectStartTime: null,
    reconnectTimer: null,
    maxReconnectTime: 5 * 60 * 1000, // 5 minutes

    initializeConnection: () => {
      console.log("Connecting to server...");
      const newSocket = io("https://api.charliedahle.me");

      // Connection events
      newSocket.on("connect", () => {
        console.log(`Connected to server, ID: ${newSocket.id}`);

        const { websocket } = get();
        const wasReconnecting = websocket.reconnectStartTime !== null;

        set((state) => ({
          websocket: {
            ...state.websocket,
            isConnected: true,
            error: null,
            connectionState: wasReconnecting ? "syncing" : "connected",
            reconnectAttempts: 0,
            reconnectStartTime: null,
          },
        }));

        // Clear any existing reconnect timer
        if (websocket.reconnectTimer) {
          clearTimeout(websocket.reconnectTimer);
        }

        // Activate debug interceptor if debug panel is available
        if (window.debugPanel) {
          interceptWebSocketMessages(newSocket);
          debugLog("in", "connect", `Connected with ID: ${newSocket.id}`);
        }

        // If we were reconnecting and still have a room, try to rejoin
        if (wasReconnecting && websocket.roomId) {
          console.log("Attempting to rejoin room after reconnection...");
          get().websocket.attemptRejoinRoom();
        }
      });

      newSocket.on("disconnect", () => {
        console.log("Disconnected from server");
        debugLog("in", "disconnect", "Server disconnected");
        set((state) => ({
          websocket: {
            ...state.websocket,
            isConnected: false,
            connectionState: "disconnected",
            error: "Disconnected from server",
            reconnectStartTime: Date.now(),
          },
        }));

        // Start reconnection attempts
        get().websocket.startReconnection();
      });

      newSocket.on("connect_error", (err) => {
        console.error("Connection error:", err.message);
        debugLog("in", "connect_error", err.message);
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
        debugLog("in", "user-joined", { userId, userCount });
        set((state) => ({
          websocket: {
            ...state.websocket,
            users: [...new Set([...state.websocket.users, userId])],
          },
        }));
      });

      newSocket.on("user-left", ({ userId, userCount }) => {
        console.log("User left:", userId);
        debugLog("in", "user-left", { userId, userCount });
        set((state) => ({
          websocket: {
            ...state.websocket,
            users: state.websocket.users.filter((id) => id !== userId),
          },
        }));
      });

      // Effect chain events
      newSocket.on("effect-chain-update", ({ trackId, enabledEffects }) => {
        console.log("Effect chain update received:", {
          trackId,
          enabledEffects,
        });
        debugLog("in", "effect-chain-update", { trackId, enabledEffects });
        get().effects.syncTrackEffectChain(trackId, enabledEffects);
      });

      newSocket.on("effect-reset", ({ trackId }) => {
        console.log("Effect reset received:", trackId);
        debugLog("in", "effect-reset", { trackId });
        get().effects.syncTrackEffectReset(trackId);
      });


      
      // NEW: Complete effect state application
      newSocket.on("effect-state-apply", ({ trackId, effectsState }) => {
        console.log("Effect state apply received:", { trackId, effectsState });
        debugLog("in", "effect-state-apply", { trackId, effectsState });
        
        // Sync the entire effect state for this track
        get().effects.syncTrackEffectState(trackId, effectsState);
      });

      // Pattern events - direct store updates
      newSocket.on("pattern-update", (change) => {
        console.log("Pattern update received:", change);
        debugLog("in", "pattern-update", change);
        const { pattern } = get();

        // Apply change directly to pattern slice
        switch (change.type) {
          case "add-note":
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
        debugLog("in", "transport-sync", command);
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
        debugLog("in", "bpm-change", { bpm: newBpm });
        get().transport.syncBpm(newBpm);
      });

      // Measure count events
      newSocket.on("measure-count-change", ({ measureCount }) => {
        console.log("Measure count changed to:", measureCount);
        debugLog("in", "measure-count-change", { measureCount });
        get().transport.syncMeasureCount(measureCount);
      });

      // Track events
      newSocket.on("track-added", ({ trackData }) => {
        console.log("Track added:", trackData);
        debugLog("in", "track-added", trackData);
        get().tracks.syncAddTrack(trackData);
      });

      newSocket.on("track-removed", ({ trackId }) => {
        console.log("Track removed:", trackId);
        debugLog("in", "track-removed", { trackId });
        get().tracks.syncRemoveTrack(trackId);
      });

      newSocket.on("track-sound-updated", ({ trackId, soundFile }) => {
        console.log("Track sound updated:", trackId, soundFile);
        debugLog("in", "track-sound-updated", { trackId, soundFile });
        get().tracks.syncUpdateTrackSound(trackId, soundFile);
      });

      newSocket.on("track-volume-updated", ({ trackId, volume }) => {
        console.log("Track volume updated:", trackId, volume);
        debugLog("in", "track-volume-updated", { trackId, volume });
        get().tracks.syncUpdateTrackVolume(trackId, volume);
      });

      set((state) => ({
        websocket: { ...state.websocket, socket: newSocket },
      }));

      return newSocket;
    },

    startReconnection: () => {
      const { websocket } = get();

      // Don't start if already failed or if we don't have a room to rejoin
      if (websocket.connectionState === "failed" || !websocket.roomId) {
        return;
      }

      const timeSinceStart = Date.now() - websocket.reconnectStartTime;

      // Check if we've exceeded max reconnect time
      if (timeSinceStart >= websocket.maxReconnectTime) {
        console.log("Reconnection timeout exceeded");
        debugLog("out", "reconnect-timeout", "Max reconnection time exceeded");
        set((state) => ({
          websocket: {
            ...state.websocket,
            connectionState: "failed",
            error: "Connection failed - unable to reconnect",
          },
        }));
        return;
      }

      // Calculate delay with exponential backoff (1s, 2s, 4s, 8s, max 30s)
      const baseDelay = 1000;
      const maxDelay = 30000;
      const delay = Math.min(
        baseDelay * Math.pow(2, websocket.reconnectAttempts),
        maxDelay
      );

      console.log(
        `Reconnection attempt ${websocket.reconnectAttempts + 1} in ${delay}ms`
      );
      debugLog("out", "reconnect-attempt", {
        attempt: websocket.reconnectAttempts + 1,
        delay,
      });

      const timer = setTimeout(() => {
        const { websocket } = get();

        // Double-check we should still be trying
        if (websocket.connectionState !== "disconnected") {
          return;
        }

        set((state) => ({
          websocket: {
            ...state.websocket,
            reconnectAttempts: state.websocket.reconnectAttempts + 1,
          },
        }));

        // Try to reconnect
        if (websocket.socket) {
          websocket.socket.connect();
        }

        // Schedule next attempt if this one fails
        setTimeout(() => {
          const { websocket } = get();
          if (websocket.connectionState === "disconnected") {
            get().websocket.startReconnection();
          }
        }, 5000); // Wait 5s to see if connection succeeds
      }, delay);

      set((state) => ({
        websocket: { ...state.websocket, reconnectTimer: timer },
      }));
    },

    attemptRejoinRoom: () => {
      const { websocket } = get();

      if (!websocket.socket || !websocket.roomId) {
        return;
      }

      console.log("Attempting to rejoin room:", websocket.roomId);
      debugLog("out", "rejoin-room-attempt", { roomId: websocket.roomId });

      websocket.socket.emit(
        "join-room",
        { roomId: websocket.roomId },
        (response) => {
          if (response && response.success) {
            console.log("Successfully rejoined room");
            debugLog("in", "rejoin-room-success", response);

            // Sync all state from server (server wins)
            get().websocket.syncFromServer(response.roomState);

            // Show syncing state for 5 seconds, then connected
            setTimeout(() => {
              set((state) => ({
                websocket: {
                  ...state.websocket,
                  connectionState: "connected",
                },
              }));
            }, 5000);
          } else {
            console.log("Room no longer exists");
            debugLog("in", "rejoin-room-failed", "Room not found");
            set((state) => ({
              websocket: {
                ...state.websocket,
                connectionState: "failed",
                error: "room-not-found",
              },
            }));
          }
        }
      );
    },

    syncFromServer: (roomState) => {
      console.log("Syncing state from server:", roomState);
      debugLog("in", "sync-from-server", roomState);

      // Update all local state with server state (server is authoritative)
      if (roomState.pattern) {
        get().pattern.setPattern(roomState.pattern);
      }
      if (roomState.bpm) {
        get().transport.syncBpm(roomState.bpm);
      }
      if (roomState.measureCount) {
        get().transport.syncMeasureCount(roomState.measureCount);
      }
      if (roomState.tracks) {
        get().tracks.setTracks(roomState.tracks);
      }
      if (roomState.users) {
        // Server's user list is authoritative - replace completely
        set((state) => ({
          websocket: {
            ...state.websocket,
            users: [...roomState.users], // Fresh copy from server
          },
        }));
      }
    },

    createRoom: () => {
      const { socket, isConnected } = get().websocket;
      if (!socket || !isConnected) {
        debugLog("out", "create-room-failed", "Not connected");
        return Promise.reject("Not connected");
      }

      return new Promise((resolve, reject) => {
        console.log("Creating room...");
        debugLog("out", "create-room", "Creating new room");

        socket.emit("create-room", (response) => {
          if (response.success) {
            console.log("Room created:", response.roomId);
            debugLog("in", "create-room-success", response);

            // Save to recent rooms
            addRecentRoom(response.roomId);

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
            debugLog("in", "create-room-failed", response.error);
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
        debugLog("out", "join-room-failed", "Invalid connection or room ID");
        return Promise.reject("Invalid connection or room ID");
      }

      return new Promise((resolve, reject) => {
        console.log("Joining room:", targetRoomId);
        debugLog("out", "join-room", { roomId: targetRoomId });

        const timeout = setTimeout(() => {
          debugLog("out", "join-room-timeout", "Request timed out");
          reject(new Error("Join room request timed out"));
        }, 10000);

        socket.emit(
          "join-room",
          { roomId: targetRoomId.trim() },
          (response) => {
            clearTimeout(timeout);

            if (response && response.success) {
              console.log("Successfully joined room:", targetRoomId);
              debugLog("in", "join-room-success", response);

              // Save to recent rooms
              addRecentRoom(targetRoomId.trim());

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
              debugLog("in", "join-room-failed", errorMsg);
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
      debugLog("out", "leave-room", { roomId });
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

    // Check if rooms still exist on server (for quick rejoin feature)
    checkRooms: (roomIds) => {
      const { socket, isConnected } = get().websocket;
      if (!socket || !isConnected || !roomIds || roomIds.length === 0) {
        return Promise.resolve([]);
      }

      return new Promise((resolve) => {
        console.log("Checking rooms:", roomIds);
        debugLog("out", "check-rooms", { roomIds });

        const timeout = setTimeout(() => {
          console.warn("Check rooms request timed out");
          resolve([]);
        }, 5000);

        socket.emit("check-rooms", { roomIds }, (response) => {
          clearTimeout(timeout);
          if (response && response.results) {
            debugLog("in", "check-rooms-success", response);
            resolve(response.results);
          } else {
            console.warn("Invalid check-rooms response");
            resolve([]);
          }
        });
      });
    },

    // Safe send methods - only send if connected
    sendPatternChange: (change) => {
      const { socket, connectionState, roomId } = get().websocket;
      if (!socket || connectionState !== "connected" || !roomId) {
        debugLog("out", "pattern-change-failed", "Not connected");
        console.log("Skipping pattern change - not connected");
        return;
      }

      const payload = { roomId, change };
      console.log("Sending pattern change:", change);
      debugLog("out", "pattern-change", payload);
      socket.emit("pattern-change", payload);
    },

    sendBpmChange: (newBpm) => {
      const { socket, connectionState, roomId } = get().websocket;
      if (!socket || connectionState !== "connected" || !roomId) {
        debugLog("out", "bpm-change-failed", "Not connected");
        console.log("Skipping BPM change - not connected");
        return;
      }

      const clampedBpm = Math.max(60, Math.min(300, newBpm));
      const payload = { roomId, bpm: clampedBpm };
      console.log("Sending BPM change:", clampedBpm);
      debugLog("out", "set-bpm", payload);
      socket.emit("set-bpm", payload);
    },

    sendMeasureCountChange: (measureCount) => {
      const { socket, connectionState, roomId } = get().websocket;
      if (!socket || connectionState !== "connected" || !roomId) {
        debugLog("out", "measure-count-failed", "Not connected");
        console.log("Skipping measure count change - not connected");
        return;
      }

      const payload = { roomId, measureCount };
      console.log("Sending measure count change:", measureCount);
      debugLog("out", "set-measure-count", payload);
      socket.emit("set-measure-count", payload);
    },

    sendTransportCommand: (command) => {
      const { socket, connectionState, roomId } = get().websocket;
      if (!socket || connectionState !== "connected" || !roomId) {
        debugLog("out", "transport-command-failed", "Not connected");
        console.log("Skipping transport command - not connected");
        return;
      }

      const payload = { roomId, command };
      console.log("Sending transport command:", command);
      debugLog("out", "transport-command", payload);
      socket.emit("transport-command", payload);
    },

    sendAddTrack: (trackData) => {
      const { socket, connectionState, roomId } = get().websocket;
      if (!socket || connectionState !== "connected" || !roomId) {
        debugLog("out", "add-track-failed", "Not connected");
        console.log("Skipping add track - not connected");
        return;
      }

      const payload = { roomId, trackData };
      console.log("Sending add track:", trackData);
      debugLog("out", "add-track", payload);
      socket.emit("add-track", payload);
    },

    sendRemoveTrack: (trackId) => {
      const { socket, connectionState, roomId } = get().websocket;
      if (!socket || connectionState !== "connected" || !roomId) {
        debugLog("out", "remove-track-failed", "Not connected");
        console.log("Skipping remove track - not connected");
        return;
      }

      const payload = { roomId, trackId };
      console.log("Sending remove track:", trackId);
      debugLog("out", "remove-track", payload);
      socket.emit("remove-track", payload);
    },

    sendUpdateTrackSound: (trackId, soundFile) => {
      const { socket, connectionState, roomId } = get().websocket;
      if (!socket || connectionState !== "connected" || !roomId) {
        debugLog("out", "track-sound-failed", "Not connected");
        console.log("Skipping track sound update - not connected");
        return;
      }

      const payload = { roomId, trackId, soundFile };
      console.log("Sending track sound update:", trackId, soundFile);
      debugLog("out", "update-track-sound", payload);
      socket.emit("update-track-sound", payload);
    },

    sendUpdateTrackVolume: (trackId, volume) => {
      const { socket, connectionState, roomId } = get().websocket;
      if (!socket || connectionState !== "connected" || !roomId) {
        debugLog("out", "track-volume-failed", "Not connected");
        console.log("Skipping track volume update - not connected");
        return;
      }

      const payload = { roomId, trackId, volume };
      console.log("Sending track volume update:", trackId, volume);
      debugLog("out", "update-track-volume", payload);
      socket.emit("update-track-volume", payload);
    },

    sendEffectChainUpdate: (trackId, enabledEffects) => {
      const { socket, connectionState, roomId } = get().websocket;
      if (!socket || connectionState !== "connected" || !roomId) {
        debugLog("out", "effect-chain-failed", "Not connected");
        console.log("Skipping effect chain update - not connected");
        return;
      }

      const payload = { roomId, trackId, enabledEffects };
      console.log("Sending effect chain update:", { trackId, enabledEffects });
      debugLog("out", "effect-chain-update", payload);
      socket.emit("effect-chain-update", payload);
    },


    sendEffectReset: (trackId) => {
      const { socket, connectionState, roomId } = get().websocket;
      if (!socket || connectionState !== "connected" || !roomId) {
        debugLog("out", "effect-reset-failed", "Not connected");
        console.log("Skipping effect reset - not connected");
        return;
      }

      const payload = { roomId, trackId };
      console.log("Sending effect reset:", trackId);
      debugLog("out", "effect-reset", payload);
      socket.emit("effect-reset", payload);
    },

    
    // NEW: Send complete effect state (for apply button)
    sendEffectStateApply: (trackId, effectsState) => {
      const { socket, connectionState, roomId } = get().websocket;
      if (!socket || connectionState !== "connected" || !roomId) {
        debugLog("out", "effect-state-apply-failed", "Not connected");
        console.log("Skipping effect state apply - not connected");
        return;
      }

      const payload = { roomId, trackId, effectsState };
      console.log("Sending effect state apply:", payload);
      debugLog("out", "effect-state-apply", payload);
      socket.emit("effect-state-apply", payload);
    },

    cleanup: () => {
      const { socket, reconnectTimer } = get().websocket;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }

      if (socket) {
        console.log("Cleaning up socket connection");
        debugLog("out", "cleanup", "Cleaning up WebSocket connection");
        socket.close();
      }

      set((state) => ({
        websocket: {
          ...state.websocket,
          socket: null,
          isConnected: false,
          connectionState: "disconnected",
          isInRoom: false,
          roomId: null,
          users: [],
          error: null,
          lastRemoteTransportCommand: null,
          reconnectAttempts: 0,
          reconnectStartTime: null,
          reconnectTimer: null,
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
  // AUTH SLICE - Add this to your store
  // ============================================================================
  auth: {
    isAuthenticated: false,
    user: null,
    token: null,
    isLoading: false,
    error: null,

    // Initialize auth state from localStorage on app start
    initializeAuth: () => {
      const token = localStorage.getItem("drum_machine_token");
      const userString = localStorage.getItem("drum_machine_user");

      if (token && userString) {
        try {
          const user = JSON.parse(userString);
          set((state) => ({
            auth: {
              ...state.auth,
              isAuthenticated: true,
              user,
              token,
            },
          }));
        } catch (error) {
          console.error("Failed to parse stored user data:", error);
          get().auth.logout(); // Clear invalid data
        }
      }
    },

    // Register new user
    register: async (username, password) => {
      set((state) => ({
        auth: { ...state.auth, isLoading: true, error: null },
      }));

      try {
        const response = await fetch(
          "https://api.charliedahle.me/api/auth/register",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ username, password }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Registration failed");
        }

        // Store auth data
        localStorage.setItem("drum_machine_token", data.token);
        localStorage.setItem("drum_machine_user", JSON.stringify(data.user));

        set((state) => ({
          auth: {
            ...state.auth,
            isAuthenticated: true,
            user: data.user,
            token: data.token,
            isLoading: false,
            error: null,
          },
        }));

        return data.user;
      } catch (error) {
        set((state) => ({
          auth: {
            ...state.auth,
            isLoading: false,
            error: error.message,
          },
        }));
        throw error;
      }
    },

    // Login existing user
    login: async (username, password) => {
      set((state) => ({
        auth: { ...state.auth, isLoading: true, error: null },
      }));

      try {
        const response = await fetch(
          "https://api.charliedahle.me/api/auth/login",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ username, password }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Login failed");
        }

        // Store auth data
        localStorage.setItem("drum_machine_token", data.token);
        localStorage.setItem("drum_machine_user", JSON.stringify(data.user));

        set((state) => ({
          auth: {
            ...state.auth,
            isAuthenticated: true,
            user: data.user,
            token: data.token,
            isLoading: false,
            error: null,
          },
        }));

        return data.user;
      } catch (error) {
        set((state) => ({
          auth: {
            ...state.auth,
            isLoading: false,
            error: error.message,
          },
        }));
        throw error;
      }
    },

    // Logout user
    logout: () => {
      localStorage.removeItem("drum_machine_token");
      localStorage.removeItem("drum_machine_user");
      // Also clear any pending state on logout
      localStorage.removeItem("drum_machine_pending_state");

      set((state) => ({
        auth: {
          ...state.auth,
          isAuthenticated: false,
          user: null,
          token: null,
          error: null,
        },
      }));
    },

    // Clear auth errors
    clearError: () => {
      set((state) => ({
        auth: { ...state.auth, error: null },
      }));
    },

    // Save current drum machine state before redirecting to login
    saveStateBeforeLogin: () => {
      const state = get();
      const drumMachineState = {
        pattern: state.pattern.data,
        tracks: state.tracks.list,
        bpm: state.transport.bpm,
        measureCount: state.transport.measureCount,
        effects: state.effects.trackEffects,
        timestamp: Date.now(), // Add timestamp for expiration
      };

      try {
        const stateString = JSON.stringify(drumMachineState);
        const sizeInKB = (new Blob([stateString]).size / 1024).toFixed(2);

        // Warn if state is getting large (> 500KB)
        if (sizeInKB > 500) {
          console.warn(`⚠️ Drum machine state is large (${sizeInKB}KB). Consider simplifying.`);
        }

        localStorage.setItem('drum_machine_pending_state', stateString);
        console.log(`💾 Saved drum machine state before login (${sizeInKB}KB)`);
      } catch (error) {
        // Handle QuotaExceededError
        if (error.name === 'QuotaExceededError') {
          console.error('❌ localStorage quota exceeded! Cannot save state.');
          alert('Unable to save your beat - storage is full. Please clear browser data or simplify your beat.');
        } else {
          console.error('Failed to save drum machine state:', error);
        }
      }
    },

    // Restore drum machine state after login
    restoreStateAfterLogin: () => {
      const savedStateString = localStorage.getItem('drum_machine_pending_state');

      if (!savedStateString) {
        return null;
      }

      try {
        const savedState = JSON.parse(savedStateString);

        // Check if state is expired (older than 1 hour)
        const ONE_HOUR = 60 * 60 * 1000;
        const isExpired = savedState.timestamp && (Date.now() - savedState.timestamp > ONE_HOUR);

        if (isExpired) {
          console.log('⏰ Saved state expired (>1 hour old), discarding');
          localStorage.removeItem('drum_machine_pending_state');
          return null;
        }

        console.log('🔄 Restoring drum machine state after login:', savedState);

        // Restore the state
        const state = get();
        state.pattern.setPattern(savedState.pattern);
        state.tracks.setTracks(savedState.tracks);
        state.transport.syncBpm(savedState.bpm);
        state.transport.syncMeasureCount(savedState.measureCount);

        // Restore effects for each track
        if (savedState.effects) {
          Object.entries(savedState.effects).forEach(([trackId, effects]) => {
            set((s) => ({
              effects: {
                ...s.effects,
                trackEffects: {
                  ...s.effects.trackEffects,
                  [trackId]: effects,
                },
              },
            }));
          });
        }

        // Clear the saved state
        localStorage.removeItem('drum_machine_pending_state');

        return savedState;
      } catch (error) {
        console.error('Failed to restore drum machine state:', error);
        localStorage.removeItem('drum_machine_pending_state');
        return null;
      }
    },

    // Helper to clear all app-related localStorage
    clearAllLocalStorage: () => {
      const keysToRemove = [
        'drum_machine_token',
        'drum_machine_user',
        'drum_machine_pending_state',
      ];

      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log('🗑️ Cleared all drum machine localStorage');
    },

    // Helper to check localStorage usage
    getLocalStorageStats: () => {
      const stats = {};
      let totalSize = 0;

      ['drum_machine_token', 'drum_machine_user', 'drum_machine_pending_state'].forEach(key => {
        const item = localStorage.getItem(key);
        if (item) {
          const sizeInKB = (new Blob([item]).size / 1024).toFixed(2);
          stats[key] = `${sizeInKB}KB`;
          totalSize += parseFloat(sizeInKB);
        } else {
          stats[key] = 'not set';
        }
      });

      stats.total = `${totalSize.toFixed(2)}KB`;
      console.table(stats);
      return stats;
    },

    // Helper to get auth headers for API calls
    getAuthHeaders: () => {
      const { token, isAuthenticated } = get().auth;

      console.log("🔐 Auth Debug:", {
        isAuthenticated,
        hasToken: !!token,
        tokenPreview: token ? `${token.substring(0, 10)}...` : "null",
      });

      const headers = token
        ? {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          }
        : {
            "Content-Type": "application/json",
          };

      console.log("🔐 Generated headers:", headers);
      return headers;
    },
  },

  // ============================================================================
  // BEATS SLICE
  // ============================================================================
  beats: {
    userBeats: [],
    isLoading: false,
    error: null,
    // NEW: Track the currently loaded beat
    currentlyLoadedBeat: null, // { id, name, lastModified }
    hasUnsavedChanges: false,

    // Fetch user's saved beats
    fetchUserBeats: async () => {
      const { isAuthenticated } = get().auth;
      if (!isAuthenticated) return;

      set((state) => ({
        beats: { ...state.beats, isLoading: true, error: null },
      }));

      try {
        const headers = get().auth.getAuthHeaders();
        const response = await fetch("https://api.charliedahle.me/api/beats", {
          headers,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch beats");
        }

        set((state) => ({
          beats: {
            ...state.beats,
            userBeats: data.beats,
            isLoading: false,
            error: null,
          },
        }));

        return data.beats;
      } catch (error) {
        set((state) => ({
          beats: {
            ...state.beats,
            isLoading: false,
            error: error.message,
          },
        }));
        throw error;
      }
    },

    // Save current beat (either new or update existing)
    saveBeat: async (beatName) => {
      const { isAuthenticated } = get().auth;
      if (!isAuthenticated) throw new Error("Must be logged in to save beats");

      const { currentlyLoadedBeat } = get().beats;
      const isUpdate = currentlyLoadedBeat && currentlyLoadedBeat.id;

      console.log("💾 Save Beat Debug:", {
        beatName,
        isUpdate,
        currentlyLoadedBeat,
        endpoint: isUpdate ? `beats/${currentlyLoadedBeat.id}` : "beats",
        method: isUpdate ? "PUT" : "POST",
      });

      // Get current pattern, tracks, bpm, and measures
      const { pattern, tracks, transport } = get();

      const beatData = {
        name: beatName,
        patternData: pattern.data,
        tracksConfig: tracks.list,
        bpm: transport.bpm,
        measureCount: transport.measureCount,
      };

      console.log("💾 Beat data to save:", beatData);

      set((state) => ({
        beats: { ...state.beats, isLoading: true, error: null },
      }));

      try {
        const headers = get().auth.getAuthHeaders();
        console.log("💾 Request headers:", headers);

        // Decide endpoint and method based on whether we're updating
        const url = isUpdate
          ? `https://api.charliedahle.me/api/beats/${currentlyLoadedBeat.id}`
          : "https://api.charliedahle.me/api/beats";

        const method = isUpdate ? "PUT" : "POST";

        console.log("💾 Making request:", { url, method });

        const response = await fetch(url, {
          method,
          headers,
          body: JSON.stringify(beatData),
        });

        console.log("💾 Response status:", response.status);
        console.log(
          "💾 Response headers:",
          Object.fromEntries(response.headers.entries())
        );

        // Check content type before parsing
        const contentType = response.headers.get("content-type");
        console.log("💾 Response content-type:", contentType);

        if (!contentType || !contentType.includes("application/json")) {
          // Server returned HTML or plain text instead of JSON
          const textResponse = await response.text();
          console.error("💾 Server returned non-JSON response:", textResponse);

          if (!response.ok) {
            throw new Error(
              `Server error (${response.status}): ${textResponse.slice(
                0,
                200
              )}...`
            );
          } else {
            throw new Error("Server returned unexpected response format");
          }
        }

        const data = await response.json();
        console.log("💾 Parsed response data:", data);

        if (!response.ok) {
          throw new Error(
            data.error || `Failed to ${isUpdate ? "update" : "save"} beat`
          );
        }

        // Update tracking
        set((state) => ({
          beats: {
            ...state.beats,
            isLoading: false,
            error: null,
            currentlyLoadedBeat: {
              id: data.beat.id,
              name: data.beat.name,
              lastModified: data.beat.updated_at || data.beat.created_at,
            },
            hasUnsavedChanges: false,
          },
        }));

        console.log("💾 Save successful, updated tracking:", {
          id: data.beat.id,
          name: data.beat.name,
          isUpdate,
        });

        // Refresh the beats list
        await get().beats.fetchUserBeats();

        return { beat: data.beat, isUpdate };
      } catch (error) {
        console.error("💾 Save failed:", error);

        set((state) => ({
          beats: {
            ...state.beats,
            isLoading: false,
            error: error.message,
          },
        }));
        throw error;
      }
    },

    // Load a specific beat
    loadBeat: async (beatId) => {
      const { isAuthenticated } = get().auth;
      if (!isAuthenticated) throw new Error("Must be logged in to load beats");

      set((state) => ({
        beats: { ...state.beats, isLoading: true, error: null },
      }));

      try {
        const headers = get().auth.getAuthHeaders();
        const response = await fetch(
          `https://api.charliedahle.me/api/beats/${beatId}`,
          {
            headers,
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load beat");
        }

        console.log("Beat data loaded from server:", {
          name: data.name,
          bpm: data.bpm,
          measureCount: data.measureCount,
          tracksCount: data.tracksConfig?.length || 0,
          patternKeys: Object.keys(data.patternData || {}).length,
        });

        // Apply the loaded beat to current state IMMEDIATELY
        const { pattern, tracks, transport } = get();

        // Set pattern data
        if (data.patternData) {
          pattern.setPattern(data.patternData);
          console.log("Pattern data applied to store");
        }

        // Set tracks configuration
        if (data.tracksConfig) {
          tracks.setTracks(data.tracksConfig);
          console.log("Tracks configuration applied to store");
        }

        // Set transport settings
        if (data.bpm) {
          transport.syncBpm(data.bpm);
          console.log("BPM applied to store:", data.bpm);
        }

        if (data.measureCount) {
          transport.syncMeasureCount(data.measureCount);
          console.log("Measure count applied to store:", data.measureCount);
        }

        // NEW: Track this as the currently loaded beat
        set((state) => ({
          beats: {
            ...state.beats,
            isLoading: false,
            error: null,
            currentlyLoadedBeat: {
              id: data.id,
              name: data.name,
              lastModified: data.updated_at || data.created_at,
            },
            hasUnsavedChanges: false, // Just loaded, so no unsaved changes
          },
        }));

        console.log("Beat loaded successfully and applied to store");
        return data;
      } catch (error) {
        console.error("Failed to load beat:", error);
        set((state) => ({
          beats: {
            ...state.beats,
            isLoading: false,
            error: error.message,
          },
        }));
        throw error;
      }
    },

    // NEW: Create a new beat (clears tracking)
    createNewBeat: () => {
      // Clear all patterns and reset to defaults
      const { pattern, tracks, transport } = get();

      pattern.clearAllTracks();
      transport.syncBpm(120);
      transport.syncMeasureCount(4);

      // Reset to default tracks
      tracks.setTracks([
        {
          id: "kick",
          name: "Kick",
          color: "#e74c3c",
          soundFile: "kicks/Ac_K.wav",
          availableSounds: [],
        },
        {
          id: "snare",
          name: "Snare",
          color: "#f39c12",
          soundFile: "snares/Box_Snr2.wav",
          availableSounds: [],
        },
        {
          id: "hihat",
          name: "Hi-Hat",
          color: "#2ecc71",
          soundFile: "hihats/Jls_H.wav",
          availableSounds: [],
        },
        {
          id: "openhat",
          name: "Open Hat",
          color: "#3498db",
          soundFile: "cymbals/CL_OHH1.wav",
          availableSounds: [],
        },
      ]);

      // Clear tracking
      set((state) => ({
        beats: {
          ...state.beats,
          currentlyLoadedBeat: null,
          hasUnsavedChanges: false,
        },
      }));
    },

    // NEW: Mark as having unsaved changes
    markAsModified: () => {
      set((state) => ({
        beats: {
          ...state.beats,
          hasUnsavedChanges: true,
        },
      }));
    },

    // NEW: Save as new beat (always creates new, even if one is loaded)
    saveAsNewBeat: async (beatName) => {
      const { isAuthenticated } = get().auth;
      if (!isAuthenticated) throw new Error("Must be logged in to save beats");

      console.log("💾 Save As New Beat Debug:", { beatName });

      // Get current pattern, tracks, bpm, and measures
      const { pattern, tracks, transport } = get();

      const beatData = {
        name: beatName,
        patternData: pattern.data,
        tracksConfig: tracks.list,
        bpm: transport.bpm,
        measureCount: transport.measureCount,
      };

      console.log("💾 New beat data to save:", beatData);

      set((state) => ({
        beats: { ...state.beats, isLoading: true, error: null },
      }));

      try {
        const headers = get().auth.getAuthHeaders();
        console.log("💾 Request headers:", headers);

        const url = "https://api.charliedahle.me/api/beats";
        console.log("💾 Making POST request to:", url);

        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(beatData),
        });

        console.log("💾 Response status:", response.status);
        console.log(
          "💾 Response headers:",
          Object.fromEntries(response.headers.entries())
        );

        // Check content type before parsing
        const contentType = response.headers.get("content-type");
        console.log("💾 Response content-type:", contentType);

        if (!contentType || !contentType.includes("application/json")) {
          // Server returned HTML or plain text instead of JSON
          const textResponse = await response.text();
          console.error("💾 Server returned non-JSON response:", textResponse);

          if (!response.ok) {
            throw new Error(
              `Server error (${response.status}): ${textResponse.slice(
                0,
                200
              )}...`
            );
          } else {
            throw new Error("Server returned unexpected response format");
          }
        }

        const data = await response.json();
        console.log("💾 Parsed response data:", data);

        if (!response.ok) {
          throw new Error(data.error || "Failed to save beat");
        }

        // Update tracking to the new beat
        set((state) => ({
          beats: {
            ...state.beats,
            isLoading: false,
            error: null,
            currentlyLoadedBeat: {
              id: data.beat.id,
              name: data.beat.name,
              lastModified: data.beat.created_at,
            },
            hasUnsavedChanges: false,
          },
        }));

        console.log("💾 Save as new successful, updated tracking:", {
          id: data.beat.id,
          name: data.beat.name,
        });

        // Refresh the beats list
        await get().beats.fetchUserBeats();

        return data.beat;
      } catch (error) {
        console.error("💾 Save as new failed:", error);

        set((state) => ({
          beats: {
            ...state.beats,
            isLoading: false,
            error: error.message,
          },
        }));
        throw error;
      }
    },

    // NEW: Get display info for the save button
    getSaveButtonInfo: () => {
      const { currentlyLoadedBeat, hasUnsavedChanges } = get().beats;

      if (!currentlyLoadedBeat) {
        // New beat that hasn't been saved yet
        return {
          text: "Save",
          isUpdate: false,
          showUnsavedIndicator: false,
          beatName: null,
        };
      }

      if (!hasUnsavedChanges) {
        // Beat is loaded and saved, no changes made yet
        return {
          text: `"${currentlyLoadedBeat.name}" Saved`,
          isUpdate: true,
          showUnsavedIndicator: false,
          beatName: currentlyLoadedBeat.name,
          hideButton: true, // NEW: Signal that button shouldn't show
        };
      }

      // Beat is loaded but has unsaved changes
      return {
        text: "Update",
        isUpdate: true,
        showUnsavedIndicator: true,
        beatName: currentlyLoadedBeat.name,
        hideButton: false,
      };
    },

    // Check if there's unsaved work that user should be warned about
    hasUnsavedWork: () => {
      const state = get();
      const { currentlyLoadedBeat, hasUnsavedChanges } = state.beats;
      const { pattern, tracks } = state;

      // If we have a loaded beat with unsaved changes, warn
      if (currentlyLoadedBeat && hasUnsavedChanges) {
        return true;
      }

      // If no beat is loaded, check if user has created any content
      if (!currentlyLoadedBeat) {
        // Check if there are any notes in the pattern
        const hasNotes = Object.keys(pattern.data).some(
          (trackId) => pattern.data[trackId] && pattern.data[trackId].length > 0
        );

        // Check if tracks have been modified from defaults
        const hasCustomTracks = tracks.list.length > 4 ||
          tracks.list.some((track) => {
            // Check if track has non-default properties
            return track.volume !== undefined && track.volume !== 1.0;
          });

        return hasNotes || hasCustomTracks;
      }

      return false;
    },

    // Also update the loadBeat method to ensure proper state reset:
    loadBeat: async (beatId) => {
      const { isAuthenticated } = get().auth;
      if (!isAuthenticated) throw new Error("Must be logged in to load beats");

      set((state) => ({
        beats: { ...state.beats, isLoading: true, error: null },
      }));

      try {
        const headers = get().auth.getAuthHeaders();
        const response = await fetch(
          `https://api.charliedahle.me/api/beats/${beatId}`,
          {
            headers,
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load beat");
        }

        console.log("Beat data loaded from server:", {
          name: data.name,
          bpm: data.bpm,
          measureCount: data.measureCount,
          tracksCount: data.tracksConfig?.length || 0,
          patternKeys: Object.keys(data.patternData || {}).length,
        });

        // Apply the loaded beat to current state IMMEDIATELY
        const { pattern, tracks, transport } = get();

        // Set pattern data
        if (data.patternData) {
          pattern.setPattern(data.patternData);
          console.log("Pattern data applied to store");
        }

        // Set tracks configuration
        if (data.tracksConfig) {
          tracks.setTracks(data.tracksConfig);
          console.log("Tracks configuration applied to store");
        }

        // Set transport settings
        if (data.bpm) {
          transport.syncBpm(data.bpm);
          console.log("BPM applied to store:", data.bpm);
        }

        if (data.measureCount) {
          transport.syncMeasureCount(data.measureCount);
          console.log("Measure count applied to store:", data.measureCount);
        }

        // Track this as the currently loaded beat with NO unsaved changes
        set((state) => ({
          beats: {
            ...state.beats,
            isLoading: false,
            error: null,
            currentlyLoadedBeat: {
              id: data.id,
              name: data.name,
              lastModified: data.updated_at || data.created_at,
            },
            hasUnsavedChanges: false, // IMPORTANT: Just loaded, so no unsaved changes
          },
        }));

        console.log("Beat loaded successfully and applied to store");
        return data;
      } catch (error) {
        console.error("Failed to load beat:", error);
        set((state) => ({
          beats: {
            ...state.beats,
            isLoading: false,
            error: error.message,
          },
        }));
        throw error;
      }
    },

    // Update saveBeat method to properly reset the unsaved changes flag:
    saveBeat: async (beatName) => {
      const { isAuthenticated } = get().auth;
      if (!isAuthenticated) throw new Error("Must be logged in to save beats");

      const { currentlyLoadedBeat } = get().beats;
      const isUpdate = currentlyLoadedBeat && currentlyLoadedBeat.id;

      console.log("💾 Save Beat Debug:", {
        beatName,
        isUpdate,
        currentlyLoadedBeat,
        endpoint: isUpdate ? `beats/${currentlyLoadedBeat.id}` : "beats",
        method: isUpdate ? "PUT" : "POST",
      });

      // Get current pattern, tracks, bpm, and measures
      const { pattern, tracks, transport } = get();

      const beatData = {
        name: beatName,
        patternData: pattern.data,
        tracksConfig: tracks.list,
        bpm: transport.bpm,
        measureCount: transport.measureCount,
      };

      console.log("💾 Beat data to save:", beatData);

      set((state) => ({
        beats: { ...state.beats, isLoading: true, error: null },
      }));

      try {
        const headers = get().auth.getAuthHeaders();
        console.log("💾 Request headers:", headers);

        // Decide endpoint and method based on whether we're updating
        const url = isUpdate
          ? `https://api.charliedahle.me/api/beats/${currentlyLoadedBeat.id}`
          : "https://api.charliedahle.me/api/beats";

        const method = isUpdate ? "PUT" : "POST";

        console.log("💾 Making request:", { url, method });

        const response = await fetch(url, {
          method,
          headers,
          body: JSON.stringify(beatData),
        });

        console.log("💾 Response status:", response.status);

        // Check content type before parsing
        const contentType = response.headers.get("content-type");
        console.log("💾 Response content-type:", contentType);

        if (!contentType || !contentType.includes("application/json")) {
          // Server returned HTML or plain text instead of JSON
          const textResponse = await response.text();
          console.error("💾 Server returned non-JSON response:", textResponse);

          if (!response.ok) {
            throw new Error(
              `Server error (${response.status}): ${textResponse.slice(
                0,
                200
              )}...`
            );
          } else {
            throw new Error("Server returned unexpected response format");
          }
        }

        const data = await response.json();
        console.log("💾 Parsed response data:", data);

        if (!response.ok) {
          throw new Error(
            data.error || `Failed to ${isUpdate ? "update" : "save"} beat`
          );
        }

        // Update tracking - IMPORTANT: Reset hasUnsavedChanges to false
        set((state) => ({
          beats: {
            ...state.beats,
            isLoading: false,
            error: null,
            currentlyLoadedBeat: {
              id: data.beat.id,
              name: data.beat.name,
              lastModified: data.beat.updated_at || data.beat.created_at,
            },
            hasUnsavedChanges: false, // RESET: Beat is now saved
          },
        }));

        console.log("💾 Save successful, updated tracking:", {
          id: data.beat.id,
          name: data.beat.name,
          isUpdate,
          hasUnsavedChanges: false,
        });

        // Refresh the beats list
        await get().beats.fetchUserBeats();

        return { beat: data.beat, isUpdate };
      } catch (error) {
        console.error("💾 Save failed:", error);

        set((state) => ({
          beats: {
            ...state.beats,
            isLoading: false,
            error: error.message,
          },
        }));
        throw error;
      }
    },

    // Clear beats errors
    clearError: () => {
      set((state) => ({
        beats: { ...state.beats, error: null },
      }));
    },
  },

  // ============================================================================
  // EFFECTS SLICE
  // ============================================================================
  effects: {
    // Store effects state per track
    trackEffects: {},
    // Track which effects are enabled/disabled (NEW)
    enabledEffects: {}, // { trackId: { effectType: boolean } }
    // Local pending changes before apply (NEW)
    pendingChanges: {}, // { trackId: { effectType: { param: value } } }
    
    // Effect presets organized by drum type
    presets: {
      kick: {
        tight: {
          name: "Tight",
          description: "Punchy and controlled",
          effects: {
            eq: { high: -3, mid: 2, low: 4 },
            compressor: { threshold: -20, ratio: 6, attack: 0.001, release: 0.05 },
            filter: { frequency: 15000, Q: 1 }
          }
        },
        punchy: {
          name: "Punchy",
          description: "Heavy and impactful",
          effects: {
            eq: { high: 0, mid: 4, low: 6 },
            compressor: { threshold: -18, ratio: 8, attack: 0.005, release: 0.08 },
            distortion: { amount: 0.1, oversample: "2x" }
          }
        },
        vintage: {
          name: "Vintage",
          description: "Warm analog character",
          effects: {
            eq: { high: -4, mid: 1, low: 3 },
            filter: { frequency: 8000, Q: 0.7 },
            distortion: { amount: 0.15, oversample: "2x" },
            chorus: { rate: 0.5, depth: 0.1, wet: 0.2 }
          }
        },
        sub: {
          name: "808",
          description: "Deep sub-bass",
          effects: {
            eq: { high: -6, mid: -2, low: 8 },
            compressor: { threshold: -16, ratio: 4, attack: 0.01, release: 0.15 },
            chorus: { rate: 1, depth: 0.2, wet: 0.3 }
          }
        }
      },
      snare: {
        crispy: {
          name: "Crispy",
          description: "Bright and cutting",
          effects: {
            eq: { high: 6, mid: 2, low: -2 },
            compressor: { threshold: -22, ratio: 5, attack: 0.002, release: 0.06 },
            reverb: { roomSize: 0.2, decay: 0.4, wet: 0.15 }
          }
        },
        fat: {
          name: "Fat",
          description: "Full and powerful",
          effects: {
            eq: { high: 1, mid: 4, low: 1 },
            compressor: { threshold: -18, ratio: 6, attack: 0.005, release: 0.1 },
            distortion: { amount: 0.08, oversample: "2x" }
          }
        },
        gated: {
          name: "Gated",
          description: "Tight and controlled",
          effects: {
            compressor: { threshold: -16, ratio: 10, attack: 0.001, release: 0.03 },
            filter: { frequency: 200, Q: 1.2 },
            eq: { high: 2, mid: 0, low: -4 }
          }
        },
        vintage: {
          name: "Vintage",
          description: "Classic analog warmth",
          effects: {
            eq: { high: -2, mid: -1, low: 0 },
            compressor: { threshold: -20, ratio: 4, attack: 0.01, release: 0.1 },
            distortion: { amount: 0.12, oversample: "2x" },
            filter: { frequency: 12000, Q: 0.8 }
          }
        }
      },
      hihat: {
        bright: {
          name: "Bright",
          description: "Sparkly and present",
          effects: {
            eq: { high: 4, mid: 1, low: -3 },
            compressor: { threshold: -25, ratio: 3, attack: 0.001, release: 0.04 },
            reverb: { roomSize: 0.15, decay: 0.3, wet: 0.1 }
          }
        },
        sizzle: {
          name: "Sizzle",
          description: "Aggressive high-end",
          effects: {
            eq: { high: 8, mid: 3, low: -4 },
            distortion: { amount: 0.06, oversample: "4x" },
            filter: { frequency: 18000, Q: 1.5 }
          }
        },
        tight: {
          name: "Tight",
          description: "Controlled and precise",
          effects: {
            compressor: { threshold: -20, ratio: 8, attack: 0.001, release: 0.02 },
            filter: { frequency: 400, Q: 1.0 },
            eq: { high: 0, mid: -2, low: -6 }
          }
        },
        spacey: {
          name: "Spacey",
          description: "Wide and atmospheric",
          effects: {
            chorus: { rate: 3, depth: 0.4, wet: 0.4 },
            reverb: { roomSize: 0.6, decay: 1.2, wet: 0.3 },
            eq: { high: 2, mid: 0, low: -2 }
          }
        }
      },
      openhat: {
        bright: {
          name: "Bright",
          description: "Sparkly and present",
          effects: {
            eq: { high: 4, mid: 1, low: -3 },
            compressor: { threshold: -25, ratio: 3, attack: 0.001, release: 0.04 },
            reverb: { roomSize: 0.15, decay: 0.3, wet: 0.1 }
          }
        },
        sizzle: {
          name: "Sizzle",
          description: "Aggressive high-end",
          effects: {
            eq: { high: 8, mid: 3, low: -4 },
            distortion: { amount: 0.06, oversample: "4x" },
            filter: { frequency: 18000, Q: 1.5 }
          }
        },
        washy: {
          name: "Washy",
          description: "Long and atmospheric",
          effects: {
            reverb: { roomSize: 0.7, decay: 2.5, wet: 0.4 },
            chorus: { rate: 1.5, depth: 0.3, wet: 0.25 },
            eq: { high: 1, mid: -1, low: -4 }
          }
        },
        vintage: {
          name: "Vintage",
          description: "Classic cymbal sound",
          effects: {
            eq: { high: -1, mid: 1, low: -2 },
            filter: { frequency: 14000, Q: 0.9 },
            distortion: { amount: 0.05, oversample: "2x" },
            reverb: { roomSize: 0.4, decay: 1.0, wet: 0.2 }
          }
        }
      }
    },

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

    // Check if an effect is enabled (has non-default values)
    isEffectEnabled: (effectType, settings) => {
      const defaults = get().effects.getDefaultEffects()[effectType];
      if (!defaults || !settings) return false;

      switch (effectType) {
        case "eq":
          return (
            settings.high !== 0 || settings.mid !== 0 || settings.low !== 0
          );
        case "filter":
          return settings.frequency !== 20000 || settings.Q !== 1;
        case "compressor":
          return (
            settings.threshold !== -24 ||
            settings.ratio !== 4 ||
            settings.attack !== 0.01 ||
            settings.release !== 0.1
          );
        case "chorus":
        case "vibrato":
        case "reverb":
        case "delay":
          return settings.wet > 0;
        case "distortion":
          return settings.amount > 0;
        case "pitchShift":
          return settings.wet > 0 || settings.pitch !== 0;
        default:
          return false;
      }
    },

    // Get enabled effects for a track (only non-default effects)
    getEnabledEffects: (trackId) => {
      const allEffects = get().effects.getTrackEffects(trackId);
      const enabledEffects = {};

      Object.keys(allEffects).forEach((effectType) => {
        if (get().effects.isEffectEnabled(effectType, allEffects[effectType])) {
          enabledEffects[effectType] = allEffects[effectType];
        }
      });

      return enabledEffects;
    },

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

    // Update a specific effect parameter (local only, real-time if enabled)
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
          // Track this as a pending change
          pendingChanges: {
            ...state.effects.pendingChanges,
            [trackId]: {
              ...state.effects.pendingChanges[trackId],
              [effectType]: {
                ...state.effects.pendingChanges[trackId]?.[effectType],
                [parameter]: value,
              },
            },
          },
        },
      }));

    },

    // Enable an effect with specific settings
    enableEffect: (trackId, effectType, settings) => {
      get().effects.initializeTrackEffects(trackId);

      set((state) => ({
        effects: {
          ...state.effects,
          trackEffects: {
            ...state.effects.trackEffects,
            [trackId]: {
              ...state.effects.trackEffects[trackId],
              [effectType]: { ...settings },
            },
          },
          // Mark this effect as enabled
          enabledEffects: {
            ...state.effects.enabledEffects,
            [trackId]: {
              ...state.effects.enabledEffects[trackId],
              [effectType]: true,
            },
          },
        },
      }));

      // Send enabled effects state
      const enabledEffects = get().effects.getEnabledEffects(trackId);
      get().websocket.sendEffectChainUpdate(trackId, enabledEffects);
    },

    // Disable a specific effect (reset to defaults)
    disableEffect: (trackId, effectType) => {
      get().effects.initializeTrackEffects(trackId);
      const defaults = get().effects.getDefaultEffects();

      set((state) => ({
        effects: {
          ...state.effects,
          trackEffects: {
            ...state.effects.trackEffects,
            [trackId]: {
              ...state.effects.trackEffects[trackId],
              [effectType]: { ...defaults[effectType] },
            },
          },
          // Mark this effect as disabled
          enabledEffects: {
            ...state.effects.enabledEffects,
            [trackId]: {
              ...state.effects.enabledEffects[trackId],
              [effectType]: false,
            },
          },
          // Clear pending changes for this effect
          pendingChanges: {
            ...state.effects.pendingChanges,
            [trackId]: {
              ...state.effects.pendingChanges[trackId],
              [effectType]: undefined,
            },
          },
        },
      }));

      // Send updated enabled effects state
      const enabledEffects = get().effects.getEnabledEffects(trackId);
      get().websocket.sendEffectChainUpdate(trackId, enabledEffects);
    },

    // Reset track effects to defaults (disables all effects)
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

      // Send empty enabled effects (all disabled)
      get().websocket.sendEffectChainUpdate(trackId, {});
    },

    // Set entire effect chain state (used for WebSocket sync)
    setTrackEffectChain: (trackId, enabledEffects) => {
      get().effects.initializeTrackEffects(trackId);
      const defaults = get().effects.getDefaultEffects();

      // Merge enabled effects with defaults
      const fullEffects = { ...defaults };
      Object.keys(enabledEffects).forEach((effectType) => {
        if (fullEffects[effectType]) {
          fullEffects[effectType] = { ...enabledEffects[effectType] };
        }
      });

      set((state) => ({
        effects: {
          ...state.effects,
          trackEffects: {
            ...state.effects.trackEffects,
            [trackId]: fullEffects,
          },
        },
      }));
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
        const newEnabledEffects = { ...state.effects.enabledEffects };
        const newPendingChanges = { ...state.effects.pendingChanges };
        
        delete newTrackEffects[trackId];
        delete newEnabledEffects[trackId];
        delete newPendingChanges[trackId];
        
        return {
          effects: {
            ...state.effects,
            trackEffects: newTrackEffects,
            enabledEffects: newEnabledEffects,
            pendingChanges: newPendingChanges,
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

    // Sync entire effect chain from WebSocket
    syncTrackEffectChain: (trackId, enabledEffects) => {
      console.log(`Syncing effect chain for ${trackId}:`, enabledEffects);
      get().effects.setTrackEffectChain(trackId, enabledEffects);
    },

    syncTrackEffectReset: (trackId) => {
      set((state) => ({
        effects: {
          ...state.effects,
          trackEffects: {
            ...state.effects.trackEffects,
            [trackId]: state.effects.getDefaultEffects(),
          },
          // Clear enabled effects tracking
          enabledEffects: {
            ...state.effects.enabledEffects,
            [trackId]: {},
          },
          // Clear pending changes
          pendingChanges: {
            ...state.effects.pendingChanges,
            [trackId]: {},
          },
        },
      }));
    },

    // NEW: Apply pending changes and broadcast to other clients
    applyEffectChanges: (trackId) => {
      const { pendingChanges } = get().effects;
      const trackPendingChanges = pendingChanges[trackId];
      
      if (!trackPendingChanges || Object.keys(trackPendingChanges).length === 0) {
        console.log(`No pending changes to apply for track ${trackId}`);
        return;
      }
      
      console.log(`Applying effect changes for track ${trackId}:`, trackPendingChanges);
      
      // Clear pending changes since we're applying them
      set((state) => ({
        effects: {
          ...state.effects,
          pendingChanges: {
            ...state.effects.pendingChanges,
            [trackId]: {},
          },
        },
      }));
      
      // Send the complete effect state to other clients (using new apply method)
      const completeEffectsState = get().effects.getTrackEffects(trackId);
      get().websocket.sendEffectStateApply(trackId, completeEffectsState);
      
      console.log(`✅ Applied and broadcast effect changes for track ${trackId}`);
    },
    
    // NEW: Reset a single effect to default values
    resetEffect: (trackId, effectType) => {
      console.log(`Resetting ${effectType} effect for track ${trackId}`);
      
      get().effects.disableEffect(trackId, effectType);
    },
    
    // NEW: Reset all effects for a track
    resetAllEffects: (trackId) => {
      console.log(`Resetting all effects for track ${trackId}`);
      
      get().effects.resetTrackEffects(trackId);
    },
    
    // NEW: Check if there are pending changes for a track
    hasPendingChanges: (trackId) => {
      const { pendingChanges } = get().effects;
      const trackPendingChanges = pendingChanges[trackId];
      
      if (!trackPendingChanges) return false;
      
      // Check if any effect has pending changes
      return Object.keys(trackPendingChanges).some(
        (effectType) => 
          trackPendingChanges[effectType] && 
          Object.keys(trackPendingChanges[effectType]).length > 0
      );
    },
    
    // NEW: Get pending changes for a specific effect
    getPendingChanges: (trackId, effectType = null) => {
      const { pendingChanges } = get().effects;
      const trackPendingChanges = pendingChanges[trackId] || {};
      
      if (effectType) {
        return trackPendingChanges[effectType] || {};
      }
      
      return trackPendingChanges;
    },
    
    // NEW: Clear pending changes without applying
    clearPendingChanges: (trackId, effectType = null) => {
      if (effectType) {
        // Clear specific effect's pending changes
        set((state) => ({
          effects: {
            ...state.effects,
            pendingChanges: {
              ...state.effects.pendingChanges,
              [trackId]: {
                ...state.effects.pendingChanges[trackId],
                [effectType]: {},
              },
            },
          },
        }));
      } else {
        // Clear all pending changes for the track
        set((state) => ({
          effects: {
            ...state.effects,
            pendingChanges: {
              ...state.effects.pendingChanges,
              [trackId]: {},
            },
          },
        }));
      }
    },
    
    // NEW: Sync complete effect state from remote (for apply button)
    syncTrackEffectState: (trackId, effectsState) => {
      console.log(`Syncing complete effect state for ${trackId}:`, effectsState);
      
      // Initialize if doesn't exist
      get().effects.initializeTrackEffects(trackId);
      
      // Update enabled effects tracking
      const newEnabledEffects = {};
      Object.keys(effectsState).forEach((effectType) => {
        newEnabledEffects[effectType] = get().effects.isEffectEnabled(
          effectType, 
          effectsState[effectType]
        );
      });
      
      set((state) => ({
        effects: {
          ...state.effects,
          trackEffects: {
            ...state.effects.trackEffects,
            [trackId]: { ...effectsState },
          },
          enabledEffects: {
            ...state.effects.enabledEffects,
            [trackId]: newEnabledEffects,
          },
          // Clear pending changes since we just got the authoritative state
          pendingChanges: {
            ...state.effects.pendingChanges,
            [trackId]: {},
          },
        },
      }));
    },

    // PRESET METHODS
    
    // Get available presets for a track type (kick, snare, hihat, openhat)
    getPresetsForTrackType: (trackType) => {
      const presets = get().effects.presets[trackType] || {};
      return Object.entries(presets).map(([key, preset]) => ({
        id: key,
        ...preset
      }));
    },

    // Apply a preset to a track
    applyPreset: (trackId, trackType, presetId) => {
      const presets = get().effects.presets[trackType];
      if (!presets || !presets[presetId]) {
        console.warn(`Preset ${presetId} not found for track type ${trackType}`);
        return;
      }

      const preset = presets[presetId];
      console.log(`Applying preset "${preset.name}" to track ${trackId}:`, preset.effects);

      // Initialize if doesn't exist
      get().effects.initializeTrackEffects(trackId);

      // Get current effects state
      const currentEffects = get().effects.getTrackEffects(trackId);
      
      // Merge preset effects with current effects (preset wins for specified parameters)
      const newEffects = { ...currentEffects };
      
      Object.entries(preset.effects).forEach(([effectType, effectParams]) => {
        if (newEffects[effectType]) {
          newEffects[effectType] = {
            ...newEffects[effectType],
            ...effectParams
          };
        }
      });

      // Apply the new effects state
      set((state) => ({
        effects: {
          ...state.effects,
          trackEffects: {
            ...state.effects.trackEffects,
            [trackId]: newEffects,
          },
          // Clear pending changes since we're applying a preset
          pendingChanges: {
            ...state.effects.pendingChanges,
            [trackId]: {},
          },
        },
      }));

      // Send the complete effect state to other clients
      get().websocket.sendEffectStateApply(trackId, newEffects);
      
      console.log(`✅ Applied preset "${preset.name}" to track ${trackId}`);
    },

    // Get sound category from sound file path
    getSoundCategoryFromPath: (soundFile) => {
      if (!soundFile) return null;
      
      // Extract category from file path (e.g., "kicks/kick01.wav" -> "kicks")
      const pathParts = soundFile.split('/');
      return pathParts.length > 1 ? pathParts[0] : null;
    },

    // Get display-friendly category name for UI
    getCategoryDisplayName: (trackId) => {
      const track = get().tracks.getTrackById(trackId);
      if (!track || !track.soundFile) return 'Track';
      
      const soundCategory = get().effects.getSoundCategoryFromPath(track.soundFile);
      
      // Map categories to display names
      switch (soundCategory) {
        case 'kicks': return 'Kick';
        case 'snares': return 'Snare';
        case 'hihats': return 'Hi-Hat';
        case 'openhats': return 'Open Hat';
        case 'cymbals': return 'Cymbal';
        case '808s': return '808';
        case 'claps': return 'Clap';
        case 'percs': return 'Percussion';
        case 'vox': return 'Vocal';
        default: return 'Track';
      }
    },

    // Get the track type for preset matching based on sound category
    getTrackTypeFromId: (trackId) => {
      const track = get().tracks.getTrackById(trackId);
      if (!track || !track.soundFile) return null;
      
      const soundCategory = get().effects.getSoundCategoryFromPath(track.soundFile);
      
      // Map sound categories to preset categories
      switch (soundCategory) {
        case 'kicks': return 'kick';
        case 'snares': return 'snare';
        case 'hihats': return 'hihat';
        case 'openhats':
        case 'cymbals': return 'openhat';
        default: return null; // No presets for this category
      }
    },

    // Get track number (1-based) from track ID
    getTrackNumber: (trackId) => {
      const tracks = get().tracks.list;
      const trackIndex = tracks.findIndex(track => track.id === trackId);
      return trackIndex + 1; // Convert to 1-based numbering
    },

    // Check if current track effects match a preset
    getCurrentPreset: (trackId) => {
      const trackType = get().effects.getTrackTypeFromId(trackId);
      const currentEffects = get().effects.getTrackEffects(trackId);
      const presets = get().effects.presets[trackType] || {};
      
      // Check each preset to see if it matches current settings
      for (const [presetId, preset] of Object.entries(presets)) {
        let isMatch = true;
        
        // Check if all preset parameters match current effects
        for (const [effectType, effectParams] of Object.entries(preset.effects)) {
          if (!currentEffects[effectType]) {
            isMatch = false;
            break;
          }
          
          for (const [param, value] of Object.entries(effectParams)) {
            if (Math.abs(currentEffects[effectType][param] - value) > 0.01) {
              isMatch = false;
              break;
            }
          }
          
          if (!isMatch) break;
        }
        
        if (isMatch) {
          return { id: presetId, ...preset };
        }
      }
      
      return null; // No matching preset
    },
  },
}));
