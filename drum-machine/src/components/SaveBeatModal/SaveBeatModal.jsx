// src/components/SaveBeatModal/SaveBeatModal.jsx - Fixed hooks order issue
import React, { useState, useEffect } from "react";
import { Save, X } from "lucide-react";
import { useAppStore } from "../../stores";
import "./SaveBeatModal.css";

function SaveBeatModal({ isOpen, onClose }) {
  const [beatName, setBeatName] = useState("");
  const [error, setError] = useState("");

  // ALWAYS call hooks in the same order - move these to the top
  const { isAuthenticated } = useAppStore((state) => state.auth);
  const { saveBeat, isLoading } = useAppStore((state) => state.beats);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setBeatName("");
      setError("");

      // Generate a default name with timestamp
      const now = new Date();
      const timestamp = now.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      setBeatName(`Beat ${timestamp}`);
    }
  }, [isOpen]);

  // Handle Escape key - always define this hook
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && !isLoading && isOpen) {
        onClose();
      }
    };

    // Only add listeners if modal is open
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, isLoading, onClose]);

  // Early return AFTER all hooks are called
  if (!isAuthenticated || !isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmedName = beatName.trim();
    if (!trimmedName) {
      setError("Please enter a name for your beat");
      return;
    }

    if (trimmedName.length > 100) {
      setError("Beat name must be less than 100 characters");
      return;
    }

    try {
      await saveBeat(trimmedName);
      onClose();

      // Show success message (you could add a toast notification here)
      console.log("Beat saved successfully!");
    } catch (err) {
      setError(err.message || "Failed to save beat");
    }
  };

  const handleCancel = () => {
    if (!isLoading) {
      onClose();
    }
  };

  return (
    <div
      className="save-beat-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <div className="save-beat-modal">
        <div className="save-beat-header">
          <div className="modal-title">
            <Save size={20} />
            Save Beat
          </div>
          <button
            className="close-btn"
            onClick={handleCancel}
            disabled={isLoading}
          >
            <X size={20} />
          </button>
        </div>

        <div className="save-beat-body">
          <div className="beat-info">
            <p className="info-text">
              Save your current beat to your personal library. You can load it
              anytime from your beats page.
            </p>
          </div>

          <div className="form-section">
            <label htmlFor="beatName" className="form-label">
              Beat Name
            </label>
            <input
              type="text"
              id="beatName"
              className="beat-name-input"
              value={beatName}
              onChange={(e) => setBeatName(e.target.value)}
              placeholder="Enter a name for your beat"
              maxLength={100}
              disabled={isLoading}
              autoFocus
            />
            <div className="char-count">{beatName.length}/100</div>
          </div>

          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="save-beat-footer">
          <button
            type="button"
            className="cancel-btn"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="save-btn"
            onClick={handleSubmit}
            disabled={isLoading || !beatName.trim()}
          >
            {isLoading ? (
              <>
                <span className="loading-spinner"></span>
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save Beat
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SaveBeatModal;
