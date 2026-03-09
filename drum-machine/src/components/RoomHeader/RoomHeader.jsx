// src/components/RoomHeader/RoomHeader.jsx - Streamlined version
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Save, FileText, Users, User } from "lucide-react";
import { useAppStore } from "../../stores";
import AuthModal from "../AuthModal/AuthModal.jsx"; // PHASE 6
import VisibilityToggle from "../VisibilityToggle/VisibilityToggle.jsx";
import "./RoomHeader.css";

function RoomHeader({ debugMode, setDebugMode }) {
  const navigate = useNavigate();

  // PHASE 2: Get beat session info from WebSocket slice
  const beatId = useAppStore((state) => state.websocket.beatId);
  const beatName = useAppStore((state) => state.websocket.beatName);
  const users = useAppStore((state) => state.websocket.users);
  const connectionState = useAppStore(
    (state) => state.websocket.connectionState
  );
  const leaveBeat = useAppStore((state) => state.websocket.leaveBeat); // PHASE 2: renamed from leaveRoom

  // Get auth state
  const { isAuthenticated, saveStateBeforeLogin } = useAppStore((state) => state.auth);

  // Get beat tracking info for navigation warnings
  const { hasUnsavedWork } = useAppStore((state) => state.beats);

  // PHASE 6: Get guest beat state for warning
  const isGuestBeat = useAppStore((state) => state.beats.isGuestBeat);
  const guestBeatModified = useAppStore((state) => state.beats.guestBeatModified);

  // PHASE 7: Get auto-save status
  const lastSavedAt = useAppStore((state) => state.beats.lastSavedAt);
  const lastSavedBy = useAppStore((state) => state.beats.lastSavedBy);

  // Unsaved work modal state (for navigation warnings only)
  const [showUnsavedWorkModal, setShowUnsavedWorkModal] = useState(false);
  const [shouldNavigateAfterDiscard, setShouldNavigateAfterDiscard] = useState(false);

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

  const handleNavigateToBeats = () => {
    // PHASE 7: With auto-save, we don't need to prompt - just navigate
    // Auto-save will handle saving changes before session terminates
    navigate("/beats");
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

  // PHASE 7: Re-render every minute to update "X minutes ago" text
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!lastSavedAt) return;

    const interval = setInterval(() => {
      forceUpdate((n) => n + 1);
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [lastSavedAt]);

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
  const isReconnecting = connectionState === "connecting" || connectionState === "disconnected";
  const isSyncing = connectionState === "syncing";
  const isFailed = connectionState === "failed";

  // PHASE 7: Get auto-save status text
  const getAutoSaveStatus = () => {
    if (!isAuthenticated || !isConnected || isGuestBeat) {
      return null; // Don't show for guests or disconnected users
    }

    if (!lastSavedAt) {
      return {
        text: "Not saved yet",
        icon: <Save size={14} />,
        className: "auto-save-status auto-save-status--pending",
        tooltip: "Changes will auto-save every 2 minutes"
      };
    }

    const savedTime = new Date(lastSavedAt);
    const now = new Date();
    const diffMs = now - savedTime;
    const diffMinutes = Math.floor(diffMs / 60000);

    // Show "All changes saved" if saved within last minute
    if (diffMinutes < 1) {
      return {
        text: "All changes saved",
        icon: <Save size={14} />,
        className: "auto-save-status auto-save-status--saved",
        tooltip: "Auto-saved just now"
      };
    }

    // Show time-based status for older saves
    let timeAgo = "";
    if (diffMinutes === 1) timeAgo = "1 minute ago";
    else if (diffMinutes < 60) timeAgo = `${diffMinutes} minutes ago`;
    else {
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours === 1) timeAgo = "1 hour ago";
      else if (diffHours < 24) timeAgo = `${diffHours} hours ago`;
      else {
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays === 1) timeAgo = "1 day ago";
        else timeAgo = `${diffDays} days ago`;
      }
    }

    return {
      text: `Saved ${timeAgo}`,
      icon: <Save size={14} />,
      className: "auto-save-status auto-save-status--saved",
      tooltip: `Last auto-saved ${timeAgo}`
    };
  };

  return (
    <>
      {/* Connection status banner */}
      {beatId && (isReconnecting || isSyncing || isFailed) && (
        <div className={`connection-banner connection-banner--${isFailed ? "failed" : isReconnecting ? "reconnecting" : "syncing"}`}>
          {isFailed ? (
            <>⚠ Could not reconnect. Your changes may not be saved.</>
          ) : isReconnecting ? (
            <>
              <span className="connection-banner-spinner" />
              Reconnecting...
            </>
          ) : (
            <>
              <span className="connection-banner-spinner" />
              Syncing session...
            </>
          )}
        </div>
      )}
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
                {beatName && <span className="beat-name-label">{beatName}</span>}
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
            {/* PHASE 7: Auto-Save Status Badge (Google Docs style) */}
            {(() => {
              const status = getAutoSaveStatus();
              return status ? (
                <div className={status.className} title={status.tooltip}>
                  {status.icon}
                  <span>{status.text}</span>
                </div>
              ) : null;
            })()}

            {/* Visibility Toggle - only show for authenticated users */}
            <VisibilityToggle />

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
