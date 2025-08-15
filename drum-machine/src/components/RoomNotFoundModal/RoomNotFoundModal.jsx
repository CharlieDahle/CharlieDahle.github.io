// RoomNotFoundModal.jsx
import { AlertTriangle } from "lucide-react";
import "./RoomNotFoundModal.css";

function RoomNotFoundModal({ isOpen, onCreateNewRoom, onBackToSelection }) {
  if (!isOpen) return null;

  return (
    <div className="room-not-found-overlay">
      <div className="room-not-found-modal">
        <div className="room-not-found-header">
          <AlertTriangle size={48} className="warning-icon" />
          <h2 className="room-not-found-title">Room No Longer Exists</h2>
          <p className="room-not-found-message">
            The room you were connected to is no longer available. You can
            create a new room with your current pattern or return to room
            selection.
          </p>
        </div>

        <div className="room-not-found-actions">
          <button
            className="room-not-found-btn room-not-found-btn--primary"
            onClick={onCreateNewRoom}
          >
            Create New Room Based on Current Pattern
          </button>

          <button
            className="room-not-found-btn room-not-found-btn--secondary"
            onClick={onBackToSelection}
          >
            Back to Room Selection
          </button>
        </div>
      </div>
    </div>
  );
}

export default RoomNotFoundModal;
