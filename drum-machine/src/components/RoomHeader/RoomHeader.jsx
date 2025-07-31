import React from "react";
import { LogOut } from "lucide-react";
import { useAppStore } from "../../stores";
import "./RoomHeader.css";

function RoomHeader() {
  // Get room info from WebSocket slice
  const roomId = useAppStore((state) => state.websocket.roomId);
  const users = useAppStore((state) => state.websocket.users);
  const leaveRoom = useAppStore((state) => state.websocket.leaveRoom);

  const handleLeaveRoom = () => {
    leaveRoom(); // This now handles both WebSocket and local state automatically
  };

  const userCount = users.length;

  return (
    <div className="floating-card room-header-card">
      <div className="room-header-content">
        <div className="title-section">
          <h1 className="room-title">Drum Machine</h1>
          <div className="room-info">Room: {roomId}</div>
        </div>
        <div className="user-count-badge">
          <div className="status-indicator"></div>
          <span>
            {userCount} user{userCount !== 1 ? "s" : ""} online
          </span>
        </div>
      </div>
    </div>
  );
}

export default RoomHeader;
