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
  ChevronDown,
  DoorOpen,
  History,
  Trash2,
} from "lucide-react";
import { getRecentRooms } from "../../utils/recentRooms";
import "./Beats.css";

function Beats() {
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingBeatId, setLoadingBeatId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState("");
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinRoomError, setJoinRoomError] = useState("");
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [recentRooms, setRecentRooms] = useState([]);
  const [isCheckingRooms, setIsCheckingRooms] = useState(false);
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
    deleteBeat,
  } = useAppStore((state) => state.beats);

  // PHASE 2: WebSocket functions for joining beat sessions
  // Note: createRoom removed - beats are now created via API
  const joinBeat = useAppStore((state) => state.websocket.joinBeat); // PHASE 2: renamed from joinRoom
  const checkRooms = useAppStore((state) => state.websocket.checkRooms);
  const isConnected = useAppStore((state) => state.websocket.isConnected);
  const connectionState = useAppStore(
    (state) => state.websocket.connectionState
  );
  const beatId = useAppStore((state) => state.websocket.beatId); // PHASE 2: renamed from roomId

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

    // Load recent rooms
    setRecentRooms(getRecentRooms());
  }, [isAuthenticated, fetchUserBeats, navigate]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showProfileDropdown && !event.target.closest('.user-menu')) {
        setShowProfileDropdown(false);
      }
      if (showCreateDropdown && !event.target.closest('.create-btn-group')) {
        setShowCreateDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileDropdown, showCreateDropdown]);

  const handleLoadBeat = async (beat) => {
    // PHASE 2: Simply navigate to beat's persistent room_id
    // The beat session will be auto-joined in DrumMachineApp
    // Handle both camelCase and snake_case from backend
    const roomId = beat.roomId || beat.room_id;
    if (!roomId) {
      console.error("Beat missing room_id:", beat);
      return;
    }

    setLoadingBeatId(beat.id);

    try {
      console.log("Navigating to beat session:", beat.name, roomId);

      // Navigate to drum machine with beat's room_id
      // DrumMachineApp will auto-join and sync the beat data
      navigate(`/DrumMachine/${roomId}`);
    } catch (error) {
      console.error("Failed to load beat:", error);
      setLoadingBeatId(null);
    }
  };

  const handleCreateNew = async () => {
    // PHASE 2: Create beat via API, then navigate to its room_id
    try {
      const getAuthHeaders = useAppStore.getState().auth.getAuthHeaders;

      // Create beat in database via API
      const response = await fetch('/api/beats', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Untitled Beat',
          patternData: {}, // Backend expects camelCase
          tracksConfig: [], // Will be initialized with defaults on backend
          bpm: 120,
          measureCount: 4
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create beat');
      }

      const data = await response.json();
      console.log("Created new beat:", data);

      // Navigate to beat's persistent room_id
      // DrumMachineApp will auto-join the beat session
      // Response format: { message: "...", beat: { roomId: "...", ... } }
      const beat = data.beat;
      const roomId = beat.roomId || beat.room_id;
      if (!roomId) {
        throw new Error('Beat created but missing room_id');
      }
      navigate(`/DrumMachine/${roomId}`);
    } catch (error) {
      console.error("Failed to create beat:", error);
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

  const handleJoinBeat = async () => {
    // PHASE 2: Navigate to beat ID, auto-join will happen in DrumMachineApp
    if (!joinRoomId.trim()) {
      return;
    }

    setJoinRoomError("");
    setIsJoiningRoom(true);

    try {
      // Simply navigate - DrumMachineApp will handle auto-join
      // If beat doesn't exist, the beat-not-found modal will show
      navigate(`/DrumMachine/${joinRoomId.trim()}`);
      setShowJoinModal(false);
      setJoinRoomId("");
    } catch (error) {
      console.error("Failed to navigate to beat:", error);
      setJoinRoomError(error.message || "Failed to join beat. Please try again.");
    } finally {
      setIsJoiningRoom(false);
    }
  };

  const handleCreateDropdownToggle = async (e) => {
    e.stopPropagation();

    // If closing dropdown, just close it
    if (showCreateDropdown) {
      setShowCreateDropdown(false);
      return;
    }

    // Opening dropdown - check which recent rooms still exist first
    if (isConnected) {
      const allRecentRooms = getRecentRooms();

      if (allRecentRooms.length > 0) {
        setIsCheckingRooms(true);
        setShowCreateDropdown(true);

        // Check which rooms still exist on the server
        const roomIds = allRecentRooms.map(room => room.roomId);
        const results = await checkRooms(roomIds);

        // Filter to only show rooms that exist
        const activeRooms = allRecentRooms.filter(room => {
          const result = results.find(r => r.roomId === room.roomId);
          return result && result.exists;
        });

        setRecentRooms(activeRooms);
        setIsCheckingRooms(false);
      } else {
        setRecentRooms([]);
        setShowCreateDropdown(true);
      }
    } else {
      setShowCreateDropdown(true);
    }
  };

  const handleJoinRecentBeat = async (beatId) => {
    // PHASE 2: Simply navigate to beat, auto-join will happen in DrumMachineApp
    setShowCreateDropdown(false);

    try {
      navigate(`/DrumMachine/${beatId}`);
    } catch (error) {
      console.error("Failed to navigate to beat:", error);
    }
  };

  const handleDeleteBeat = async (beat) => {
    try {
      await deleteBeat(beat.id);
      setConfirmDeleteId(null);
    } catch (error) {
      console.error("Failed to delete beat:", error);
    }
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
                    onClick={() => navigate(beatId ? `/DrumMachine/${beatId}` : "/DrumMachine")}
                  >
                    <Edit size={18} />
                    Continue Editing
                  </button>
                )}
                <div className="create-btn-group">
                  <button className="create-new-btn" onClick={handleCreateNew}>
                    <Plus size={18} />
                    Create New Beat
                  </button>
                  <button
                    className="create-dropdown-toggle"
                    onClick={handleCreateDropdownToggle}
                    aria-label="More options"
                  >
                    <ChevronDown size={16} />
                  </button>
                  {showCreateDropdown && (
                    <div className="create-dropdown">
                      <button
                        className="create-dropdown-item"
                        onClick={() => {
                          setShowCreateDropdown(false);
                          setShowJoinModal(true);
                        }}
                      >
                        <DoorOpen size={16} />
                        Join Room
                      </button>

                      {!isCheckingRooms && recentRooms.length > 0 && (
                        <>
                          <div className="dropdown-divider" />
                          <div className="dropdown-section-header">
                            <History size={14} />
                            Recent Sessions
                          </div>
                          {recentRooms.slice(0, 10).map((room) => (
                            <button
                              key={room.roomId}
                              className="create-dropdown-item recent-room-item"
                              onClick={() => handleJoinRecentBeat(room.roomId)}
                            >
                              {room.roomId}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
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

                        {confirmDeleteId === beat.id ? (
                          <div className="delete-confirm">
                            <span>Delete?</span>
                            <button
                              className="delete-confirm-yes"
                              onClick={() => handleDeleteBeat(beat)}
                            >
                              Yes
                            </button>
                            <button
                              className="delete-confirm-no"
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            className="delete-beat-btn"
                            onClick={() => setConfirmDeleteId(beat.id)}
                            title="Delete beat"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Join Room Modal */}
      {showJoinModal && (
        <div className="join-room-modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="join-room-modal" onClick={(e) => e.stopPropagation()}>
            <div className="join-room-header">
              <h2>Join Room</h2>
              <button className="modal-close-btn" onClick={() => setShowJoinModal(false)}>
                ×
              </button>
            </div>
            <div className="join-room-body">
              <p>Enter the room code to join an existing session:</p>
              <input
                type="text"
                className="join-room-input"
                placeholder="Enter room code"
                value={joinRoomId}
                onChange={(e) => {
                  setJoinRoomId(e.target.value.replace(/[^A-Za-z0-9]/g, ""));
                  setJoinRoomError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && !isJoiningRoom && handleJoinBeat()}
                maxLength={8}
                autoFocus
                disabled={isJoiningRoom}
              />
              {joinRoomError && (
                <div className="join-room-error">{joinRoomError}</div>
              )}
            </div>
            <div className="join-room-footer">
              <button
                className="join-cancel-btn"
                onClick={() => {
                  setShowJoinModal(false);
                  setJoinRoomError("");
                  setJoinRoomId("");
                }}
                disabled={isJoiningRoom}
              >
                Cancel
              </button>
              <button
                className="join-submit-btn"
                onClick={handleJoinBeat}
                disabled={!joinRoomId.trim() || isJoiningRoom}
              >
                {isJoiningRoom ? "Joining..." : "Join Room"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Beats;
