// src/components/DrumMachineApp/DrumMachineApp.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "../../stores/useAppStore";
import RoomInterface from "../RoomInterface/RoomInterface.jsx";
import DrumMachine from "../DrumMachine/DrumMachine.jsx";
import ListeningMode from "../ListeningMode/ListeningMode.jsx";
import SpectatorBanner from "../SpectatorBanner/SpectatorBanner.jsx";
import QueueNotificationBadge from "../QueueNotificationBadge/QueueNotificationBadge.jsx";
import SessionQueueModal from "../SessionQueueModal/SessionQueueModal.jsx";
import AuthModal from "../AuthModal/AuthModal.jsx";
import GuestAuthPrompt from "../GuestAuthPrompt/GuestAuthPrompt.jsx";
import SoundSelectorModal from "../SoundSelectorModal/SoundSelectorModal.jsx";
import EffectsModal from "../EffectsModal/EffectsModal.jsx";
import RoomNotFoundModal from "../RoomNotFoundModal/RoomNotFoundModal.jsx";
import BeatNotAvailable from "../BeatNotAvailable/BeatNotAvailable.jsx";
import AnimatedBackground from "../AnimatedBackground/AnimatedBackground.jsx";
import drumSounds from "../../assets/data/drum-sounds.json";

// Define these outside the component to prevent recreating arrays on every render
const DRUM_MACHINE_BLOB_COUNT = [4, 6];

