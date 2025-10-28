import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, LogOut, FileText, Home } from "lucide-react";
import AnimatedBackground from "../AnimatedBackground/AnimatedBackground";
import QuickRejoin from "../QuickRejoin/QuickRejoin";
import { useAppStore } from "../../stores";
import "./RoomInterface.css";

// Define blob count range outside component to prevent recreating on every render
const ROOM_BLOB_COUNT = [2, 5];

function RoomInterface({ onCreateRoom, onJoinRoom, isConnected, error }) {
  const navigate = useNavigate();
  const [joinRoomId, setJoinRoomId] = useState("");
  const [createError, setCreateError] = useState("");
  const [joinError, setJoinError] = useState("");
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  // Get auth state from store
  const { isAuthenticated, user, logout, saveStateBeforeLogin } = useAppStore((state) => state.auth);

  const handleCreateRoom = async () => {
    setCreateError("");

    try {
      const result = await onCreateRoom();
    } catch (err) {
      setCreateError("Failed to create room. Please try again.");
    }
  };

  const handleJoinRoom = async () => {
    setJoinError("");

    if (!joinRoomId.trim()) {
      setJoinError("Please enter a room code");
      return;
    }

    try {
      await onJoinRoom(joinRoomId);
    } catch (err) {
      console.log("RoomInterface: Join failed:", err);
      setJoinError("Room not found. Please check the code and try again.");
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
      <QuickRejoin onJoinRoom={onJoinRoom} />

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
                    <h3 className="action-title">Create New Room</h3>
                    <p className="action-description">
                      Start a new session and invite friends to join
                    </p>
                  </div>
                </div>
                <button
                  className="room-btn room-btn--primary"
                  onClick={handleCreateRoom}
                  disabled={!isConnected}
                >
                  Create Room
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
                    <h3 className="action-title">Join Existing Room</h3>
                    <p className="action-description">
                      Enter a room code to join an active session
                    </p>
                  </div>
                </div>
                <div className="join-form">
                  <input
                    type="text"
                    className="room-input"
                    placeholder="Enter room code"
                    value={joinRoomId}
                    onChange={(e) =>
                      setJoinRoomId(formatRoomCode(e.target.value))
                    }
                    onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                    maxLength="8"
                  />
                  <button
                    className="room-btn room-btn--secondary"
                    onClick={handleJoinRoom}
                    disabled={!isConnected || !joinRoomId.trim()}
                  >
                    Join Room
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
