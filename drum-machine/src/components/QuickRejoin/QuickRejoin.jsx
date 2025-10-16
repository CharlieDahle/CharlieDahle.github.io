// src/components/QuickRejoin/QuickRejoin.jsx
import React, { useState, useEffect } from "react";
import { X, Users, Clock, History } from "lucide-react";
import { useAppStore } from "../../stores";
import { getRecentRooms, removeRecentRoom } from "../../utils/recentRooms";
import "./QuickRejoin.css";

function QuickRejoin({ onJoinRoom }) {
  const [activeRooms, setActiveRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [joiningRoomId, setJoiningRoomId] = useState(null);
  const [isHovered, setIsHovered] = useState(false);

  const checkRooms = useAppStore((state) => state.websocket.checkRooms);
  const isConnected = useAppStore((state) => state.websocket.isConnected);

  useEffect(() => {
    const loadActiveRooms = async () => {
      if (!isConnected) {
        setIsLoading(false);
        return;
      }

      // Get recent rooms from localStorage
      const recentRooms = getRecentRooms();

      if (recentRooms.length === 0) {
        setIsLoading(false);
        return;
      }

      // Check which rooms still exist on server
      const roomIds = recentRooms.map((r) => r.roomId);
      const results = await checkRooms(roomIds);

      // Filter to only active rooms
      const active = results
        .filter((r) => r.exists)
        .map((r) => ({
          roomId: r.roomId,
          userCount: r.userCount,
          lastJoined: recentRooms.find((recent) => recent.roomId === r.roomId)
            ?.lastJoined,
        }));

      setActiveRooms(active);
      setIsLoading(false);
    };

    loadActiveRooms();
  }, [isConnected, checkRooms]);

  const handleRejoin = async (roomId) => {
    setJoiningRoomId(roomId);
    try {
      await onJoinRoom(roomId);
    } catch (err) {
      console.error("Failed to rejoin room:", err);
      // Remove from recent rooms if it failed
      removeRecentRoom(roomId);
      // Update active rooms list
      setActiveRooms((prev) => prev.filter((r) => r.roomId !== roomId));
    } finally {
      setJoiningRoomId(null);
    }
  };

  const handleDismiss = (roomId) => {
    // Remove from active list (don't remove from localStorage, just hide for this session)
    setActiveRooms((prev) => prev.filter((r) => r.roomId !== roomId));
  };

  const formatTimeAgo = (timestamp) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  // Don't show tab if loading, no active rooms, or not connected
  if (isLoading || activeRooms.length === 0 || !isConnected) {
    return null;
  }

  return (
    <div className="quick-rejoin-tab">
      {/* Tab Handle */}
      <div
        className="quick-rejoin-handle"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span className="quick-rejoin-handle-icon">
          <History size={18} />
        </span>
        <span>Recent Sessions</span>
        <span className="quick-rejoin-badge">{activeRooms.length}</span>
      </div>

      {/* Invisible hover bridge */}
      {isHovered && (
        <div
          className="quick-rejoin-hover-bridge"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        />
      )}

      {/* Expanded Panel */}
      <div
        className={`quick-rejoin-panel ${isHovered ? 'quick-rejoin-panel--visible' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="quick-rejoin-panel-header">
          <div className="quick-rejoin-panel-title">
            <Clock size={18} />
            <span>Active Recent Sessions</span>
          </div>
        </div>

        <div className="quick-rejoin-panel-body">
          <div className="quick-rejoin-rooms">
            {activeRooms.map((room) => (
              <div key={room.roomId} className="quick-rejoin-room-card">
                <div className="quick-rejoin-room-header">
                  <div className="quick-rejoin-room-id">{room.roomId}</div>
                  <button
                    className="quick-rejoin-room-dismiss"
                    onClick={() => handleDismiss(room.roomId)}
                    title="Dismiss"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="quick-rejoin-room-meta">
                  <span className="quick-rejoin-users">
                    <Users size={14} />
                    {room.userCount} {room.userCount === 1 ? "user" : "users"}
                  </span>
                  <span className="quick-rejoin-time">
                    <Clock size={14} />
                    {formatTimeAgo(room.lastJoined)}
                  </span>
                </div>

                <button
                  className="quick-rejoin-join-btn"
                  onClick={() => handleRejoin(room.roomId)}
                  disabled={joiningRoomId !== null}
                >
                  {joiningRoomId === room.roomId ? "Joining..." : "Rejoin Room"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuickRejoin;
