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

      // Your beautiful ShapeStack blob shapes
      const blobShapes = [
        `polygon(25% 3%, 16% 10%, 6% 18%, 2% 29%, 0% 46%, 0% 67%, 6% 79%, 16% 86%, 25% 93%, 38% 96%, 54% 96%, 69% 95%, 84% 89%, 97% 79%, 100% 62%, 100% 49%, 100% 33%, 97% 24%, 89% 18%, 79% 10%, 67% 8%, 54% 6%, 38% 3%)`,
        `polygon(28% 4%, 18% 11%, 8% 19%, 3% 31%, 1% 47%, 2% 69%, 8% 81%, 18% 87%, 28% 94%, 40% 97%, 55% 97%, 71% 95%, 85% 89%, 97% 80%, 100% 63%, 99% 50%, 98% 34%, 94% 25%, 86% 18%, 76% 11%, 64% 9%, 50% 7%, 35% 4%)`,
        `polygon(26% 2%, 16% 12%, 4% 18%, 0% 30%, 2% 46%, 1% 68%, 7% 80%, 17% 85%, 27% 92%, 39% 95%, 54% 95%, 70% 93%, 82% 87%, 95% 78%, 99% 61%, 98% 48%, 99% 32%, 95% 22%, 87% 16%, 77% 9%, 65% 7%, 52% 5%, 36% 2%)`,
        `polygon(24% 5%, 14% 9%, 5% 16%, 2% 28%, 0% 44%, 1% 66%, 5% 78%, 14% 87%, 24% 94%, 36% 98%, 52% 98%, 68% 96%, 84% 90%, 98% 81%, 100% 64%, 100% 51%, 100% 35%, 98% 26%, 91% 19%, 81% 12%, 69% 10%, 55% 8%, 39% 5%)`,
        `polygon(27% 1%, 17% 8%, 7% 15%, 3% 27%, 1% 43%, 0% 65%, 6% 77%, 16% 84%, 26% 91%, 38% 94%, 54% 94%, 70% 92%, 82% 86%, 94% 77%, 98% 60%, 98% 47%, 98% 31%, 94% 21%, 86% 14%, 76% 7%, 64% 5%, 51% 3%, 36% 1%)`,
        `polygon(26% 4%, 16% 11%, 7% 19%, 2% 31%, 0% 47%, 1% 69%, 8% 82%, 19% 88%, 30% 95%, 42% 98%, 58% 98%, 74% 96%, 87% 91%, 97% 82%, 100% 65%, 99% 52%, 98% 36%, 93% 27%, 84% 20%, 74% 13%, 61% 11%, 47% 9%, 33% 4%)`,
      ];

      const blobCount = Math.floor(Math.random() * 4) + 2; // 2-5 blobs
      const blobs = [];

      // Shuffle colors to ensure no repeats
      const shuffledColors = [...colors].sort(() => Math.random() - 0.5);

      // Define card area to avoid (approximate center)
      const cardArea = { top: 25, bottom: 75, left: 25, right: 75 }; // percentages

      for (let i = 0; i < blobCount; i++) {
        let position;
        let attempts = 0;

        // Try to find a good position
        do {
          const size = Math.floor(Math.random() * 150) + 150; // 150-300px (was 150-400px)
          const sizePercent = (size / window.innerWidth) * 100;

          // Generate position in zones around the card
          const zone = Math.floor(Math.random() * 4); // 0=top, 1=left, 2=right, 3=bottom
          let top, left;

          switch (zone) {
            case 0: // Above card
              top = Math.random() * (cardArea.top - 5) + 2;
              left = Math.random() * (90 - sizePercent) + 5;
              break;
            case 1: // Left of card
              top = Math.random() * 60 + 15;
              left = Math.random() * (cardArea.left - 5) + 2;
              break;
            case 2: // Right of card
              top = Math.random() * 60 + 15;
              left =
                Math.random() * (90 - cardArea.right - sizePercent) +
                cardArea.right +
                5;
              break;
            case 3: // Below card
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

        // Pick random blob shape and use shuffled color (no repeats)
        const randomShape =
          blobShapes[Math.floor(Math.random() * blobShapes.length)];
        const uniqueColor = shuffledColors[i]; // Use shuffled color by index

        blobs.push({
          id: i,
          ...position,
          color: uniqueColor,
          clipPath: randomShape,
          animationDelay: Math.random() * -20, // Random start time
          animationDuration: 15 + Math.random() * 10, // 15-25s duration
        });
      }

      setBackgroundBlobs(blobs);
    };

    // Check if blobs are too close
    const isTooClose = (newPos, existingBlobs) => {
      const minDistance = 20; // Minimum distance in viewport %
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
    } catch (err) {
      console.log("RoomInterface: Join failed:", err);
      setJoinError("Room not found. Please check the code and try again.");
    }
  };

  const formatRoomCode = (value) => {
    return value.replace(/[^A-Za-z0-9]/g, "");
  };

  return (
    <div className="container-fluid">
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
        className={`connection-status-fixed ${
          isConnected ? "connected" : "disconnected"
        }`}
      >
        <div className="status-indicator"></div>
        <span>{isConnected ? "Connected" : "Disconnected"}</span>
      </div>

      {/* Main Room Card */}
      <div className="row justify-content-center">
        <div className="col-md-5">
          <div className="card room-card">
            <div className="card-header text-center room-header">
              <h2 className="room-title">Drum Machine</h2>
            </div>
            <div className="card-body room-body">
              {/* Create Room Section */}
              <div className="action-section">
                <div className="section-header">
                  <div className="section-icon create-icon">+</div>
                  <div>
                    <h3 className="section-title">Create New Room</h3>
                    <p className="section-description">
                      Start a new session and invite friends to join
                    </p>
                  </div>
                </div>
                <button
                  className="btn btn-primary room-btn room-btn-primary d-flex justify-content-center align-items-center"
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
                    className="btn btn-secondary room-btn room-btn-secondary d-flex justify-content-center align-items-center"
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RoomInterface;
