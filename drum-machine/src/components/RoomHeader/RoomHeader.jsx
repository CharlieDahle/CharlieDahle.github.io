import React from "react";
import { LogOut } from "lucide-react";
import "./RoomHeader.css";

function RoomHeader({ roomId, userCount }) {
  return (
    <div className="floating-card room-header-card">
      <div className="d-flex justify-content-between align-items-center">
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
