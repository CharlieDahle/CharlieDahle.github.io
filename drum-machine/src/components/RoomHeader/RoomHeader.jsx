import React from "react";
import { LogOut } from "lucide-react";

function RoomHeader({ roomId, userCount, onLeaveRoom }) {
  return (
    <div className="floating-card p-4">
      <div className="d-flex justify-content-between align-items-center">
        <div>
          <h2 className="mb-1 fw-bold">Drum Machine</h2>
          <small className="text-muted">Room: {roomId}</small>
        </div>
        <div className="d-flex align-items-center gap-3">
          <div>
            <span className="badge bg-success me-2 fs-6">
              {userCount} user{userCount !== 1 ? "s" : ""} online
            </span>
            <span className="badge bg-success fs-6">Connected</span>
          </div>
          <button
            className="btn btn-outline-danger btn-sm d-flex align-items-center gap-2"
            onClick={onLeaveRoom}
            title="Leave room and return to main menu"
          >
            <LogOut size={16} />
            Leave Room
          </button>
        </div>
      </div>
    </div>
  );
}

export default RoomHeader;
