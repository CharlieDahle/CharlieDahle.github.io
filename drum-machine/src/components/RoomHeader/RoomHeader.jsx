// src/components/RoomHeader/RoomHeader.jsx - Streamlined version
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Save, Edit, FileText, Users, User } from "lucide-react";
import { useAppStore } from "../../stores";
import SaveBeatModal from "../SaveBeatModal/SaveBeatModal";
import UnsavedWorkModal from "../UnsavedWorkModal/UnsavedWorkModal";
import "./RoomHeader.css";

function RoomHeader({ debugMode, setDebugMode }) {
  const navigate = useNavigate();

  // Get room info from WebSocket slice
  const roomId = useAppStore((state) => state.websocket.roomId);
  const users = useAppStore((state) => state.websocket.users);
  const connectionState = useAppStore(
    (state) => state.websocket.connectionState
  );
  const leaveRoom = useAppStore((state) => state.websocket.leaveRoom);

  // Get auth state
  const { isAuthenticated, saveStateBeforeLogin } = useAppStore((state) => state.auth);

  // Get beat tracking info
  const { getSaveButtonInfo, hasUnsavedWork } = useAppStore((state) => state.beats);
  const saveButtonInfo = getSaveButtonInfo();

  // Save beat modal state
  const [showSaveBeatModal, setShowSaveBeatModal] = useState(false);
  const [showUnsavedWorkModal, setShowUnsavedWorkModal] = useState(false);
  const [shouldNavigateAfterSave, setShouldNavigateAfterSave] = useState(false);

  // Debug mode state - now managed by parent DrumMachine component
  const [clickCount, setClickCount] = useState(0);
  const [clickTimer, setClickTimer] = useState(null);

  const handleLeaveRoom = () => {
    // Call the leaveRoom function from the store
    leaveRoom();
    // Navigate back to room selection (removes room ID from URL)
    // Use replace: true to avoid adding to history stack
    navigate('/DrumMachine', { replace: true });
  };

  const handleSaveBeat = () => {
    if (isAuthenticated) {
      setShouldNavigateAfterSave(false);
      setShowSaveBeatModal(true);
    }
  };

  const handleNavigateToBeats = () => {
    // Check if there's unsaved work
    if (hasUnsavedWork()) {
      setShowUnsavedWorkModal(true);
    } else {
      navigate("/beats");
    }
  };

  const handleSaveAndNavigate = () => {
    setShowUnsavedWorkModal(false);
    setShouldNavigateAfterSave(true);
    setShowSaveBeatModal(true);
  };

  const handleAfterSave = () => {
    if (shouldNavigateAfterSave) {
      navigate("/beats");
      setShouldNavigateAfterSave(false);
    }
  };

  const handleDiscardAndNavigate = () => {
    setShowUnsavedWorkModal(false);
    navigate("/beats");
  };

  const handleCancelNavigation = () => {
    setShowUnsavedWorkModal(false);
  };

  const handleSignInClick = () => {
    // Save current drum machine state before redirecting to login
    saveStateBeforeLogin();
    navigate("/login");
  };

  // Secret debug mode trigger - click the logo 5 times quickly
  const handleTitleClick = () => {
    const newClickCount = clickCount + 1;
    setClickCount(newClickCount);

    // Clear any existing timer
    if (clickTimer) {
      clearTimeout(clickTimer);
    }

    // If we hit 5 clicks, activate debug mode
    if (newClickCount >= 5) {
      setDebugMode(true);
      setClickCount(0);
      console.log("🔧 Debug mode activated!");

      // Show a brief visual feedback
      const logoElement = document.querySelector(".room-title-logo");
      if (logoElement) {
        logoElement.style.filter = "hue-rotate(180deg)";
        setTimeout(() => {
          logoElement.style.filter = "";
        }, 500);
      }
      return;
    }

    // Reset click count after 2 seconds
    const timer = setTimeout(() => {
      setClickCount(0);
    }, 2000);
    setClickTimer(timer);
  };

  const userCount = users.length;
  const isConnected = connectionState === "connected";

  // Determine if we should show the save/update button
  const shouldShowSaveButton = () => {
    if (!isAuthenticated || !isConnected) return false;

    // Don't show if explicitly hidden (saved beat with no changes)
    if (saveButtonInfo.hideButton) return false;

    // Show for new beats or existing beats with changes
    return !saveButtonInfo.isUpdate || saveButtonInfo.showUnsavedIndicator;
  };

  // Get the save button configuration
  const getSaveButtonConfig = () => {
    if (!saveButtonInfo.isUpdate) {
      // New beat (not loaded from server)
      return {
        text: "Save",
        icon: <Save size={16} />,
        className: "header-action-btn header-action-btn--save",
      };
    } else if (saveButtonInfo.showUnsavedIndicator) {
      // Existing beat with changes
      return {
        text: "Update",
        icon: <Edit size={16} />,
        className: "header-action-btn header-action-btn--update",
      };
    }

    // This shouldn't render based on shouldShowSaveButton logic
    return null;
  };

  const saveButtonConfig = getSaveButtonConfig();

  return (
    <>
      <div className="floating-card room-header-card">
        <div className="room-header-content">
          <div className="title-section">
            <div
              className="room-title-container"
              onClick={handleTitleClick}
              title={
                clickCount > 0
                  ? `Debug mode: ${clickCount}/5 clicks`
                  : undefined
              }
            >
              <img
                src="/idk.png"
                alt="Drum Machine"
                className="room-title-logo"
              />
              {clickCount > 0 && (
                <span className="debug-counter">{clickCount}</span>
              )}
            </div>
            <div className="room-info">
              <div className="room-code-line">
                Room: {roomId}
                <div className="user-count-badge">
                  <Users size={16} />
                  <span>
                    {userCount} user{userCount !== 1 ? "s" : ""} online
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="header-actions">
            {/* Save/Update Button - only show when needed */}
            {shouldShowSaveButton() && saveButtonConfig && (
              <button
                className={saveButtonConfig.className}
                onClick={handleSaveBeat}
                disabled={!isConnected}
                title={
                  saveButtonInfo.isUpdate
                    ? `Update "${saveButtonInfo.beatName}" with your changes`
                    : "Save this beat to your library"
                }
              >
                {saveButtonConfig.icon}
                <span>{saveButtonConfig.text}</span>
              </button>
            )}

            {/* Navigate to Beats (if authenticated) or Sign In (if not) */}
            {isAuthenticated ? (
              <button
                className="header-action-btn header-action-btn--beats"
                onClick={handleNavigateToBeats}
                disabled={!isConnected}
                title="View your saved beats"
              >
                <FileText size={16} />
                <span>My Beats</span>
              </button>
            ) : (
              <button
                className="header-action-btn header-action-btn--signin"
                onClick={handleSignInClick}
                title="Sign in to save beats"
              >
                <User size={16} />
                <span>Sign In</span>
              </button>
            )}

            {/* Leave Room Button */}
            <button
              className="header-action-btn header-action-btn--leave"
              onClick={handleLeaveRoom}
              disabled={!isConnected}
            >
              <ChevronLeft size={16} />
              <span>Leave Room</span>
            </button>
          </div>
        </div>
      </div>

      {/* Save Beat Modal */}
      <SaveBeatModal
        isOpen={showSaveBeatModal}
        onClose={() => setShowSaveBeatModal(false)}
        onSaveSuccess={handleAfterSave}
      />

      {/* Unsaved Work Modal */}
      <UnsavedWorkModal
        isOpen={showUnsavedWorkModal}
        onSave={handleSaveAndNavigate}
        onDiscard={handleDiscardAndNavigate}
        onCancel={handleCancelNavigation}
      />
    </>
  );
}

export default RoomHeader;
