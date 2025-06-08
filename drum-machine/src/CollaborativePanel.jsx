import React, { useState } from 'react';
import { Plus, Users, Wifi, WifiOff } from 'lucide-react';

function CollaborativePanel({ 
  connectionStatus,
  roomId,
  connectedUsers,
  onCreateRoom,
  onJoinRoom
}) {
  const [joinRoomInput, setJoinRoomInput] = useState('');

  const handleJoinRoom = () => {
    if (joinRoomInput.trim()) {
      onJoinRoom(joinRoomInput.trim());
      setJoinRoomInput(''); // Clear input after joining
    }
  };

  const handleJoinInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleJoinRoom();
    }
  };

  return (
    <div className="collaborative-panel">
      <h5 className="mb-3">Collaboration Settings</h5>
      
      {/* Connection Status */}
      <div className={`status-indicator ${connectionStatus !== 'connected' ? 'disconnected' : ''}`}>
        {connectionStatus === 'connected' ? <Wifi size={20} /> : <WifiOff size={20} />}
        <span className="fw-semibold">
          Status: {connectionStatus === 'connected' ? 'Connected' : 
                   connectionStatus === 'error' ? 'Connection Error' : 'Disconnected'}
        </span>
        {connectedUsers.length > 0 && (
          <div className="d-flex align-items-center ms-auto">
            <Users size={16} className="me-2" />
            <span className="badge bg-primary">
              {connectedUsers.length} user{connectedUsers.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Connection Error Message */}
      {connectionStatus === 'error' && (
        <div className="alert alert-warning mb-3">
          <small>
            <strong>Connection Failed:</strong> Make sure the collaboration server is running on localhost:3001
          </small>
        </div>
      )}

      {/* Room Management - Only show if connected but no room */}
      {connectionStatus === 'connected' && !roomId && (
        <div className="room-controls">
          <button
            onClick={onCreateRoom}
            className="btn btn-success"
            type="button"
          >
            <Plus size={16} className="me-2" />
            Create Room
          </button>
          <div className="d-flex gap-2">
            <input
              type="text"
              value={joinRoomInput}
              onChange={(e) => setJoinRoomInput(e.target.value)}
              onKeyPress={handleJoinInputKeyPress}
              placeholder="Enter Room ID"
              className="form-control"
              style={{width: '200px'}}
              maxLength={20}
            />
            <button
              onClick={handleJoinRoom}
              className="btn btn-primary"
              type="button"
              disabled={!joinRoomInput.trim()}
            >
              Join Room
            </button>
          </div>
        </div>
      )}

      {/* Current Room Display */}
      {roomId && (
        <div className="room-id-display">
          <strong>Room ID:</strong> {roomId}
          <small className="d-block text-muted mt-1">
            Share this ID with others to collaborate
          </small>
        </div>
      )}

      {/* Disconnected State Help */}
      {connectionStatus === 'disconnected' && (
        <div className="text-muted">
          <small>
            Collaborative features require a connection to the collaboration server.
          </small>
        </div>
      )}
    </div>
  );
}

export default CollaborativePanel;