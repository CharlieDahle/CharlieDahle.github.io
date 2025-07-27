import React from "react";

function RoomHeader({ roomId, userCount }) {
  return (
    <div className="floating-card p-4">
      <div className="d-flex justify-content-between align-items-center">
        <div>
          <h2 className="mb-1 fw-bold">Drum Machine</h2>
          <small className="text-muted">Room: {roomId}</small>
        </div>
        <div>
          <span className="badge bg-success me-2 fs-6">
            {userCount} user{userCount !== 1 ? "s" : ""} online
          </span>
          <span className="badge bg-success fs-6">Connected</span>
        </div>
      </div>
    </div>
  );
}

export default RoomHeader;
