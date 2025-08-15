import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "../../stores/useAppStore";
import RoomInterface from "../RoomInterface/RoomInterface.jsx";
import DrumMachine from "../DrumMachine/DrumMachine.jsx";
import SoundSelectorModal from "../SoundSelectorModal/SoundSelectorModal.jsx";
import EffectsModal from "../EffectsModal/EffectsModal.jsx";
import AnimatedBackground from "../AnimatedBackground/AnimatedBackground.jsx";
import drumSounds from "../../assets/data/drum-sounds.json";

// Define these outside the component to prevent recreating arrays on every render
const DRUM_MACHINE_BLOB_COUNT = [4, 6];

function DrumMachineApp() {
  // Get WebSocket state and actions
  const isConnected = useAppStore((state) => state.websocket.isConnected);
  const isInRoom = useAppStore((state) => state.websocket.isInRoom);
  const roomId = useAppStore((state) => state.websocket.roomId);
  const users = useAppStore((state) => state.websocket.users);
  const error = useAppStore((state) => state.websocket.error);
  const lastRemoteTransportCommand = useAppStore(
    (state) => state.websocket.lastRemoteTransportCommand
  );

  const initializeConnection = useAppStore(
    (state) => state.websocket.initializeConnection
  );
  const createRoom = useAppStore((state) => state.websocket.createRoom);
  const joinRoom = useAppStore((state) => state.websocket.joinRoom);
  const cleanup = useAppStore((state) => state.websocket.cleanup);

  // Get store setters for room sync
  const setTracks = useAppStore((state) => state.tracks.setTracks);
  const setPattern = useAppStore((state) => state.pattern.setPattern);
  const syncBpm = useAppStore((state) => state.transport.syncBpm);
  const syncMeasureCount = useAppStore(
    (state) => state.transport.syncMeasureCount
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

  // Initialize WebSocket connection
  useEffect(() => {
    initializeConnection();

    return () => {
      cleanup();
    };
  }, [initializeConnection, cleanup]);

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
      return roomState;
    } catch (err) {
      // Let errors bubble up to RoomInterface
      throw err;
    }
  };

  // If not connected or not in room, show connection interface
  if (!isInRoom) {
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
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default DrumMachineApp;
