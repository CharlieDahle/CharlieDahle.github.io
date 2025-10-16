// src/components/DrumMachineApp/DrumMachineApp.jsx - Updated without duplicate WebSocket init
import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "../../stores/useAppStore";
import RoomInterface from "../RoomInterface/RoomInterface.jsx";
import DrumMachine from "../DrumMachine/DrumMachine.jsx";
import SoundSelectorModal from "../SoundSelectorModal/SoundSelectorModal.jsx";
import EffectsModal from "../EffectsModal/EffectsModal.jsx";
import RoomNotFoundModal from "../RoomNotFoundModal/RoomNotFoundModal.jsx";
import AnimatedBackground from "../AnimatedBackground/AnimatedBackground.jsx";
import drumSounds from "../../assets/data/drum-sounds.json";

// Define these outside the component to prevent recreating arrays on every render
const DRUM_MACHINE_BLOB_COUNT = [4, 6];

function DrumMachineApp() {
  // URL parameters and navigation
  const { roomId: urlRoomId } = useParams();
  const navigate = useNavigate();

  // Get WebSocket state and actions
  const isConnected = useAppStore((state) => state.websocket.isConnected);
  const isInRoom = useAppStore((state) => state.websocket.isInRoom);
  const connectionState = useAppStore(
    (state) => state.websocket.connectionState
  );
  const error = useAppStore((state) => state.websocket.error);
  const roomId = useAppStore((state) => state.websocket.roomId);
  const users = useAppStore((state) => state.websocket.users);
  const lastRemoteTransportCommand = useAppStore(
    (state) => state.websocket.lastRemoteTransportCommand
  );

  const createRoom = useAppStore((state) => state.websocket.createRoom);
  const joinRoom = useAppStore((state) => state.websocket.joinRoom);

  // Get store setters for room sync
  const setTracks = useAppStore((state) => state.tracks?.setTracks);
  const setPattern = useAppStore((state) => state.pattern?.setPattern);
  const syncBpm = useAppStore((state) => state.transport?.syncBpm);
  const syncMeasureCount = useAppStore(
    (state) => state.transport?.syncMeasureCount
  );

  // Animation variants
  const pageVariants = {
    initial: {
      scale: 0.8,
      opacity: 0,
      y: 50,
    },
    in: {
      scale: 1,
      opacity: 1,
      y: 0,
    },
    out: {
      scale: 0.8,
      opacity: 0,
      y: -50,
    },
  };

  const pageTransition = {
    type: "spring",
    stiffness: 100,
    damping: 15,
    mass: 0.8,
  };

  // NOTE: WebSocket initialization is now handled in main.jsx AppInitializer
  // So we don't need to call initializeConnection() here anymore

  // Sync room state with URL
  useEffect(() => {
    // If URL has a room ID but we're not in that room, auto-join
    if (urlRoomId && roomId !== urlRoomId && isConnected && connectionState !== "connecting") {
      console.log(`Auto-joining room from URL: ${urlRoomId}`);
      handleJoinRoom(urlRoomId).catch((err) => {
        console.error("Failed to auto-join room from URL:", err);
        // Error will be handled by room-not-found modal
      });
    }

    // If URL has no room ID but we're in a room, leave it
    if (!urlRoomId && isInRoom) {
      console.log("URL room ID removed - leaving room");
      // Note: We don't need to call leaveRoom() on the WebSocket here
      // because the user already clicked "Leave Room" which did that.
      // We just need to clean up local state.
      useAppStore.setState((state) => ({
        websocket: {
          ...state.websocket,
          isInRoom: false,
          roomId: null,
          users: [],
          connectionState: state.websocket.isConnected
            ? "connected"
            : "disconnected",
          error: null,
          lastRemoteTransportCommand: null,
        },
      }));
    }
  }, [urlRoomId, roomId, isInRoom, isConnected, connectionState]);

  // Room management handlers
  const handleCreateRoom = async () => {
    try {
      const roomState = await createRoom();
      // Sync all stores with room state
      setPattern(roomState.pattern);
      syncBpm(roomState.bpm);
      if (roomState.measureCount) {
        syncMeasureCount(roomState.measureCount);
      }
      if (roomState.tracks) {
        setTracks(roomState.tracks);
      }
      // Update URL to include room ID
      navigate(`/DrumMachine/${roomState.id}`);
      return roomState;
    } catch (err) {
      // Let errors bubble up to RoomInterface
      throw err;
    }
  };

  const handleJoinRoom = async (targetRoomId) => {
    try {
      const roomState = await joinRoom(targetRoomId);
      // Sync all stores with room state
      setPattern(roomState.pattern);
      syncBpm(roomState.bpm);
      if (roomState.measureCount) {
        syncMeasureCount(roomState.measureCount);
      }
      if (roomState.tracks) {
        setTracks(roomState.tracks);
      }
      // Update URL to include room ID (if not already there)
      if (urlRoomId !== targetRoomId) {
        navigate(`/DrumMachine/${targetRoomId}`);
      }
      return roomState;
    } catch (err) {
      // Let errors bubble up to RoomInterface
      throw err;
    }
  };

  // Handle room not found modal actions
  const handleCreateNewRoomFromCurrent = async () => {
    try {
      // Capture current local state before creating room
      const currentPattern = useAppStore.getState().pattern.data;
      const currentBpm = useAppStore.getState().transport.bpm;
      const currentMeasureCount = useAppStore.getState().transport.measureCount;
      const currentTracks = useAppStore.getState().tracks.list;

      console.log("Preserving offline changes:", {
        pattern: currentPattern,
        bpm: currentBpm,
        measureCount: currentMeasureCount,
        tracks: currentTracks,
      });

      // Create new room (this will also update the URL)
      await handleCreateRoom();

      // Restore the local state AFTER room creation
      setPattern(currentPattern);
      syncBpm(currentBpm);
      syncMeasureCount(currentMeasureCount);
      setTracks(currentTracks);

      // Force connection state to connected since we just created a room
      useAppStore.setState((state) => ({
        websocket: {
          ...state.websocket,
          connectionState: "connected",
          error: null,
        },
      }));

      console.log("Restored offline changes to new room");
    } catch (err) {
      console.error("Failed to create new room:", err);
    }
  };

  const handleBackToSelection = () => {
    // Don't cleanup the entire connection, just reset room state
    // This preserves the WebSocket connection for room selection
    useAppStore.setState((state) => ({
      websocket: {
        ...state.websocket,
        isInRoom: false,
        roomId: null,
        users: [],
        connectionState: state.websocket.isConnected
          ? "connected"
          : "disconnected",
        error: null,
        lastRemoteTransportCommand: null,
      },
    }));
    // Navigate back to room selection (removes room ID from URL)
    navigate('/DrumMachine');
  };

  // Check if we should show the room not found modal
  const showRoomNotFoundModal =
    connectionState === "failed" && error === "room-not-found";

  // Use URL as source of truth: if no room ID in URL, show room selection
  // This makes navigation instant and avoids the "double render" issue
  if (!urlRoomId) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="room-interface"
          initial="initial"
          animate="in"
          exit="out"
          variants={pageVariants}
          transition={pageTransition}
          style={{
            width: "100%",
            height: "100vh",
          }}
        >
          <RoomInterface
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            isConnected={isConnected}
            error={error}
          />
        </motion.div>
      </AnimatePresence>
    );
  }

  // Render the drum machine with animated background
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="drum-machine"
        initial="initial"
        animate="in"
        exit="out"
        variants={pageVariants}
        transition={pageTransition}
        style={{
          width: "100%",
          minHeight: "100vh",
          position: "relative",
        }}
      >
        {/* Animated Background for drum machine - inside the animated container */}
        <AnimatedBackground
          blobCount={DRUM_MACHINE_BLOB_COUNT}
          placement="edge"
        />

        <div style={{ position: "relative", zIndex: 1 }}>
          <DrumMachine remoteTransportCommand={lastRemoteTransportCommand} />

          {/* Global Sound Selector Modal */}
          <SoundSelectorModal drumSounds={drumSounds} />
          <EffectsModal />

          {/* Room Not Found Modal */}
          <RoomNotFoundModal
            isOpen={showRoomNotFoundModal}
            onCreateNewRoom={handleCreateNewRoomFromCurrent}
            onBackToSelection={handleBackToSelection}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default DrumMachineApp;
