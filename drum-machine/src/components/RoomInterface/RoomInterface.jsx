import React, { useState } from "react";
import AnimatedBackground from "../AnimatedBackground/AnimatedBackground";
import "./RoomInterface.css";

// Define blob count range outside component to prevent recreating on every render
const ROOM_BLOB_COUNT = [2, 5];

function RoomInterface({ onCreateRoom, onJoinRoom, isConnected, error }) {
  const [joinRoomId, setJoinRoomId] = useState("");
  const [createError, setCreateError] = useState("");
  const [joinError, setJoinError] = useState("");

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

  return (
    <div className="room-interface">
      {/* Animated Background Blobs - Now using the reusable component */}
      <AnimatedBackground blobCount={ROOM_BLOB_COUNT} placement="room" />

      {/* Connection Status - Top Right of Screen */}
      <div
        className={`connection-status ${
          isConnected ? "connected" : "disconnected"
        }`}
      >
        <div className="status-indicator"></div>
        <span>{isConnected ? "Connected" : "Disconnected"}</span>
      </div>

      {/* Main Room Card */}
      <div className="room-layout">
        <div className="room-content">
          <div className="room-card">
            <div className="room-card__header">
              <img
                src="/yeezus2.png"
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
                    onKeyPress={(e) => e.key === "Enter" && handleJoinRoom()}
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
