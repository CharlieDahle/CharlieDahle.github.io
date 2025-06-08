import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import DrumGrid from './DrumGrid';

function DrumMachine() {
  // WebSocket connection
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Room state
  const [roomId, setRoomId] = useState(null);
  const [users, setUsers] = useState([]);
  const [isInRoom, setIsInRoom] = useState(false);
  
  // Playback state (mirrors server state)
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTick, setCurrentTick] = useState(0);
  const [bpm, setBpm] = useState(120);
  const [tracks, setTracks] = useState([]);
  
  // UI state
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [joinRoomInput, setJoinRoomInput] = useState('');
  
  // Constants (must match server for ticks, but we can adjust visual sizing)
  const TICKS_PER_BEAT = 480;
  const BEATS_PER_LOOP = 16;
  const TOTAL_TICKS = TICKS_PER_BEAT * BEATS_PER_LOOP;
  const PIXELS_PER_TICK = 0.1;

  // Initialize WebSocket connection
  useEffect(() => {
    const newSocket = io('ws://localhost:3001');
    
    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
    });
    
    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
      setIsInRoom(false);
    });
    
    // Room events
    newSocket.on('room-state', (state) => {
      console.log('Received room state:', state);
      setBpm(state.bpm);
      setIsPlaying(state.isPlaying);
      setCurrentTick(state.currentTick);
      setTracks(state.tracks);
      setUsers(state.users);
    });
    
    newSocket.on('user-joined', ({ userId }) => {
      console.log('User joined:', userId);
      setUsers(prev => [...prev, userId]);
    });
    
    newSocket.on('user-left', ({ userId }) => {
      console.log('User left:', userId);
      setUsers(prev => prev.filter(id => id !== userId));
    });
    
    // Playback synchronization
    newSocket.on('tick-sync', ({ tick, timestamp }) => {
      setCurrentTick(tick);
    });
    
    // Drum actions from server - mirror server's state changes
    newSocket.on('drum-action', (action) => {
      console.log('Received action:', action);
      handleServerAction(action);
    });
    
    setSocket(newSocket);
    
    return () => {
      newSocket.close();
    };
  }, []);

  // Handle actions received from server - simple mirroring
  const handleServerAction = (action) => {
    switch (action.type) {
      case 'play':
        setIsPlaying(true);
        break;
        
      case 'pause':
        setIsPlaying(false);
        break;
        
      case 'stop':
        setIsPlaying(false);
        setCurrentTick(0);
        break;
        
      case 'set-bpm':
        setBpm(action.bpm);
        break;
        
      case 'toggle-note':
        setTracks(prevTracks => {
          return prevTracks.map(track => {
            if (track.id === action.trackId) {
              const existingBeatIndex = track.beats.findIndex(
                beat => beat.tick === action.tick
              );
              
              if (existingBeatIndex >= 0) {
                // Remove existing beat
                return {
                  ...track,
                  beats: track.beats.filter((_, index) => index !== existingBeatIndex)
                };
              } else {
                // Add new beat
                return {
                  ...track,
                  beats: [
                    ...track.beats,
                    {
                      tick: action.tick,
                      velocity: action.velocity || 127
                    }
                  ]
                };
              }
            }
            return track;
          });
        });
        break;
        
      default:
        console.log('Unknown action type:', action.type);
    }
  };

  // Send action to server - dead simple
  const sendDrumAction = (action) => {
    if (socket && isInRoom) {
      console.log('Sending action:', action);
      socket.emit('drum-action', {
        roomId,
        action
      });
    }
  };

  // Periodic room state sync (safety net)
  useEffect(() => {
    if (!socket || !isInRoom) return;

    const syncInterval = setInterval(() => {
      console.log('Requesting room state sync...');
      socket.emit('request-room-state', { roomId });
    }, 30000); // Every 30 seconds

    return () => clearInterval(syncInterval);
  }, [socket, isInRoom, roomId]);

  // Room management functions
  const createRoom = () => {
    if (socket) {
      socket.emit('create-room', (response) => {
        if (response.success) {
          setRoomId(response.roomId);
          setUsers(response.users);
          setIsInRoom(true);
          console.log('Room created:', response.roomId);
        }
      });
    }
  };

  const joinRoom = () => {
    if (socket && joinRoomInput.trim()) {
      socket.emit('join-room', { roomId: joinRoomInput.trim() }, (response) => {
        if (response.success) {
          setRoomId(joinRoomInput.trim());
          setUsers(response.users);
          setIsInRoom(true);
          console.log('Joined room:', joinRoomInput.trim());
        } else {
          alert('Failed to join room: ' + response.error);
        }
      });
    }
  };

  // Transport controls - simple actions
  const handlePlay = () => {
    sendDrumAction({ type: 'play' });
  };

  const handlePause = () => {
    sendDrumAction({ type: 'pause' });
  };

  const handleStop = () => {
    sendDrumAction({ type: 'stop' });
  };

  const handleBpmChange = (newBpm) => {
    sendDrumAction({ type: 'set-bpm', bpm: parseInt(newBpm) });
  };

  // Note manipulation - wait for server response
  const addNote = (trackId, tick, velocity = 127) => {
    sendDrumAction({
      type: 'toggle-note',
      trackId,
      tick,
      velocity
    });
  };

  const removeNote = (trackId, tick) => {
    sendDrumAction({
      type: 'toggle-note',
      trackId,
      tick
    });
  };

  const moveNote = (trackId, fromTick, toTick) => {
    // Remove from old position
    sendDrumAction({
      type: 'toggle-note',
      trackId,
      tick: fromTick
    });
    
    // Add to new position (with small delay to ensure order)
    setTimeout(() => {
      sendDrumAction({
        type: 'toggle-note',
        trackId,
        tick: toTick,
        velocity: 127
      });
    }, 50);
  };

  // Connection status
  if (!isConnected) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Connecting to server...</h2>
      </div>
    );
  }

  // Room selection
  if (!isInRoom) {
    return (
      <div style={{ padding: '20px', maxWidth: '400px', margin: '0 auto' }}>
        <h1>Collaborative Drum Machine</h1>
        
        <div style={{ marginBottom: '20px' }}>
          <h3>Create New Room</h3>
          <button 
            onClick={createRoom}
            style={{
              background: '#27ae60',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Create Room
          </button>
        </div>

        <div>
          <h3>Join Existing Room</h3>
          <input
            type="text"
            value={joinRoomInput}
            onChange={(e) => setJoinRoomInput(e.target.value)}
            placeholder="Enter room ID"
            style={{
              padding: '8px',
              marginRight: '10px',
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
            onKeyPress={(e) => e.key === 'Enter' && joinRoom()}
          />
          <button 
            onClick={joinRoom}
            style={{
              background: '#3498db',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Join Room
          </button>
        </div>
      </div>
    );
  }

  // Main drum machine interface
  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Drum Machine - Room: {roomId}</h1>
        <div>
          <strong>Users online: {users.length}</strong>
        </div>
      </div>

      {/* Transport Controls */}
      <div style={{ 
        margin: '20px 0', 
        display: 'flex', 
        gap: '10px', 
        alignItems: 'center' 
      }}>
        <button 
          onClick={isPlaying ? handlePause : handlePlay}
          style={{
            background: isPlaying ? '#e74c3c' : '#27ae60',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
        
        <button 
          onClick={handleStop}
          style={{
            background: '#95a5a6',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          ⏹ Stop
        </button>
        
        <label>
          BPM: 
          <input 
            type="number" 
            value={bpm} 
            onChange={(e) => handleBpmChange(e.target.value)}
            min="60" 
            max="300"
            style={{
              marginLeft: '5px',
              padding: '5px',
              width: '60px'
            }}
          />
        </label>
      </div>

      {/* Snap Toggle */}
      <div style={{ marginBottom: '20px' }}>
        <label>
          <input 
            type="checkbox" 
            checked={snapToGrid} 
            onChange={(e) => setSnapToGrid(e.target.checked)}
          />
          {' '}Snap to beat
        </label>
      </div>

      {/* Main Drum Grid */}
      <DrumGrid
        tracks={tracks}
        currentTick={currentTick}
        isPlaying={isPlaying}
        snapToGrid={snapToGrid}
        onAddNote={addNote}
        onRemoveNote={removeNote}
        onMoveNote={moveNote}
        TICKS_PER_BEAT={TICKS_PER_BEAT}
        BEATS_PER_LOOP={BEATS_PER_LOOP}
        PIXELS_PER_TICK={PIXELS_PER_TICK}
      />
    </div>
  );
}

export default DrumMachine;