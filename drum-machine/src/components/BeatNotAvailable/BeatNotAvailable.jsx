// src/components/BeatNotAvailable/BeatNotAvailable.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, ArrowLeft, UserPlus } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import "./BeatNotAvailable.css";

function BeatNotAvailable({ beatId }) {
  const navigate = useNavigate();
  const requestEditAccess = useAppStore((state) => state.websocket.requestEditAccess);
  const isConnected = useAppStore((state) => state.websocket.isConnected);
  const [hasRequested, setHasRequested] = useState(false);

  const handleRequestAccess = () => {
    if (!beatId) {
      console.error('[BeatNotAvailable] No beatId provided');
      return;
    }
    if (!isConnected) {
      console.error('[BeatNotAvailable] Not connected to WebSocket');
      return;
    }
    console.log('[BeatNotAvailable] Requesting edit access for beat:', beatId);
    requestEditAccess(beatId); // Pass beatId as parameter
    setHasRequested(true);
  };

  return (
    <div className="beat-not-available">
      <div className="beat-not-available-content">
        <div className="icon-wrapper">
          <Lock size={64} />
        </div>
        <h1>Beat Not Available</h1>
        <p className="description">
          This beat is private and you don't have access to view it.
        </p>
        <p className="hint">
          Request access and the beat owner will be notified.
        </p>
        <div className="button-group">
          <button
            className="request-access-button"
            onClick={handleRequestAccess}
            disabled={hasRequested}
          >
            <UserPlus size={18} />
            {hasRequested ? "Request Sent" : "Request Access"}
          </button>
          <button
            className="back-button"
            onClick={() => navigate("/beats")}
          >
            <ArrowLeft size={18} />
            Back to Beats
          </button>
        </div>
      </div>
    </div>
  );
}

export default BeatNotAvailable;
