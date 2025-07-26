import React, { useState } from "react";
import "./RoomInterface.css";

function RoomInterface({ onCreateRoom, onJoinRoom, isConnected }) {
  const [joinRoomId, setJoinRoomId] = useState("");

  return (
    <div className="row justify-content-center">
      <div className="col-md-6">
        <div className="card room-card">
          <div className="card-header text-center room-header">
            <h2 className="room-title">Drum Machine</h2>
            <div className="mt-3">
              <span
                className={`badge connection-badge ${
                  isConnected ? "bg-success" : "bg-danger"
                }`}
              >
                <div className="status-indicator"></div>
                {isConnected ? "Connected" : "Disconnected"}
              </span>
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
                    Start a new collaborative session and invite friends to join
                  </p>
                </div>
              </div>
              <button
                className="btn btn-primary room-btn room-btn-primary"
                onClick={onCreateRoom}
                disabled={!isConnected}
              >
                Create Room
              </button>
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
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  onKeyPress={(e) =>
                    e.key === "Enter" && onJoinRoom(joinRoomId)
                  }
                />
                <button
                  className="btn btn-secondary room-btn room-btn-secondary"
                  onClick={() => onJoinRoom(joinRoomId)}
                  disabled={!isConnected || !joinRoomId.trim()}
                >
                  Join Room
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RoomInterface;
