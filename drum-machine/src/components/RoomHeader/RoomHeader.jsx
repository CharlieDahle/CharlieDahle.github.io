import React from "react";
import { ChevronLeft } from "lucide-react";
import { useAppStore } from "../../stores";
import "./RoomHeader.css";

function RoomHeader() {
  // Get room info from WebSocket slice
  const roomId = useAppStore((state) => state.websocket.roomId);
  const users = useAppStore((state) => state.websocket.users);
  const connectionState = useAppStore(
    (state) => state.websocket.connectionState
  );
  const leaveRoom = useAppStore((state) => state.websocket.leaveRoom);

  const handleLeaveRoom = () => {
    leaveRoom(); // This now handles both WebSocket and local state automatically
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
    <div className="floating-card room-header-card">
      <div className="room-header-content">
        <div className="title-section">
          <h1 className="room-title">Drum Machine</h1>
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
