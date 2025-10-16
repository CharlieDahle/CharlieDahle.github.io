// src/components/UnsavedWorkModal/UnsavedWorkModal.jsx
import React from "react";
import { AlertTriangle, Save, X } from "lucide-react";
import "./UnsavedWorkModal.css";

function UnsavedWorkModal({ isOpen, onSave, onDiscard, onCancel }) {
  if (!isOpen) return null;

  return (
    <div className="unsaved-work-modal-overlay" onClick={onCancel}>
      <div className="unsaved-work-modal" onClick={(e) => e.stopPropagation()}>
        <div className="unsaved-work-header">
          <div className="unsaved-work-icon">
            <AlertTriangle size={32} />
          </div>
          <h2 className="unsaved-work-title">Unsaved Work</h2>
          <p className="unsaved-work-message">
            You have unsaved changes to your beat. Would you like to save before leaving?
          </p>
        </div>

        <div className="unsaved-work-actions">
          <button className="unsaved-btn unsaved-btn--save" onClick={onSave}>
            <Save size={16} />
            Save Beat
          </button>
          <button className="unsaved-btn unsaved-btn--discard" onClick={onDiscard}>
            Don't Save
          </button>
          <button className="unsaved-btn unsaved-btn--cancel" onClick={onCancel}>
            <X size={16} />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default UnsavedWorkModal;
