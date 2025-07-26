import React, { useState } from "react";
import "./RoomInterface.css";

function RoomInterface({ onCreateRoom, onJoinRoom, isConnected, error }) {
  const [joinRoomId, setJoinRoomId] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [joinSuccess, setJoinSuccess] = useState("");
  const [createError, setCreateError] = useState("");
  const [joinError, setJoinError] = useState("");

  const handleCreateRoom = async () => {
    // Clear any existing messages
    setCreateError("");
    setCreateSuccess("");

    try {
      const result = await onCreateRoom();
      // Success message will be handled by the success of room creation
      setCreateSuccess("Room created successfully!");
    } catch (err) {
      setCreateError("Failed to create room. Please try again.");
    }
  };

  const handleJoinRoom = async () => {
    // Clear any existing messages
    setJoinError("");
    setJoinSuccess("");

    if (!joinRoomId.trim()) {
      setJoinError("Please enter a room code");
      return;
    }

    try {
      await onJoinRoom(joinRoomId);
      setJoinSuccess(`Joining room ${joinRoomId}...`);
    } catch (err) {
      setJoinError("Room not found. Please check the code and try again.");
    }
  };

  const formatRoomCode = (value) => {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  };

  return (
    <div className="container-fluid">
      {/* Global Error (from parent) */}
      {error && (
        <div className="alert alert-danger text-center mb-4" role="alert">
          {error}
        </div>
      )}

      {/* Main Room Card */}
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card room-card">
            <div className="card-header text-center room-header">
              <h2 className="room-title">Drum Machine</h2>
              <div className="mt-3">
                <div
                  className={`connection-status ${
                    isConnected ? "connected" : "disconnected"
                  }`}
                >
                  <div className="status-indicator"></div>
                  <span>{isConnected ? "Connected" : "Disconnected"}</span>
                </div>
              </div>
            </div>
            <div className="card-body room-body">
              {/* Create Room Section */}
              <div className="action-section">
                <div className="section-header">
                  <div className="section-icon create-icon">+</div>
                  <div>
                    <h3 className="section-title">Create New Room</h3>
                    <p className="section-description">
                      Start a new collaborative session and invite friends to
                      join
                    </p>
                  </div>
                </div>
                <button
                  className="btn btn-primary room-btn room-btn-primary"
                  onClick={handleCreateRoom}
                  disabled={!isConnected}
                >
                  Create Room
                </button>

                {/* Create Room Messages */}
                {createError && (
                  <div className="alert alert-danger mt-3 mb-0" role="alert">
                    <small>{createError}</small>
                  </div>
                )}
                {createSuccess && (
                  <div className="alert alert-success mt-3 mb-0" role="alert">
                    <small>{createSuccess}</small>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="section-divider">
                <span className="divider-text">or</span>
              </div>

              {/* Join Room Section */}
              <div className="action-section">
                <div className="section-header">
                  <div className="section-icon join-icon">→</div>
                  <div>
                    <h3 className="section-title">Join Existing Room</h3>
                    <p className="section-description">
                      Enter a room code to join an active session
                    </p>
                  </div>
                </div>
                <div className="join-form">
                  <input
                    type="text"
                    className="form-control room-input"
                    placeholder="Enter room code"
                    value={joinRoomId}
                    onChange={(e) =>
                      setJoinRoomId(formatRoomCode(e.target.value))
                    }
                    onKeyPress={(e) => e.key === "Enter" && handleJoinRoom()}
                    maxLength="8"
                  />
                  <button
                    className="btn btn-secondary room-btn room-btn-secondary"
                    onClick={handleJoinRoom}
                    disabled={!isConnected || !joinRoomId.trim()}
                  >
                    Join Room
                  </button>
                </div>

                {/* Join Room Messages */}
                {joinError && (
                  <div className="alert alert-danger mt-3 mb-0" role="alert">
                    <small>{joinError}</small>
                  </div>
                )}
                {joinSuccess && (
                  <div className="alert alert-success mt-3 mb-0" role="alert">
                    <small>{joinSuccess}</small>
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
