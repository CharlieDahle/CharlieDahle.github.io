// src/components/SaveBeatModal/SaveBeatModal.jsx - Enhanced version
import React, { useState, useEffect } from "react";
import { Save, X, Plus, Edit } from "lucide-react";
import { useAppStore } from "../../stores";
import "./SaveBeatModal.css";

function SaveBeatModal({ isOpen, onClose }) {
  const [beatName, setBeatName] = useState("");
  const [error, setError] = useState("");
  const [saveMode, setSaveMode] = useState("update"); // "update" or "new"

  // ALWAYS call hooks in the same order - move these to the top
  const { isAuthenticated } = useAppStore((state) => state.auth);
  const { saveBeat, saveAsNewBeat, isLoading, getSaveButtonInfo } = useAppStore(
    (state) => state.beats
  );

  // Get info about currently loaded beat
  const saveButtonInfo = getSaveButtonInfo();

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setError("");

      // If there's a loaded beat, default to update mode
      if (saveButtonInfo.isUpdate) {
        setSaveMode("update");
        setBeatName(saveButtonInfo.beatName);
      } else {
        setSaveMode("new");
        // Generate a default name with timestamp for new beats
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
    }
  }, [isOpen, saveButtonInfo.isUpdate, saveButtonInfo.beatName]);

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
      let result;
      if (saveMode === "update" && saveButtonInfo.isUpdate) {
        result = await saveBeat(trimmedName);
        console.log(
          result.isUpdate
            ? "Beat updated successfully!"
            : "Beat saved successfully!"
        );
      } else {
        result = await saveAsNewBeat(trimmedName);
        console.log("New beat saved successfully!");
      }

      onClose();
    } catch (err) {
      setError(err.message || "Failed to save beat");
    }
  };

  const handleCancel = () => {
    if (!isLoading) {
      onClose();
    }
  };

  const handleModeChange = (newMode) => {
    setSaveMode(newMode);

    if (newMode === "new") {
      // Generate new default name
      const now = new Date();
      const timestamp = now.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      setBeatName(`Beat ${timestamp}`);
    } else if (newMode === "update" && saveButtonInfo.isUpdate) {
      // Restore original beat name
      setBeatName(saveButtonInfo.beatName);
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
              {saveButtonInfo.isUpdate
                ? `You have "${saveButtonInfo.beatName}" loaded. Choose to update it or save as a new beat.`
                : "Save your current beat to your personal library. You can load it anytime from your beats page."}
            </p>
          </div>

          {/* Mode Selection - only show if there's a loaded beat */}
          {saveButtonInfo.isUpdate && (
            <div className="save-mode-selection">
              <div className="mode-buttons">
                <button
                  type="button"
                  className={`mode-btn ${
                    saveMode === "update" ? "active" : ""
                  }`}
                  onClick={() => handleModeChange("update")}
                  disabled={isLoading}
                >
                  <Edit size={16} />
                  Update Existing
                </button>
                <button
                  type="button"
                  className={`mode-btn ${saveMode === "new" ? "active" : ""}`}
                  onClick={() => handleModeChange("new")}
                  disabled={isLoading}
                >
                  <Plus size={16} />
                  Save as New
                </button>
              </div>
            </div>
          )}

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
                {saveMode === "update" && saveButtonInfo.isUpdate
                  ? "Updating..."
                  : "Saving..."}
              </>
            ) : (
              <>
                {saveMode === "update" && saveButtonInfo.isUpdate ? (
                  <>
                    <Edit size={16} />
                    Update Beat
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save as New
                  </>
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SaveBeatModal;
