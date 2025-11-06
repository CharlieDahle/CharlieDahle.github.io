import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, LogOut, FileText, Home } from "lucide-react";
import AnimatedBackground from "../AnimatedBackground/AnimatedBackground";
import QuickRejoin from "../QuickRejoin/QuickRejoin";
import { useAppStore } from "../../stores";
import "./RoomInterface.css";

// Define blob count range outside component to prevent recreating on every render
const ROOM_BLOB_COUNT = [2, 5];

function RoomInterface({ onJoinBeat, isConnected, error }) { // PHASE 2: onCreateRoom removed, beats created via API
  const navigate = useNavigate();
  const [joinRoomId, setJoinRoomId] = useState("");
  const [createError, setCreateError] = useState("");
  const [joinError, setJoinError] = useState("");
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  // Get auth state from store
  const { isAuthenticated, user, logout, saveStateBeforeLogin } = useAppStore((state) => state.auth);

  const handleCreateBeat = async () => {
    // PHASE 2: Create beat via API, then navigate to its room_id
    setCreateError("");

    try {
      const getAuthHeaders = useAppStore.getState().auth.getAuthHeaders;

      // Create beat in database via API
      const response = await fetch('/api/beats', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Untitled Beat',
          patternData: {}, // Backend expects camelCase
          tracksConfig: [], // Will be initialized with defaults on backend
          bpm: 120,
          measureCount: 4
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create beat');
      }

      const data = await response.json();
      console.log("Created new beat:", data);

      // Navigate to beat's persistent room_id
      // DrumMachineApp will auto-join the beat session
      // Response format: { message: "...", beat: { roomId: "...", ... } }
      const beat = data.beat;
      const roomId = beat.roomId || beat.room_id;
      if (!roomId) {
        throw new Error('Beat created but missing room_id');
      }
      navigate(`/DrumMachine/${roomId}`);
    } catch (err) {
      console.error("Failed to create beat:", err);
      setCreateError("Failed to create beat. Please try again.");
    }
  };

  const handleJoinBeat = async () => {
    // PHASE 2: Simply navigate to beat ID, auto-join will happen in DrumMachineApp
    setJoinError("");

    if (!joinRoomId.trim()) {
      setJoinError("Please enter a beat code");
      return;
    }

    try {
      // Navigate to beat - DrumMachineApp will handle auto-join
      navigate(`/DrumMachine/${joinRoomId.trim()}`);
    } catch (err) {
      console.log("RoomInterface: Navigation failed:", err);
      setJoinError("Failed to join beat. Please try again.");
    }
  };

  const formatRoomCode = (value) => {
    return value.replace(/[^A-Za-z0-9]/g, "");
  };

  const handleProfileClick = () => {
    setShowProfileDropdown(!showProfileDropdown);
  };

  const handleNavigateToBeats = () => {
    setShowProfileDropdown(false);
    navigate("/beats");
  };

  const handleLogout = () => {
    setShowProfileDropdown(false);
    logout();
  };

  const handleSignInClick = () => {
    // Save current drum machine state before redirecting to login
    saveStateBeforeLogin();
    navigate("/login");
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showProfileDropdown &&
        !event.target.closest(".room-user-menu")
      ) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showProfileDropdown]);

  return (
    <div className="room-interface">
      {/* Animated Background Blobs - Now using the reusable component */}
      <AnimatedBackground blobCount={ROOM_BLOB_COUNT} placement="room" />

      {/* Home Button - Top Left */}
      <a
        href="/"
        className="room-home-btn"
        aria-label="Go to homepage"
      >
        <Home size={20} />
        <span>charliedahle.me</span>
      </a>

      {/* Quick Rejoin Tab - Bottom Left */}
      <QuickRejoin onJoinBeat={onJoinBeat} />

      {/* Status Badges - Top Right of Screen */}
      <div className="room-status-badges">
        {/* Connection Status */}
        <div
          className={`connection-status ${
            isConnected ? "connected" : "disconnected"
          }`}
        >
          <div className="status-indicator"></div>
          <span>{isConnected ? "Connected" : "Disconnected"}</span>
        </div>

        {/* User Badge */}
        {isAuthenticated ? (
          <div className="room-user-menu">
            <div
              className={`room-user-info ${
                showProfileDropdown ? "room-user-info--active" : ""
              }`}
              onClick={handleProfileClick}
            >
              <User size={16} />
              {user?.username}
            </div>
            {showProfileDropdown && (
              <div className="room-profile-dropdown">
                <button
                  className="room-dropdown-item"
                  onClick={handleNavigateToBeats}
                >
                  <FileText size={16} />
                  My Beats
                </button>
                <button
                  className="room-dropdown-item"
                  onClick={handleLogout}
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button className="room-signin-btn" onClick={handleSignInClick}>
            <User size={16} />
            Sign In
          </button>
        )}
      </div>

      {/* Main Room Card */}
      <div className="room-layout">
        <div className="room-content">
          <div className="room-card">
            <div className="room-card__header">
              <img
                src="/pablo.png"
                alt="Drum Machine"
                className="room-title-image"
              />
            </div>
            <div className="room-card__body">
              {/* Create Room Section */}
              <div className="action-section">
                <div className="action-header">
                  <div className="action-icon action-icon--create">+</div>
                  <div>
                    <h3 className="action-title">Create New Beat</h3>
                    <p className="action-description">
                      Start a new beat and collaborate in real-time
                    </p>
                  </div>
                </div>
                <button
                  className="room-btn room-btn--primary"
                  onClick={handleCreateBeat}
                  disabled={!isAuthenticated}
                >
                  Create Beat
                </button>

                {/* Create Room Messages */}
                {createError && (
                  <div className="message message--error">
                    <small>{createError}</small>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="section-divider">
                <span className="divider-text">or</span>
              </div>

              {/* Join Room Section */}
              <div className="action-section">
                <div className="action-header">
                  <div className="action-icon action-icon--join">→</div>
                  <div>
                    <h3 className="action-title">Join Existing Beat</h3>
                    <p className="action-description">
                      Enter a beat code to join a collaborative session
                    </p>
                  </div>
                </div>
                <div className="join-form">
                  <input
                    type="text"
                    className="room-input"
                    placeholder="Enter beat code"
                    value={joinRoomId}
                    onChange={(e) =>
                      setJoinRoomId(formatRoomCode(e.target.value))
                    }
                    onKeyDown={(e) => e.key === "Enter" && handleJoinBeat()}
                    maxLength="36"
                  />
                  <button
                    className="room-btn room-btn--secondary"
                    onClick={handleJoinBeat}
                    disabled={!joinRoomId.trim()}
                  >
                    Join Beat
                  </button>
                </div>

                {/* Join Room Messages */}
                {joinError && (
                  <div className="message message--error">
                    <small>{joinError}</small>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RoomInterface;