function DrumMachineApp() {
  // URL parameters and navigation
  const { beatId: urlBeatId } = useParams();
  const navigate = useNavigate();

  const [mode, setMode] = useState(null); // 'edit' | 'listening' | 'spectating' | null
  const [accessLevel, setAccessLevel] = useState(null); // 'owner' | 'collaborator' | 'spectator' | 'none'
  const [checkingAccess, setCheckingAccess] = useState(false);

  const [queueModalOpen, setQueueModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const isAuthenticated = useAppStore((state) => state.auth.isAuthenticated);
  const isGuestBeat = useAppStore((state) => state.beats.isGuestBeat);
  const guestBeatModified = useAppStore(
    (state) => state.beats.guestBeatModified,
  );
  const promoteGuestBeat = useAppStore((state) => state.beats.promoteGuestBeat);

  // Get WebSocket state and actions
  const isAuthInitialized = useAppStore(
    (state) => state.auth.isAuthInitialized,
  );
  const isConnected = useAppStore((state) => state.websocket.isConnected);
  const isInSession = useAppStore((state) => state.websocket.isInSession);
  const isSpectator = useAppStore((state) => state.websocket.isSpectator);
  const connectionState = useAppStore(
    (state) => state.websocket.connectionState,
  );
  const error = useAppStore((state) => state.websocket.error);
  const beatId = useAppStore((state) => state.websocket.beatId);
  const users = useAppStore((state) => state.websocket.users);
  const lastRemoteTransportCommand = useAppStore(
    (state) => state.websocket.lastRemoteTransportCommand,
  );

  const initializeConnection = useAppStore((state) => state.websocket.initializeConnection);
  const cleanup = useAppStore((state) => state.websocket.cleanup);
  const joinBeat = useAppStore((state) => state.websocket.joinBeat);
  const getAuthHeaders = useAppStore((state) => state.auth.getAuthHeaders);

  // Get store setters for room sync
  const setTracks = useAppStore((state) => state.tracks?.setTracks);
  const setPattern = useAppStore((state) => state.pattern?.setPattern);
  const syncBpm = useAppStore((state) => state.transport?.syncBpm);
  const syncMeasureCount = useAppStore(
    (state) => state.transport?.syncMeasureCount,
  );
  const syncTrackEffectState = useAppStore((state) => state.effects?.syncTrackEffectState);

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

  // Initialize WebSocket connection only when on the drum machine page
  useEffect(() => {
    initializeConnection();
    return () => cleanup();
  }, [initializeConnection, cleanup]);

  // Handle beforeunload for guest beats
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // Only prompt if guest has modified work
      if (!isAuthenticated && isGuestBeat && guestBeatModified) {
        e.preventDefault();
        e.returnValue = ""; // Chrome requires returnValue to be set
        return ""; // For older browsers
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isAuthenticated, isGuestBeat, guestBeatModified]);

  const handleAuthSuccess = () => {
    console.log("[DrumMachineApp] Auth successful, promoting guest beat");
    promoteGuestBeat();
    setAuthModalOpen(false);
  };

  // Check access level when beat ID changes
  useEffect(() => {
    const checkAccess = async () => {
      if (!urlBeatId) {
        setMode(null);
        setAccessLevel(null);
        return;
      }

      if (!isAuthInitialized) return;

      try {
        setCheckingAccess(true);
        // Add cache-busting to prevent 304 responses
        // Include auth headers so server knows who is requesting
        const authHeaders = getAuthHeaders(urlBeatId); // Pass beatId for guest token
        const response = await fetch(
          `https://api.charliedahle.me/api/beats/${urlBeatId}/access?t=${Date.now()}`,
          {
            headers: {
              ...authHeaders,
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
          },
        );

        if (!response.ok) {
          if (response.status === 404) {
            setMode("error");
            setAccessLevel("none");
            return;
          }
          throw new Error("Failed to check access");
        }

        const data = await response.json();
        setAccessLevel(data.access);
        console.log("[DrumMachineApp] Access check result:", data.access);

        // Determine mode based on access level
        if (data.access === "owner" || data.access === "collaborator") {
          console.log("[DrumMachineApp] Setting mode to EDIT");
          setMode("edit"); // Has edit permissions, will join session
        } else if (data.access === "spectator") {
          console.log(
            "[DrumMachineApp] Spectator access - defaulting to EDIT mode to join as spectator",
          );
          setMode("edit");
        } else {
          console.log("[DrumMachineApp] Setting mode to ERROR (no access)");
          setMode("error");
        }
      } catch (err) {
        console.error("Error checking access:", err);
        setMode("error");
        setAccessLevel("none");
      } finally {
        setCheckingAccess(false);
      }
    };

    checkAccess();
  }, [urlBeatId, isAuthInitialized]);

  useEffect(() => {
    if (isInSession && mode === "error") {
      console.log(
        "[DrumMachineApp] Session joined, switching from error to edit mode",
      );
      setMode("edit");
    }
  }, [isInSession, mode]);

  // Sync beat session state with URL
  useEffect(() => {
    console.log("[DrumMachineApp] Sync effect:", {
      mode,
      urlBeatId,
      beatId,
      isConnected,
      connectionState,
    });

    // Auto-join for editors (edit mode); spectators join as spectator via access check
    if (mode !== "edit") {
      console.log(
        "[DrumMachineApp] Not in edit mode, skipping auto-join. Mode:",
        mode,
      );
      return;
    }

    // If URL has a beat ID but we're not in that session, auto-join
    console.log("[DrumMachineApp] Auto-join check:", {
      urlBeatId,
      beatId,
      isConnected,
      connectionState,
      shouldJoin:
        urlBeatId &&
        beatId !== urlBeatId &&
        isConnected &&
        connectionState !== "connecting",
    });
    if (
      urlBeatId &&
      beatId !== urlBeatId &&
      isConnected &&
      connectionState !== "connecting"
    ) {
      // Join as spectator if user is not owner/collaborator
      const asSpectator = accessLevel === "spectator";
      console.log(
        `[DrumMachineApp] Auto-joining beat from URL: ${urlBeatId} (asSpectator: ${asSpectator})`,
      );
      handleJoinBeat(urlBeatId, asSpectator).catch((err) => {
        console.error("Failed to auto-join beat from URL:", err);
        // Error will be handled by beat-not-found modal
      });
    }

    // If URL has no beat ID but we're in a session, leave it
    if (!urlBeatId && isInSession) {
      console.log("URL beat ID removed - leaving session");
      // We don't call leaveBeat() here because the user already clicked "Leave"
      // which did that. We just need to clean up local state.
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
  }, [
    urlBeatId,
    beatId,
    isInSession,
    isConnected,
    connectionState,
    mode,
    accessLevel,
  ]);

  const handleJoinBeat = async (targetBeatId, asSpectator = false) => {
    try {
      const beatData = await joinBeat(targetBeatId, asSpectator);
      // Sync all stores with beat data
      setPattern(beatData.pattern || beatData.pattern_data || {});
      syncBpm(beatData.bpm || 120);
      if (beatData.measureCount || beatData.measure_count) {
        syncMeasureCount(beatData.measureCount || beatData.measure_count);
      }
      if (beatData.tracks || beatData.tracks_config) {
        setTracks(beatData.tracks || beatData.tracks_config);
      }
      // Apply effects state from room — syncTrackEffectState handles enabled computation internally
      if (beatData.trackEffects) {
        Object.keys(beatData.trackEffects).forEach((trackId) => {
          syncTrackEffectState?.(trackId, beatData.trackEffects[trackId]);
        });
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
    navigate("/DrumMachine");
  };

  // Check if we should show the beat not found modal
  const showBeatNotFoundModal =
    connectionState === "failed" && error === "beat-not-found";

  // Use URL as source of truth: if no beat ID in URL, show beat selection
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

  if (checkingAccess || mode === null) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontSize: "18px",
          color: "#718096",
        }}
      >
        Checking access...
      </div>
    );
  }

  // Show error screen for private beats or no access
  if (mode === "error") {
    return <BeatNotAvailable beatId={urlBeatId} />;
  }

  if (mode === "listening") {
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

  // Render the drum machine with animated background (edit mode OR spectator mode)
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
          {isSpectator && <SpectatorBanner />}

          {!isAuthenticated && isGuestBeat && guestBeatModified && (
            <GuestAuthPrompt onSignIn={() => setAuthModalOpen(true)} />
          )}

          {!isSpectator && isInSession && (
            <QueueNotificationBadge onClick={() => setQueueModalOpen(true)} />
          )}

          <SessionQueueModal
            isOpen={queueModalOpen}
            onClose={() => setQueueModalOpen(false)}
          />

          <AuthModal
            isOpen={authModalOpen}
            onClose={() => setAuthModalOpen(false)}
            onSuccess={handleAuthSuccess}
          />

          <DrumMachine
            remoteTransportCommand={lastRemoteTransportCommand}
          />

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
