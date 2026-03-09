// src/pages/Beats/Beats.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../../stores";
import AnimatedBackground from "../../components/AnimatedBackground/AnimatedBackground";
import CollaboratorModal from "../../components/CollaboratorModal/CollaboratorModal";
import {
  Music,
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
  Globe,
  EyeOff,
  Lock,
  Users,
  UserCog,
} from "lucide-react";
import { getRecentRooms } from "../../utils/recentRooms";
import "./Beats.css";

function Beats() {
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingBeatId, setLoadingBeatId] = useState(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState("");
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinRoomError, setJoinRoomError] = useState("");
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [recentRooms, setRecentRooms] = useState([]);
  const [isCheckingRooms, setIsCheckingRooms] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [activeTab, setActiveTab] = useState("my-beats");
  const [visibilityMenuId, setVisibilityMenuId] = useState(null);
  const [collaboratorBeat, setCollaboratorBeat] = useState(null);
  const navigate = useNavigate();

  const { isAuthenticated, user, logout } = useAppStore((state) => state.auth);
  const {
    userBeats,
    sharedBeats,
    publicBeats,
    isLoading,
    error,
    fetchUserBeats,
    fetchSharedBeats,
    fetchPublicBeats,
    updateBeatVisibility,
    loadBeat,
    clearError,
    getSaveButtonInfo,
    createNewBeat,
    deleteBeat,
  } = useAppStore((state) => state.beats);

  const joinBeat = useAppStore((state) => state.websocket.joinBeat);
  const checkRooms = useAppStore((state) => state.websocket.checkRooms);
  const isConnected = useAppStore((state) => state.websocket.isConnected);
  const beatId = useAppStore((state) => state.websocket.beatId);

  const saveButtonInfo = getSaveButtonInfo();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login", { replace: true });
      return;
    }
    fetchUserBeats();
    fetchSharedBeats();
    fetchPublicBeats();
    setRecentRooms(getRecentRooms());
  }, [isAuthenticated]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showProfileDropdown && !event.target.closest(".user-menu")) {
        setShowProfileDropdown(false);
      }
      if (showCreateDropdown && !event.target.closest(".create-btn-group")) {
        setShowCreateDropdown(false);
      }
      if (visibilityMenuId && !event.target.closest(".visibility-cell")) {
        setVisibilityMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showProfileDropdown, showCreateDropdown, visibilityMenuId]);

  const handleLoadBeat = async (beat) => {
    const roomId = beat.roomId || beat.room_id;
    if (!roomId) return;
    setLoadingBeatId(beat.id);
    try {
      navigate(`/DrumMachine/${roomId}`);
    } catch (error) {
      console.error("Failed to load beat:", error);
      setLoadingBeatId(null);
    }
  };

  const handleCreateNew = async () => {
    try {
      const getAuthHeaders = useAppStore.getState().auth.getAuthHeaders;
      const response = await fetch("/api/beats", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Untitled Beat",
          patternData: {},
          tracksConfig: [],
          bpm: 120,
          measureCount: 4,
        }),
      });
      if (!response.ok) throw new Error("Failed to create beat");
      const data = await response.json();
      const roomId = data.beat.roomId || data.beat.room_id;
      if (!roomId) throw new Error("Beat created but missing room_id");
      navigate(`/DrumMachine/${roomId}`);
    } catch (error) {
      console.error("Failed to create beat:", error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const handleJoinBeat = async () => {
    if (!joinRoomId.trim()) return;
    setJoinRoomError("");
    setIsJoiningRoom(true);
    try {
      navigate(`/DrumMachine/${joinRoomId.trim()}`);
      setShowJoinModal(false);
      setJoinRoomId("");
    } catch (error) {
      setJoinRoomError(error.message || "Failed to join beat. Please try again.");
    } finally {
      setIsJoiningRoom(false);
    }
  };

  const handleCreateDropdownToggle = async (e) => {
    e.stopPropagation();
    if (showCreateDropdown) {
      setShowCreateDropdown(false);
      return;
    }
    if (isConnected) {
      const allRecentRooms = getRecentRooms();
      if (allRecentRooms.length > 0) {
        setIsCheckingRooms(true);
        setShowCreateDropdown(true);
        const roomIds = allRecentRooms.map((room) => room.roomId);
        const results = await checkRooms(roomIds);
        const activeRooms = allRecentRooms.filter((room) => {
          const result = results.find((r) => r.roomId === room.roomId);
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

  const handleJoinRecentBeat = (id) => {
    setShowCreateDropdown(false);
    navigate(`/DrumMachine/${id}`);
  };

  const handleDeleteBeat = async (beat) => {
    try {
      await deleteBeat(beat.id);
      setConfirmDeleteId(null);
    } catch (error) {
      console.error("Failed to delete beat:", error);
    }
  };

  const handleUpdateVisibility = async (beat, newVisibility) => {
    setVisibilityMenuId(null);
    try {
      await updateBeatVisibility(beat.room_id || beat.roomId, newVisibility);
    } catch (error) {
      console.error("Failed to update visibility:", error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getVisibilityIcon = (v) => {
    if (v === "public") return <Globe size={13} />;
    if (v === "unlisted") return <EyeOff size={13} />;
    return <Lock size={13} />;
  };

  const getVisibilityLabel = (v) => {
    if (v === "public") return "Public";
    if (v === "unlisted") return "Unlisted";
    return "Private";
  };

  // Active beats list based on tab
  const activeBeats =
    activeTab === "my-beats"
      ? userBeats
      : activeTab === "shared"
      ? sharedBeats
      : publicBeats;

  const filteredBeats = activeBeats.filter((beat) =>
    beat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAuthenticated) return <div>Redirecting to login...</div>;

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
                    onClick={() =>
                      navigate(
                        beatId ? `/DrumMachine/${beatId}` : "/DrumMachine"
                      )
                    }
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
                  className={`user-info ${showProfileDropdown ? "user-info--active" : ""}`}
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                >
                  <User size={16} />
                  {user?.username}
                </div>
                {showProfileDropdown && (
                  <div className="profile-dropdown">
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        setShowProfileDropdown(false);
                        handleLogout();
                      }}
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
          {/* Tabs */}
          <div className="beats-tabs">
            <button
              className={`beats-tab ${activeTab === "my-beats" ? "beats-tab--active" : ""}`}
              onClick={() => setActiveTab("my-beats")}
            >
              <FileText size={16} />
              My Beats
              <span className="beats-tab-count">{userBeats.length}</span>
            </button>
            <button
              className={`beats-tab ${activeTab === "shared" ? "beats-tab--active" : ""}`}
              onClick={() => setActiveTab("shared")}
            >
              <Users size={16} />
              Shared With Me
              <span className="beats-tab-count">{sharedBeats.length}</span>
            </button>
            <button
              className={`beats-tab ${activeTab === "public" ? "beats-tab--active" : ""}`}
              onClick={() => setActiveTab("public")}
            >
              <Globe size={16} />
              Public Gallery
            </button>
          </div>

          <div className="beats-container">
            {/* Search and Stats */}
            <div className="content-header">
              <div className="search-section">
                <input
                  type="text"
                  className="search-input"
                  placeholder={`Search ${activeTab === "public" ? "public beats" : "beats"}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="stats-section">
                <div className="stat-item">
                  <Music size={16} />
                  <span>
                    {activeBeats.length} beat{activeBeats.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="error-banner">
                <p>{error}</p>
                <button onClick={clearError} className="error-close">×</button>
              </div>
            )}

            {/* Connection Status Warning */}
            {!isConnected && (
              <div className="error-banner">
                <p>Not connected to server. Please wait for connection before loading beats.</p>
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
            {!isLoading && activeBeats.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon"><Music size={64} /></div>
                {activeTab === "my-beats" && (
                  <>
                    <h2>No beats yet!</h2>
                    <button className="empty-action-btn" onClick={handleCreateNew}>
                      <Plus size={18} />
                      Create Your First Beat
                    </button>
                  </>
                )}
                {activeTab === "shared" && <h2>No beats shared with you yet.</h2>}
                {activeTab === "public" && <h2>No public beats found.</h2>}
              </div>
            )}

            {/* No Search Results */}
            {!isLoading && activeBeats.length > 0 && filteredBeats.length === 0 && (
              <div className="no-results">
                <p>No beats found matching "{searchTerm}"</p>
                <button className="clear-search-btn" onClick={() => setSearchTerm("")}>
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
                    saveButtonInfo.isUpdate && saveButtonInfo.beatName === beat.name;
                  const visibility = beat.visibility || "private";

                  return (
                    <div
                      key={beat.id}
                      className={`beat-card ${isCurrentlyLoaded ? "currently-loaded" : ""}`}
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

                        {/* Visibility control — only on My Beats */}
                        {activeTab === "my-beats" && (
                          <div className="visibility-cell">
                            <button
                              className={`visibility-pill visibility-pill--${visibility}`}
                              onClick={() =>
                                setVisibilityMenuId(
                                  visibilityMenuId === beat.id ? null : beat.id
                                )
                              }
                              title="Change visibility"
                            >
                              {getVisibilityIcon(visibility)}
                              <span>{getVisibilityLabel(visibility)}</span>
                            </button>
                            {visibilityMenuId === beat.id && (
                              <div className="visibility-menu">
                                {["private", "unlisted", "public"].map((v) => (
                                  <button
                                    key={v}
                                    className={`visibility-menu-item ${visibility === v ? "visibility-menu-item--active" : ""}`}
                                    onClick={() => handleUpdateVisibility(beat, v)}
                                  >
                                    {getVisibilityIcon(v)}
                                    {getVisibilityLabel(v)}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Shared badge */}
                        {activeTab === "shared" && beat.role && (
                          <span className="shared-badge">
                            <Users size={12} />
                            {beat.role}
                          </span>
                        )}
                      </div>

                      <div className="beat-info">
                        <div className="beat-detail">
                          <Calendar size={14} />
                          <span>Edited {formatDate(beat.updated_at || beat.created_at)}</span>
                        </div>
                        <div className="beat-detail">
                          <FileText size={14} />
                          <span>{beat.room_id}</span>
                        </div>
                      </div>

                      <div className="beat-card-footer">
                        <button
                          className={`load-beat-btn ${isCurrentlyLoaded ? "current-beat" : ""}`}
                          onClick={() => handleLoadBeat(beat)}
                          disabled={!isConnected || isLoadingThisBeat}
                        >
                          {isLoadingThisBeat ? (
                            <>
                              <div className="loading-spinner" style={{ width: 16, height: 16, marginRight: 8 }}></div>
                              Loading...
                            </>
                          ) : isCurrentlyLoaded ? (
                            "Continue Editing"
                          ) : (
                            "Load Beat"
                          )}
                        </button>

                        {/* Delete + Manage — only on My Beats */}
                        {activeTab === "my-beats" && (
                          <>
                            <button
                              className="manage-beat-btn"
                              onClick={() => setCollaboratorBeat(beat)}
                              title="Manage collaborators"
                            >
                              <UserCog size={16} />
                            </button>
                            <div className="delete-beat-wrapper">
                              <button
                                className="delete-beat-btn"
                                onClick={() => setConfirmDeleteId(confirmDeleteId === beat.id ? null : beat.id)}
                                title="Delete beat"
                              >
                                <Trash2 size={16} />
                              </button>
                              {confirmDeleteId === beat.id && (
                                <div className="delete-popover">
                                  <span>Delete?</span>
                                  <button className="delete-confirm-yes" onClick={() => handleDeleteBeat(beat)}>Yes</button>
                                  <button className="delete-confirm-no" onClick={() => setConfirmDeleteId(null)}>No</button>
                                </div>
                              )}
                            </div>
                          </>
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

      {/* Collaborator Modal */}
      {collaboratorBeat && (
        <CollaboratorModal
          beat={collaboratorBeat}
          onClose={() => setCollaboratorBeat(null)}
        />
      )}

      {/* Join Room Modal */}
      {showJoinModal && (
        <div className="join-room-modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="join-room-modal" onClick={(e) => e.stopPropagation()}>
            <div className="join-room-header">
              <h2>Join Room</h2>
              <button className="modal-close-btn" onClick={() => setShowJoinModal(false)}>×</button>
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
              {joinRoomError && <div className="join-room-error">{joinRoomError}</div>}
            </div>
            <div className="join-room-footer">
              <button
                className="join-cancel-btn"
                onClick={() => { setShowJoinModal(false); setJoinRoomError(""); setJoinRoomId(""); }}
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
