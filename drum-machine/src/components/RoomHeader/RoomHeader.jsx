// src/components/RoomHeader/RoomHeader.jsx - Streamlined version
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Save, Edit, FileText, Users, User } from "lucide-react";
import { useAppStore } from "../../stores";
import SaveBeatModal from "../SaveBeatModal/SaveBeatModal";
import UnsavedWorkModal from "../UnsavedWorkModal/UnsavedWorkModal";
import AuthModal from "../AuthModal/AuthModal.jsx"; // PHASE 6
import VisibilityToggle from "../VisibilityToggle/VisibilityToggle.jsx";
import "./RoomHeader.css";

function RoomHeader({ debugMode, setDebugMode }) {
  const navigate = useNavigate();

  // PHASE 2: Get beat session info from WebSocket slice
  const beatId = useAppStore((state) => state.websocket.beatId); // PHASE 2: renamed from roomId
  const users = useAppStore((state) => state.websocket.users);
  const connectionState = useAppStore(
    (state) => state.websocket.connectionState
  );
  const leaveBeat = useAppStore((state) => state.websocket.leaveBeat); // PHASE 2: renamed from leaveRoom

  // Get auth state
  const { isAuthenticated, saveStateBeforeLogin } = useAppStore((state) => state.auth);

  // Get beat tracking info
  const { getSaveButtonInfo, hasUnsavedWork } = useAppStore((state) => state.beats);
  const saveButtonInfo = getSaveButtonInfo();

  // PHASE 6: Get guest beat state for warning
  const isGuestBeat = useAppStore((state) => state.beats.isGuestBeat);
  const guestBeatModified = useAppStore((state) => state.beats.guestBeatModified);

  // Save beat modal state
  const [showSaveBeatModal, setShowSaveBeatModal] = useState(false);
  const [showUnsavedWorkModal, setShowUnsavedWorkModal] = useState(false);
  const [shouldNavigateAfterSave, setShouldNavigateAfterSave] = useState(false);

  // PHASE 6: Auth modal state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const promoteGuestBeat = useAppStore((state) => state.beats.promoteGuestBeat);

  // Debug mode state - now managed by parent DrumMachine component
  const [clickCount, setClickCount] = useState(0);
  const [clickTimer, setClickTimer] = useState(null);

  const handleLeaveBeat = () => {
    // PHASE 2: Leave beat session and navigate back to beat selection
    // Call the leaveBeat function from the store
    leaveBeat();
    // Navigate back to beat selection (removes beat ID from URL)
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
    // PHASE 6: Open auth modal instead of navigating to /login
    setShowAuthModal(true);
  };

  const handleAuthSuccess = () => {
    // PHASE 6: Promote guest beat to owned beat after sign-in
    promoteGuestBeat();
    setShowAuthModal(false);
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
                Beat ID: {beatId}
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
            {/* Visibility Toggle - only show for authenticated users */}
            <VisibilityToggle />

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
              <>
                {/* PHASE 6: Show warning text for guest users with modified beats */}
                {isGuestBeat && guestBeatModified && (
                  <span className="guest-warning-text">
                    Sign in to save your work
                  </span>
                )}
                <button
                  className="header-action-btn header-action-btn--signin"
                  onClick={handleSignInClick}
                  title="Sign in to save beats"
                >
                  <User size={16} />
                  <span>Sign In</span>
                </button>
              </>
            )}

            {/* Leave Beat Button */}
            <button
              className="header-action-btn header-action-btn--leave"
              onClick={handleLeaveBeat}
              disabled={!isConnected}
            >
              <ChevronLeft size={16} />
              <span>Leave Beat</span>
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

      {/* PHASE 6: Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />
    </>
  );
}

export default RoomHeader;
