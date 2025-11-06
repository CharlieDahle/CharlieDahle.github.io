// src/components/BeatNotAvailable/BeatNotAvailable.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { Lock, ArrowLeft } from "lucide-react";
import "./BeatNotAvailable.css";

function BeatNotAvailable() {
  const navigate = useNavigate();

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
          If you believe you should have access, ask the beat owner to add you as a collaborator.
        </p>
        <button
          className="back-button"
          onClick={() => navigate("/beats")}
        >
          <ArrowLeft size={18} />
          Back to Beats
        </button>
      </div>
    </div>
  );
}

export default BeatNotAvailable;
