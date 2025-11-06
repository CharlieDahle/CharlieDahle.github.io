// src/components/DrumMachineApp/DrumMachineApp.jsx - Updated without duplicate WebSocket init
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "../../stores/useAppStore";
import RoomInterface from "../RoomInterface/RoomInterface.jsx";
import DrumMachine from "../DrumMachine/DrumMachine.jsx";
import ListeningMode from "../ListeningMode/ListeningMode.jsx";
import SoundSelectorModal from "../SoundSelectorModal/SoundSelectorModal.jsx";
import EffectsModal from "../EffectsModal/EffectsModal.jsx";
import RoomNotFoundModal from "../RoomNotFoundModal/RoomNotFoundModal.jsx";
import AnimatedBackground from "../AnimatedBackground/AnimatedBackground.jsx";
import drumSounds from "../../assets/data/drum-sounds.json";

// Define these outside the component to prevent recreating arrays on every render
const DRUM_MACHINE_BLOB_COUNT = [4, 6];

function DrumMachineApp() {
  // URL parameters and navigation
  const { beatId: urlBeatId } = useParams(); // PHASE 2: renamed from roomId
  const navigate = useNavigate();

  // PHASE 3: Access mode state
  const [mode, setMode] = useState(null); // 'edit' | 'listening' | 'spectating' | null
  const [accessLevel, setAccessLevel] = useState(null); // 'owner' | 'collaborator' | 'spectator' | 'none'
  const [checkingAccess, setCheckingAccess] = useState(false);

  // Get WebSocket state and actions
  const isConnected = useAppStore((state) => state.websocket.isConnected);
  const isInSession = useAppStore((state) => state.websocket.isInSession); // PHASE 2: renamed from isInRoom
  const connectionState = useAppStore(
    (state) => state.websocket.connectionState
  );
  const error = useAppStore((state) => state.websocket.error);
  const beatId = useAppStore((state) => state.websocket.beatId); // PHASE 2: renamed from roomId
  const users = useAppStore((state) => state.websocket.users);
  const lastRemoteTransportCommand = useAppStore(
    (state) => state.websocket.lastRemoteTransportCommand
  );

  // PHASE 2 CHANGE: createRoom removed, beats created via API now
  const joinBeat = useAppStore((state) => state.websocket.joinBeat); // PHASE 2: renamed from joinRoom

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

  // PHASE 3: Check access level when beat ID changes
  useEffect(() => {
    const checkAccess = async () => {
      if (!urlBeatId) {
        setMode(null);
        setAccessLevel(null);
        return;
      }

      try {
        setCheckingAccess(true);
        const response = await fetch(`/api/beats/${urlBeatId}/access`);

        if (!response.ok) {
          if (response.status === 404) {
            setMode('error');
            setAccessLevel('none');
            return;
          }
          throw new Error('Failed to check access');
        }

        const data = await response.json();
        setAccessLevel(data.access);

        // Determine mode based on access level
        if (data.access === 'owner' || data.access === 'collaborator') {
          setMode('edit'); // Has edit permissions, will join session
        } else if (data.access === 'spectator') {
          // TODO Phase 4: Check if active session exists
          // For now, always show listening mode for spectators
          setMode('listening');
        } else {
          // Private beat, no access
          setMode('error');
        }
      } catch (err) {
        console.error('Error checking access:', err);
        setMode('error');
        setAccessLevel('none');
      } finally {
        setCheckingAccess(false);
      }
    };

    checkAccess();
  }, [urlBeatId]);

  // Sync beat session state with URL
  useEffect(() => {
    // Only auto-join if we're in edit mode
    if (mode !== 'edit') {
      return;
    }

    // If URL has a beat ID but we're not in that session, auto-join
    if (urlBeatId && beatId !== urlBeatId && isConnected && connectionState !== "connecting") {
      console.log(`Auto-joining beat from URL: ${urlBeatId}`);
      handleJoinBeat(urlBeatId).catch((err) => {
        console.error("Failed to auto-join beat from URL:", err);
        // Error will be handled by beat-not-found modal
      });
    }

    // If URL has no beat ID but we're in a session, leave it
    if (!urlBeatId && isInSession) {
      console.log("URL beat ID removed - leaving session");
      // Note: We don't need to call leaveBeat() on the WebSocket here
      // because the user already clicked "Leave" which did that.
      // We just need to clean up local state.
      useAppStore.setState((state) => ({
        websocket: {
          ...state.websocket,
          isInSession: false,
          beatId: null,
          users: [],
          connectionState: state.websocket.isConnected
            ? "connected"
            : "disconnected",
          error: null,
          lastRemoteTransportCommand: null,
        },
      }));
    }
  }, [urlBeatId, beatId, isInSession, isConnected, connectionState, mode]);

  // PHASE 2: Beat session management handlers
  // NOTE: Beat creation now happens via API in Beats.jsx or RoomInterface.jsx
  // This component only joins existing beat sessions

  const handleJoinBeat = async (targetBeatId) => {
    try {
      const beatData = await joinBeat(targetBeatId);
      // Sync all stores with beat data
      setPattern(beatData.pattern || beatData.pattern_data || {});
      syncBpm(beatData.bpm || 120);
      if (beatData.measureCount || beatData.measure_count) {
        syncMeasureCount(beatData.measureCount || beatData.measure_count);
      }
      if (beatData.tracks || beatData.tracks_config) {
        setTracks(beatData.tracks || beatData.tracks_config);
      }
      // Update URL to include beat ID (if not already there)
      if (urlBeatId !== targetBeatId) {
        navigate(`/DrumMachine/${targetBeatId}`);
      }
      return beatData;
    } catch (err) {
      // Let errors bubble up to RoomInterface
      throw err;
    }
  };

  // Handle beat not found modal actions
  const handleCreateNewBeatFromCurrent = async () => {
    // PHASE 2: This will be implemented in RoomInterface.jsx
    // For now, just navigate back to selection
    handleBackToSelection();
  };

  const handleBackToSelection = () => {
    // Don't cleanup the entire connection, just reset session state
    // This preserves the WebSocket connection for beat selection
    useAppStore.setState((state) => ({
      websocket: {
        ...state.websocket,
        isInSession: false,
        beatId: null,
        users: [],
        connectionState: state.websocket.isConnected
          ? "connected"
          : "disconnected",
        error: null,
        lastRemoteTransportCommand: null,
      },
    }));
    // Navigate back to beat selection (removes beat ID from URL)
    navigate('/DrumMachine');
  };

  // Check if we should show the beat not found modal
  const showBeatNotFoundModal =
    connectionState === "failed" && error === "beat-not-found";

  // Use URL as source of truth: if no beat ID in URL, show beat selection
  // This makes navigation instant and avoids the "double render" issue
  if (!urlBeatId) {
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
            onJoinBeat={handleJoinBeat}
            isConnected={isConnected}
            error={error}
          />
        </motion.div>
      </AnimatePresence>
    );
  }

  // PHASE 3: Show loading while checking access
  if (checkingAccess || mode === null) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#718096'
      }}>
        Checking access...
      </div>
    );
  }

  // PHASE 3: Show listening mode for spectators
  if (mode === 'listening') {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="listening-mode"
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
          <AnimatedBackground
            blobCount={DRUM_MACHINE_BLOB_COUNT}
            placement="edge"
          />
          <div style={{ position: "relative", zIndex: 1 }}>
            <ListeningMode beatId={urlBeatId} />
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Render the drum machine with animated background (edit mode)
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

          {/* Beat Not Found Modal */}
          <RoomNotFoundModal
            isOpen={showBeatNotFoundModal}
            onCreateNewRoom={handleCreateNewBeatFromCurrent}
            onBackToSelection={handleBackToSelection}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default DrumMachineApp;
