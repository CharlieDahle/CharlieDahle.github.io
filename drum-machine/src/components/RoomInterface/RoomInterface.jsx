import React, { useState } from 'react';

function RoomInterface({ onCreateRoom, onJoinRoom, isConnected }) {
  const [joinRoomId, setJoinRoomId] = useState('');
  
  return (
    <div className="row justify-content-center">
      <div className="col-md-6">
        <div className="card">
          <div className="card-header text-center">
            <h4>Collaborative Drum Machine</h4>
            <div className="mt-2">
              <span className={`badge ${isConnected ? 'bg-success' : 'bg-danger'}`}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          <div className="card-body">
            {/* Create Room Section */}
            <div className="mb-4">
              <h5>Create New Room</h5>
              <button 
                className="btn btn-primary btn-lg w-100"
                onClick={onCreateRoom}
                disabled={!isConnected}
              >
                Create Room
              </button>
            </div>
            
            <hr />
            
            {/* Join Room Section */}
            <div>
              <h5>Join Existing Room</h5>
              <div className="input-group mb-3">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter room ID"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && onJoinRoom(joinRoomId)}
                />
                <button 
                  className="btn btn-outline-primary"
                  onClick={() => onJoinRoom(joinRoomId)}
                  disabled={!isConnected || !joinRoomId.trim()}
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RoomInterface;