// src/components/DrumMachineApp/DrumMachineApp.jsx
import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDrumDataStore } from "../../stores/useDrumDataStore";
import { useUIStore } from "../../stores/useUIStore";
import RoomInterface from "../RoomInterface/RoomInterface.jsx";
import DrumMachine from "../DrumMachine/DrumMachine.jsx";
import SoundSelectorModal from "../SoundSelectorModal/SoundSelectorModal.jsx";
import drumSounds from "../../assets/data/drum-sounds.json";

function DrumMachineApp() {
  // ============ STORE SUBSCRIPTIONS ============

  // Connection and room state
  const {
    isConnected,
    isInRoom,
    roomId,
    users,
    error,
    connect,
    createRoom,
    joinRoom,
    disconnect,
  } = useDrumDataStore();

  // UI state for error handling
  const { setError: setUIError, clearError } = useUIStore();

  // ============ ANIMATION VARIANTS ============

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

  // ============ INITIALIZATION ============

  useEffect(() => {
    console.log("DrumMachineApp: Initializing connection");
    connect();

    // Cleanup on unmount
    return () => {
      console.log("DrumMachineApp: Cleaning up connection");
      disconnect();
    };
  }, [connect, disconnect]);

  // ============ ROOM MANAGEMENT HANDLERS ============

  const handleCreateRoom = async () => {
    try {
      console.log("DrumMachineApp: Creating room");
      clearError(); // Clear any previous errors

      const roomState = await createRoom();
      console.log("DrumMachineApp: Room created successfully", roomState);

      // Room state sync is handled automatically by the store
    } catch (error) {
      console.error("DrumMachineApp: Failed to create room:", error);
      setUIError("Failed to create room. Please try again.");
    }
  };

  const handleJoinRoom = async (targetRoomId) => {
    try {
      console.log("DrumMachineApp: Joining room", targetRoomId);
      clearError(); // Clear any previous errors

      const roomState = await joinRoom(targetRoomId);
      console.log("DrumMachineApp: Room joined successfully", roomState);

      // Room state sync is handled automatically by the store
    } catch (error) {
      console.error("DrumMachineApp: Failed to join room:", error);
      setUIError(
        `Failed to join room "${targetRoomId}". Please check the room ID and try again.`
      );
    }
  };

  // ============ RENDER HELPERS ============

  const renderRoomInterface = () => (
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
        <div
          className="container-fluid py-4"
          style={{ backgroundColor: "#f8f9fa", minHeight: "100vh" }}
        >
          {/* Connection Error Display */}
          {error && (
            <div className="row mb-3">
              <div className="col">
                <div className="alert alert-danger text-center" role="alert">
                  {error}
                </div>
              </div>
            </div>
          )}

          <RoomInterface
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            isConnected={isConnected}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );

  const renderDrumMachine = () => (
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
        <DrumMachine roomId={roomId} userCount={users.length} />

        {/* Global Sound Selector Modal */}
        <SoundSelectorModal drumSounds={drumSounds} />
      </motion.div>
    </AnimatePresence>
  );

  // ============ MAIN RENDER ============

  // Show room interface if not connected or not in room
  if (!isInRoom) {
    return renderRoomInterface();
  }

  // Show drum machine if connected and in room
  return renderDrumMachine();
}

export default DrumMachineApp;
