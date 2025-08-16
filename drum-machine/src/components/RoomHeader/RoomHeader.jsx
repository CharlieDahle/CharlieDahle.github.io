// src/components/RoomHeader/RoomHeader.jsx - Updated to render debug panel below PatternTimeline
import React, { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useAppStore } from "../../stores";
import "./RoomHeader.css";

function RoomHeader({ debugMode, setDebugMode }) {
  // Get room info from WebSocket slice
  const roomId = useAppStore((state) => state.websocket.roomId);
  const users = useAppStore((state) => state.websocket.users);
  const connectionState = useAppStore(
    (state) => state.websocket.connectionState
  );
  const leaveRoom = useAppStore((state) => state.websocket.leaveRoom);

  // Debug mode state - now managed by parent DrumMachine component
  const [clickCount, setClickCount] = useState(0);
  const [clickTimer, setClickTimer] = useState(null);

  const handleLeaveRoom = () => {
    leaveRoom();
  };

  // Secret debug mode trigger - click the logo 5 times quickly
  const handleTitleClick = () => {
    const newClickCount = clickCount + 1;
    setClickCount(newClickCount);

    // Clear any existing timer
    if (clickTimer) {
      clearTimeout(clickTimer);
    }

    // If we hit 5 clicks, activate debug mode
    if (newClickCount >= 5) {
      setDebugMode(true);
      setClickCount(0);
      console.log("🔧 Debug mode activated!");

      // Show a brief visual feedback
      const logoElement = document.querySelector(".room-title-logo");
      if (logoElement) {
        logoElement.style.filter = "hue-rotate(180deg)";
        setTimeout(() => {
          logoElement.style.filter = "";
        }, 500);
      }
      return;
    }

    // Reset click count after 2 seconds
    const timer = setTimeout(() => {
      setClickCount(0);
    }, 2000);
    setClickTimer(timer);
  };

  const userCount = users.length;

  // Determine badge content and styling based on connection state
  const getBadgeConfig = () => {
    switch (connectionState) {
      case "connected":
        return {
          className: "user-count-badge user-count-badge--connected",
          text: `${userCount} user${userCount !== 1 ? "s" : ""} online`,
          showIndicator: true,
        };
      case "syncing":
        return {
          className: "user-count-badge user-count-badge--syncing",
          text: "Syncing...",
          showIndicator: false,
        };
      case "disconnected":
        return {
          className: "user-count-badge user-count-badge--disconnected",
          text: "Disconnected",
          showIndicator: false,
        };
      case "failed":
        return {
          className: "user-count-badge user-count-badge--failed",
          text: "Connection Failed",
          showIndicator: false,
        };
      default:
        return {
          className: "user-count-badge user-count-badge--disconnected",
          text: "Connecting...",
          showIndicator: false,
        };
    }
  };

  const badgeConfig = getBadgeConfig();
  const isConnected = connectionState === "connected";

  return (
    // Just the room header card - debug panel now rendered in DrumMachine
    <div className="floating-card room-header-card">
      <div className="room-header-content">
        <div className="title-section">
          <div
            className="room-title-container"
            onClick={handleTitleClick}
            title={
              clickCount > 0 ? `Debug mode: ${clickCount}/5 clicks` : undefined
            }
          >
            <img
              src="/damn.png"
              alt="Drum Machine"
              className="room-title-logo"
            />
            {clickCount > 0 && (
              <span className="debug-counter">{clickCount}</span>
            )}
          </div>
          <div className="room-info">Room: {roomId}</div>
        </div>

        <div className="header-badges">
          <button
            className="leave-room-badge"
            onClick={handleLeaveRoom}
            disabled={!isConnected}
          >
            <ChevronLeft size={16} />
            <span>Leave Room</span>
          </button>

          <div className={badgeConfig.className}>
            {badgeConfig.showIndicator && (
              <div className="status-indicator"></div>
            )}
            <span>{badgeConfig.text}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RoomHeader;
