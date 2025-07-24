import React from "react";
import { useUIStore } from "../../stores/useUIStore";

function RecordingModal() {
  const { recordingModalOpen, closeRecordingModal } = useUIStore();

  // Don't render if modal is closed
  if (!recordingModalOpen) return null;

  const handleBackdropClick = (e) => {
    // Close if clicking on backdrop (not modal content)
    if (e.target === e.currentTarget) {
      closeRecordingModal();
    }
  };

  const handleEscapeKey = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeRecordingModal();
    }
  };

  // Add escape key listener when modal opens
  React.useEffect(() => {
    if (recordingModalOpen) {
      document.addEventListener("keydown", handleEscapeKey);
      return () => {
        document.removeEventListener("keydown", handleEscapeKey);
      };
    }
  }, [recordingModalOpen]);

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        zIndex: 1050,
      }}
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-3 p-4"
        style={{
          width: "90vw",
          maxWidth: "800px",
          height: "70vh",
          maxHeight: "600px",
        }}
        onClick={(e) => e.stopPropagation()} // Prevent backdrop click when clicking modal content
      >
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h3 className="mb-0">🥁 Trackpad Recording</h3>
          <button
            type="button"
            className="btn-close"
            onClick={closeRecordingModal}
            aria-label="Close"
          />
        </div>

        {/* Finger Guide */}
        <div className="mb-4">
          <h5 className="text-muted mb-3">Finger Guide:</h5>
          <div className="row g-3">
            <div className="col-md-4">
              <div className="d-flex align-items-center gap-2">
                <span style={{ fontSize: "24px" }}>👆</span>
                <span>Hi-hat</span>
              </div>
            </div>
            <div className="col-md-4">
              <div className="d-flex align-items-center gap-2">
                <span style={{ fontSize: "24px" }}>✌️</span>
                <span>Kick + Hi-hat</span>
              </div>
            </div>
            <div className="col-md-4">
              <div className="d-flex align-items-center gap-2">
                <span style={{ fontSize: "24px" }}>🤟</span>
                <span>Snare + Hi-hat</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recording Area */}
        <div className="mb-4">
          <div className="d-flex justify-content-center mb-3">
            <button className="btn btn-danger btn-lg px-4">
              <span className="me-2">●●●●</span>
              RECORD
            </button>
          </div>

          {/* Progress Bar Placeholder */}
          <div
            className="border rounded p-4 text-center"
            style={{ height: "200px", backgroundColor: "#f8f9fa" }}
          >
            <div className="d-flex justify-content-center align-items-center h-100">
              <div className="text-muted">
                <div style={{ fontSize: "48px" }} className="mb-2">
                  🎵
                </div>
                <p>Tap the trackpad to record drums</p>
                <small>8-bar recording loop</small>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="d-flex justify-content-between">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={closeRecordingModal}
          >
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled>
            Add to Grid
          </button>
        </div>
      </div>
    </div>
  );
}

export default RecordingModal;
