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
  // Use all stores
  const {
    isConnected,
    isInRoom,
    roomId,
    users,
    error,
    lastRemoteTransportCommand,
    initializeConnection,
    setStoreReferences,
    createRoom,
    joinRoom,
    sendPatternChange,
    sendBpmChange,
    sendMeasureCountChange,
    sendAddTrack,
    sendRemoveTrack,
    sendUpdateTrackSound,
    sendTransportCommand,
    cleanup,
  } = useWebSocketStore();

  const { tracks, addTrack, removeTrack, updateTrackSound, setTracks } =
    useTrackStore();

  const { pattern, setPattern, removeTrackFromPattern } = usePatternStore();

  const {
    bpm,
    measureCount,
    isPlaying,
    currentTick,
    syncBpm,
    syncMeasureCount,
    TICKS_PER_BEAT,
    BEATS_PER_LOOP,
  } = useTransportStore();

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

  // Initialize WebSocket connection and set up store coordination
  useEffect(() => {
    const socket = initializeConnection();

    // Set up store references for coordination
    setStoreReferences(
      { getState: () => usePatternStore.getState() },
      { getState: () => useTransportStore.getState() },
      { getState: () => useTrackStore.getState() }
    );

    return () => {
      cleanup();
    };
  }, [initializeConnection, setStoreReferences, cleanup]);

  // Handlers that bridge components to WebSocket store
  const handlePatternChange = (change) => {
    // Pattern is already updated in local store by DrumMachine
    // Just send to server
    sendPatternChange(change);
  };

  const handleBpmChange = (newBpm) => {
    // BPM is already updated in local store by DrumMachine
    // Just send to server
    sendBpmChange(newBpm);
  };

  const handleMeasureCountChange = (newMeasureCount) => {
    // Measure count is already updated in local store by DrumMachine
    // Just send to server
    sendMeasureCountChange(newMeasureCount);
  };

  const handleTransportCommand = (command) => {
    // Transport state is already updated in local store by DrumMachine
    // Just send to server
    sendTransportCommand(command);
  };

  // Track management handlers
  const handleAddTrack = () => {
    const trackData = {
      name: `Track ${tracks.length + 1}`,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      soundFile: null,
      availableSounds: drumSounds.other,
    };

    const newTrack = addTrack(trackData);

    // Send the actual track data that was created (with ID)
    sendAddTrack(newTrack);
  };

  const handleRemoveTrack = (trackId) => {
    removeTrack(trackId);
    removeTrackFromPattern(trackId);

    // Send to server
    sendRemoveTrack(trackId);
  };

  const handleUpdateTrackSound = (trackId, newSoundFile) => {
    updateTrackSound(trackId, newSoundFile);

    // Send to server
    sendUpdateTrackSound(trackId, newSoundFile);
  };

  // Room management handlers
  const handleCreateRoom = async () => {
    try {
      const roomState = await createRoom();
      setPattern(roomState.pattern);
      syncBpm(roomState.bpm);
      if (roomState.measureCount) {
        syncMeasureCount(roomState.measureCount);
      }
      if (roomState.tracks) {
        setTracks(roomState.tracks);
      }
    } catch (error) {
      console.error("Failed to create room:", error);
    }
  };

  const handleJoinRoom = async (targetRoomId) => {
    try {
      const roomState = await joinRoom(targetRoomId);
      setPattern(roomState.pattern);
      syncBpm(roomState.bpm);
      if (roomState.measureCount) {
        syncMeasureCount(roomState.measureCount);
      }
      if (roomState.tracks) {
        setTracks(roomState.tracks);
      }
    } catch (error) {
      console.error("Failed to join room:", error);
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
            minHeight: "100vh",
          }}
        >
          <div
            className="container-fluid py-4"
            style={{ backgroundColor: "#f8f9fa", minHeight: "100vh" }}
          >
            {error && (
              <div className="alert alert-danger text-center" role="alert">
                {error}
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
          onPatternChange={handlePatternChange}
          onBpmChange={handleBpmChange}
          onMeasureCountChange={handleMeasureCountChange}
          onTransportCommand={handleTransportCommand}
          onAddTrack={handleAddTrack}
          onRemoveTrack={handleRemoveTrack}
          onUpdateTrackSound={handleUpdateTrackSound}
        />

        {/* Global Sound Selector Modal */}
        <SoundSelectorModal
          drumSounds={drumSounds}
          onSoundSelect={handleUpdateTrackSound}
        />
      </motion.div>
    </AnimatePresence>
  );
}

export default DrumMachineApp;
