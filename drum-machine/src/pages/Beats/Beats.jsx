// src/pages/Beats/Beats.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../../stores";
import AnimatedBackground from "../../components/AnimatedBackground/AnimatedBackground";
import { Music, Play, Clock, Calendar, Plus, User, LogOut } from "lucide-react";
import "./Beats.css";

function Beats() {
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  const { isAuthenticated, user, logout } = useAppStore((state) => state.auth);

  const { userBeats, isLoading, error, fetchUserBeats, loadBeat, clearError } =
    useAppStore((state) => state.beats);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    // Fetch user's beats when component loads
    fetchUserBeats();
  }, [isAuthenticated, fetchUserBeats, navigate]);

  const handleLoadBeat = async (beat) => {
    try {
      await loadBeat(beat.id);
      // Navigate to drum machine with loaded beat
      navigate("/DrumMachine");
    } catch (error) {
      console.error("Failed to load beat:", error);
    }
  };

  const handleCreateNew = () => {
    navigate("/DrumMachine");
  };

  const handleLogout = () => {
    logout();
    navigate("/");
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
              <img src="/idk.png" alt="Drum Machine" className="beats-logo" />
              <div className="header-text">
                <h1 className="beats-title">My Beats</h1>
                <p className="beats-subtitle">
                  Welcome back, <strong>{user?.username}</strong>
                </p>
              </div>
            </div>

            <div className="header-actions">
              <button className="create-new-btn" onClick={handleCreateNew}>
                <Plus size={18} />
                Create New Beat
              </button>

              <div className="user-menu">
                <div className="user-info">
                  <User size={16} />
                  {user?.username}
                </div>
                <button
                  className="logout-btn"
                  onClick={handleLogout}
                  title="Sign Out"
                >
                  <LogOut size={16} />
                </button>
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
                {filteredBeats.map((beat) => (
                  <div key={beat.id} className="beat-card">
                    <div className="beat-card-header">
                      <h3 className="beat-name">{beat.name}</h3>
                      <button
                        className="play-btn"
                        onClick={() => handleLoadBeat(beat)}
                        title="Load and play this beat"
                      >
                        <Play size={20} />
                      </button>
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
                        className="load-beat-btn"
                        onClick={() => handleLoadBeat(beat)}
                      >
                        Load Beat
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Beats;
