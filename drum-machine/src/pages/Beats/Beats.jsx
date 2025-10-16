// src/pages/Beats/Beats.jsx - Enhanced with better beat status
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../../stores";
import AnimatedBackground from "../../components/AnimatedBackground/AnimatedBackground";
import {
  Music,
  Clock,
  Calendar,
  Plus,
  User,
  LogOut,
  FileText,
  Edit,
} from "lucide-react";
import "./Beats.css";

function Beats() {
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingBeatId, setLoadingBeatId] = useState(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const navigate = useNavigate();

  const { isAuthenticated, user, logout } = useAppStore((state) => state.auth);
  const {
    userBeats,
    isLoading,
    error,
    fetchUserBeats,
    loadBeat,
    clearError,
    getSaveButtonInfo,
    createNewBeat,
  } = useAppStore((state) => state.beats);

  // WebSocket functions for creating room
  const createRoom = useAppStore((state) => state.websocket.createRoom);
  const isConnected = useAppStore((state) => state.websocket.isConnected);
  const connectionState = useAppStore(
    (state) => state.websocket.connectionState
  );
  const roomId = useAppStore((state) => state.websocket.roomId);

  // Get current beat info
  const saveButtonInfo = getSaveButtonInfo();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login", { replace: true });
      return;
    }

    // Fetch user's beats when component loads
    fetchUserBeats();
  }, [isAuthenticated, fetchUserBeats, navigate]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showProfileDropdown && !event.target.closest('.user-menu')) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileDropdown]);

  const handleLoadBeat = async (beat) => {
    if (!isConnected) {
      console.error("Not connected to server");
      return;
    }

    setLoadingBeatId(beat.id);

    try {
      // First, load the beat data into the local state
      console.log("Loading beat data:", beat.name);
      await loadBeat(beat.id);

      // Then create a new room with this beat data
      console.log("Creating room with loaded beat...");
      const roomState = await createRoom();

      // Navigate to drum machine with room ID in URL
      navigate(`/DrumMachine/${roomState.id}`);
    } catch (error) {
      console.error("Failed to load beat and create room:", error);
      setLoadingBeatId(null);
    }
  };

  const handleCreateNew = async () => {
    if (!isConnected) {
      console.error("Not connected to server");
      return;
    }

    try {
      // Clear current beat tracking
      createNewBeat();

      // Create a new room
      const roomState = await createRoom();

      // Navigate to drum machine with room ID in URL
      navigate(`/DrumMachine/${roomState.id}`);
    } catch (error) {
      console.error("Failed to create room:", error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const handleProfileClick = () => {
    setShowProfileDropdown(!showProfileDropdown);
  };

  const handleDropdownLogout = () => {
    setShowProfileDropdown(false);
    handleLogout();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const filteredBeats = userBeats.filter((beat) =>
    beat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAuthenticated) {
    return <div>Redirecting to login...</div>;
  }

  return (
    <div className="beats-page">
      <AnimatedBackground blobCount={[3, 5]} />

      <div className="beats-layout">
        {/* Header */}
        <div className="beats-header">
          <div className="beats-header-content">
            <div className="header-left">
              <img src="/mygod.png" alt="Drum Machine" className="beats-logo" />
              <div className="header-text">
                {saveButtonInfo.isUpdate && (
                  <p className="beats-subtitle">
                    <span className="current-beat-info">
                      Currently working on:{" "}
                      <strong>"{saveButtonInfo.beatName}"</strong>
                      {saveButtonInfo.showUnsavedIndicator && (
                        <span className="unsaved-changes-indicator">
                          {" "}
                          (has unsaved changes)
                        </span>
                      )}
                    </span>
                  </p>
                )}
              </div>
              <div className="header-buttons">
                {saveButtonInfo.isUpdate && (
                  <button
                    className="continue-editing-btn"
                    onClick={() => navigate(roomId ? `/DrumMachine/${roomId}` : "/DrumMachine")}
                  >
                    <Edit size={18} />
                    Continue Editing
                  </button>
                )}
                <button className="create-new-btn" onClick={handleCreateNew}>
                  <Plus size={18} />
                  Create New Beat
                </button>
              </div>
            </div>

            <div className="header-actions">
              <div className="user-menu">
                <div
                  className={`user-info ${showProfileDropdown ? 'user-info--active' : ''}`}
                  onClick={handleProfileClick}
                >
                  <User size={16} />
                  {user?.username}
                </div>
                {showProfileDropdown && (
                  <div className="profile-dropdown">
                    <button
                      className="dropdown-item"
                      onClick={handleDropdownLogout}
                    >
                      <LogOut size={16} />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="beats-content">
          <div className="beats-container">
            {/* Search and Stats */}
            <div className="content-header">
              <div className="search-section">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search your beats..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="stats-section">
                <div className="stat-item">
                  <Music size={16} />
                  <span>
                    {userBeats.length} beat{userBeats.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {saveButtonInfo.isUpdate && (
                  <div className="stat-item current-beat-stat">
                    <FileText size={16} />
                    <span>
                      Working on "{saveButtonInfo.beatName}"
                      {saveButtonInfo.showUnsavedIndicator && " *"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="error-banner">
                <p>{error}</p>
                <button onClick={clearError} className="error-close">
                  ×
                </button>
              </div>
            )}

            {/* Connection Status Warning */}
            {!isConnected && (
              <div className="error-banner">
                <p>
                  Not connected to server. Please wait for connection before
                  loading beats.
                </p>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="loading-state">
                <div className="loading-spinner-large"></div>
                <p>Loading your beats...</p>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && userBeats.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">
                  <Music size={64} />
                </div>
                <h2>No beats yet!</h2>
                <p>
                  Create your first beat and start building your rhythm library.
                </p>
                <button className="empty-action-btn" onClick={handleCreateNew}>
                  <Plus size={18} />
                  Create Your First Beat
                </button>
              </div>
            )}

            {/* No Search Results */}
            {!isLoading &&
              userBeats.length > 0 &&
              filteredBeats.length === 0 && (
                <div className="no-results">
                  <p>No beats found matching "{searchTerm}"</p>
                  <button
                    className="clear-search-btn"
                    onClick={() => setSearchTerm("")}
                  >
                    Clear Search
                  </button>
                </div>
              )}

            {/* Beats Grid */}
            {!isLoading && filteredBeats.length > 0 && (
              <div className="beats-grid">
                {filteredBeats.map((beat) => {
                  const isLoadingThisBeat = loadingBeatId === beat.id;
                  const isCurrentlyLoaded =
                    saveButtonInfo.isUpdate &&
                    saveButtonInfo.beatName === beat.name;

                  return (
                    <div
                      key={beat.id}
                      className={`beat-card ${
                        isCurrentlyLoaded ? "currently-loaded" : ""
                      }`}
                    >
                      <div className="beat-card-header">
                        <h3 className="beat-name">
                          {beat.name}
                          {isCurrentlyLoaded && (
                            <span className="current-beat-badge">
                              <Edit size={14} />
                              Current
                              {saveButtonInfo.showUnsavedIndicator && " *"}
                            </span>
                          )}
                        </h3>
                      </div>

                      <div className="beat-info">
                        <div className="beat-detail">
                          <Clock size={14} />
                          <span>{beat.bpm} BPM</span>
                        </div>

                        <div className="beat-detail">
                          <Music size={14} />
                          <span>{beat.measure_count} measures</span>
                        </div>

                        <div className="beat-detail">
                          <Calendar size={14} />
                          <span>{formatDate(beat.created_at)}</span>
                        </div>
                      </div>

                      <div className="beat-card-footer">
                        <button
                          className={`load-beat-btn ${
                            isCurrentlyLoaded ? "current-beat" : ""
                          }`}
                          onClick={() => handleLoadBeat(beat)}
                          disabled={!isConnected || isLoadingThisBeat}
                        >
                          {isLoadingThisBeat ? (
                            <>
                              <div
                                className="loading-spinner"
                                style={{
                                  width: 16,
                                  height: 16,
                                  marginRight: 8,
                                }}
                              ></div>
                              Loading...
                            </>
                          ) : isCurrentlyLoaded ? (
                            "Continue Editing"
                          ) : (
                            "Load Beat"
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Beats;
