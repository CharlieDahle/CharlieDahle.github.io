import React, { useState, useEffect } from "react";
import "./RoomInterface.css";

function RoomInterface({ onCreateRoom, onJoinRoom, isConnected, error }) {
  const [joinRoomId, setJoinRoomId] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [joinSuccess, setJoinSuccess] = useState("");
  const [createError, setCreateError] = useState("");
  const [joinError, setJoinError] = useState("");
  const [backgroundBlobs, setBackgroundBlobs] = useState([]);

  // Generate random background blobs on mount
  useEffect(() => {
    const generateBlobs = () => {
      const colors = [
        "#5bc0eb",
        "#fde74c",
        "#9bc53d",
        "#e55934",
        "#fa7921",
        "#ff97c4",
      ];

      const blobShapes = [
        `polygon(25% 3%, 16% 10%, 6% 18%, 2% 29%, 0% 46%, 0% 67%, 6% 79%, 16% 86%, 25% 93%, 38% 96%, 54% 96%, 69% 95%, 84% 89%, 97% 79%, 100% 62%, 100% 49%, 100% 33%, 97% 24%, 89% 18%, 79% 10%, 67% 8%, 54% 6%, 38% 3%)`,
        `polygon(28% 4%, 18% 11%, 8% 19%, 3% 31%, 1% 47%, 2% 69%, 8% 81%, 18% 87%, 28% 94%, 40% 97%, 55% 97%, 71% 95%, 85% 89%, 97% 80%, 100% 63%, 99% 50%, 98% 34%, 94% 25%, 86% 18%, 76% 11%, 64% 9%, 50% 7%, 35% 4%)`,
        `polygon(26% 2%, 16% 12%, 4% 18%, 0% 30%, 2% 46%, 1% 68%, 7% 80%, 17% 85%, 27% 92%, 39% 95%, 54% 95%, 70% 93%, 82% 87%, 95% 78%, 99% 61%, 98% 48%, 99% 32%, 95% 22%, 87% 16%, 77% 9%, 65% 7%, 52% 5%, 36% 2%)`,
        `polygon(24% 5%, 14% 9%, 5% 16%, 2% 28%, 0% 44%, 1% 66%, 5% 78%, 14% 87%, 24% 94%, 36% 98%, 52% 98%, 68% 96%, 84% 90%, 98% 81%, 100% 64%, 100% 51%, 100% 35%, 98% 26%, 91% 19%, 81% 12%, 69% 10%, 55% 8%, 39% 5%)`,
        `polygon(27% 1%, 17% 8%, 7% 15%, 3% 27%, 1% 43%, 0% 65%, 6% 77%, 16% 84%, 26% 91%, 38% 94%, 54% 94%, 70% 92%, 82% 86%, 94% 77%, 98% 60%, 98% 47%, 98% 31%, 94% 21%, 86% 14%, 76% 7%, 64% 5%, 51% 3%, 36% 1%)`,
        `polygon(26% 4%, 16% 11%, 7% 19%, 2% 31%, 0% 47%, 1% 69%, 8% 82%, 19% 88%, 30% 95%, 42% 98%, 58% 98%, 74% 96%, 87% 91%, 97% 82%, 100% 65%, 99% 52%, 98% 36%, 93% 27%, 84% 20%, 74% 13%, 61% 11%, 47% 9%, 33% 4%)`,
      ];

      const blobCount = Math.floor(Math.random() * 4) + 2;
      const blobs = [];
      const shuffledColors = [...colors].sort(() => Math.random() - 0.5);

      const cardArea = { top: 25, bottom: 75, left: 25, right: 75 };

      for (let i = 0; i < blobCount; i++) {
        let position;
        let attempts = 0;

        do {
          const size = Math.floor(Math.random() * 150) + 150;
          const sizePercent = (size / window.innerWidth) * 100;

          const zone = Math.floor(Math.random() * 4);
          let top, left;

          switch (zone) {
            case 0:
              top = Math.random() * (cardArea.top - 5) + 2;
              left = Math.random() * (90 - sizePercent) + 5;
              break;
            case 1:
              top = Math.random() * 60 + 15;
              left = Math.random() * (cardArea.left - 5) + 2;
              break;
            case 2:
              top = Math.random() * 60 + 15;
              left =
                Math.random() * (90 - cardArea.right - sizePercent) +
                cardArea.right +
                5;
              break;
            case 3:
              top =
                Math.random() * (90 - cardArea.bottom - sizePercent) +
                cardArea.bottom +
                5;
              left = Math.random() * (90 - sizePercent) + 5;
              break;
          }

          position = { top, left, size };
          attempts++;
        } while (isTooClose(position, blobs) && attempts < 50);

        const randomShape =
          blobShapes[Math.floor(Math.random() * blobShapes.length)];
        const uniqueColor = shuffledColors[i];

        blobs.push({
          id: i,
          ...position,
          color: uniqueColor,
          clipPath: randomShape,
          animationDelay: Math.random() * -20,
          animationDuration: 15 + Math.random() * 10,
        });
      }

      setBackgroundBlobs(blobs);
    };

    const isTooClose = (newPos, existingBlobs) => {
      const minDistance = 20;
      return existingBlobs.some((blob) => {
        const distance = Math.sqrt(
          Math.pow(newPos.top - blob.top, 2) +
            Math.pow(newPos.left - blob.left, 2)
        );
        return distance < minDistance;
      });
    };

    generateBlobs();
  }, []);

  const handleCreateRoom = async () => {
    setCreateError("");
    setCreateSuccess("");

    try {
      const result = await onCreateRoom();
      setCreateSuccess("Room created successfully!");
    } catch (err) {
      setCreateError("Failed to create room. Please try again.");
    }
  };

  const handleJoinRoom = async () => {
    setJoinError("");
    setJoinSuccess("");

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
      {/* Animated Background Blobs */}
      <div className="background-blobs">
        {backgroundBlobs.map((blob) => (
          <div
            key={blob.id}
            className="background-blob"
            style={{
              top: `${blob.top}%`,
              left: `${blob.left}%`,
              width: `${blob.size}px`,
              height: `${blob.size}px`,
              backgroundColor: blob.color,
              clipPath: blob.clipPath,
              animationDelay: `${blob.animationDelay}s`,
              animationDuration: `${blob.animationDuration}s`,
            }}
          />
        ))}
      </div>

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
              <h2 className="room-title">Drum Machine</h2>
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
