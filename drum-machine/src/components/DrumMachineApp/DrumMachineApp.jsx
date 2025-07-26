import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWebSocketStore } from "../../stores/useWebSocketStore";
import { useTrackStore } from "../../stores/useTrackStore";
import { usePatternStore } from "../../stores/usePatternStore";
import { useTransportStore } from "../../stores/useTransportStore";
import RoomInterface from "../RoomInterface/RoomInterface.jsx";
import DrumMachine from "../DrumMachine/DrumMachine.jsx";
import SoundSelectorModal from "../SoundSelectorModal/SoundSelectorModal.jsx";
import drumSounds from "../../assets/data/drum-sounds.json";

function DrumMachineApp() {
  // WebSocket store for connection and room management
  const {
    isConnected,
    isInRoom,
    roomId,
    users,
    error,
    lastRemoteTransportCommand,
    initializeConnection,
    createRoom,
    joinRoom,
    cleanup,
  } = useWebSocketStore();

  // Other stores for room sync
  const { setTracks } = useTrackStore();
  const { setPattern } = usePatternStore();
  const { syncBpm, syncMeasureCount } = useTransportStore();

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
    // Only handle the success case - let errors bubble up to RoomInterface
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
  };

  const handleJoinRoom = async (targetRoomId) => {
    // Only handle the success case - let errors bubble up to RoomInterface
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
            minHeight: "100vh",
          }}
        >
          <div className="container-fluid py-4">
            <RoomInterface
              onCreateRoom={handleCreateRoom}
              onJoinRoom={handleJoinRoom}
              isConnected={isConnected}
              error={error} // Pass error as prop instead of showing it above
            />
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Render the drum machine
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
        }}
      >
        <DrumMachine
          roomId={roomId}
          userCount={users.length}
          remoteTransportCommand={lastRemoteTransportCommand}
        />

        {/* Global Sound Selector Modal */}
        <SoundSelectorModal drumSounds={drumSounds} />
      </motion.div>
    </AnimatePresence>
  );
}

export default DrumMachineApp;
