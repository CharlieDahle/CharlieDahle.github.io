import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import RoomInterface from './RoomInterface';
import PatternTimeline from './PatternTimeline';
import TransportControls from './TransportControls';
import DrumScheduler from './DrumScheduler';

function DrumMachine() {
  // Connection state
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Room state
  const [roomId, setRoomId] = useState(null);
  const [isInRoom, setIsInRoom] = useState(false);
  const [users, setUsers] = useState([]);
  
  // Pattern state (from server)
  const [pattern, setPattern] = useState({});
  const [bpm, setBpm] = useState(120);
  
  // Local playback state (from scheduler)
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTick, setCurrentTick] = useState(0);
  
  // UI state
  const [snapToGrid, setSnapToGrid] = useState(true);
  
  // Scheduler instance
  const schedulerRef = useRef(null);
  
  // Error handling
  const [error, setError] = useState(null);

  // Constants
  const TICKS_PER_BEAT = 480;
  const BEATS_PER_LOOP = 16;

  // Initialize scheduler
  useEffect(() => {
    const scheduler = new DrumScheduler(bpm, (tick) => {
      setCurrentTick(tick);
    });
    
    schedulerRef.current = scheduler;
    
    return () => {
      if (schedulerRef.current) {
        schedulerRef.current.destroy();
      }
    };
  }, []);

  // Update scheduler when pattern or BPM changes
  useEffect(() => {
    if (schedulerRef.current) {
      schedulerRef.current.setPattern(pattern);
      schedulerRef.current.setBpm(bpm);
    }
  }, [pattern, bpm]);

  // Initialize WebSocket connection
  useEffect(() => {
    console.log('Connecting to server...');
    const newSocket = io('https://api.charliedahle.me');
    
    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
      setError(null);
    });
    
    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
      setIsInRoom(false);
      setError('Disconnected from server');
    });
    
    newSocket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      setError('Failed to connect to server');
    });
    
    // Room state updates
    newSocket.on('user-joined', ({ userId, userCount }) => {
      console.log('User joined:', userId, 'Total users:', userCount);
      setUsers(prev => [...prev, userId]);
    });
    
    newSocket.on('user-left', ({ userId, userCount }) => {
      console.log('User left:', userId, 'Total users:', userCount);
      setUsers(prev => prev.filter(id => id !== userId));
    });
    
    // Pattern updates from other users
    newSocket.on('pattern-update', (change) => {
      console.log('Pattern update received:', change);
      applyPatternChange(change);
    });
    
    // BPM changes
    newSocket.on('bpm-change', ({ bpm: newBpm }) => {
      console.log('BPM changed to:', newBpm);
      setBpm(newBpm);
    });
    
    // Simple transport sync (no complex timing)
    newSocket.on('transport-sync', (command) => {
      console.log('Transport command received:', command);
      handleTransportCommand(command);
    });
    
    setSocket(newSocket);
    
    return () => {
      console.log('Cleaning up socket connection');
      newSocket.close();
    };
  }, []);

  // Handle transport commands from server (much simpler now)
  const handleTransportCommand = (command) => {
    const scheduler = schedulerRef.current;
    if (!scheduler) return;

    switch (command.type) {
      case 'play':
        scheduler.start(currentTick);
        setIsPlaying(true);
        break;
        
      case 'pause':
        scheduler.pause();
        setIsPlaying(false);
        break;
        
      case 'stop':
        scheduler.stop();
        setIsPlaying(false);
        setCurrentTick(0);
        break;
        
      default:
        console.warn('Unknown transport command:', command.type);
    }
  };

  // Apply pattern changes from server
  const applyPatternChange = (change) => {
    setPattern(prevPattern => {
      const newPattern = { ...prevPattern };
      
      switch (change.type) {
        case 'add-note':
          if (!newPattern[change.trackId]) {
            newPattern[change.trackId] = [];
          }
          if (!newPattern[change.trackId].includes(change.tick)) {
            newPattern[change.trackId] = [...newPattern[change.trackId], change.tick];
          }
          break;
          
        case 'remove-note':
          if (newPattern[change.trackId]) {
            newPattern[change.trackId] = newPattern[change.trackId].filter(
              tick => tick !== change.tick
            );
          }
          break;
          
        case 'move-note':
          if (newPattern[change.trackId]) {
            newPattern[change.trackId] = newPattern[change.trackId]
              .filter(tick => tick !== change.fromTick)
              .concat(change.toTick);
          }
          break;
          
        case 'clear-track':
          newPattern[change.trackId] = [];
          break;
          
        default:
          console.warn('Unknown pattern change type:', change.type);
      }
      
      return newPattern;
    });
  };

  // Send pattern change to server
  const handlePatternChange = (change) => {
    if (!socket || !isInRoom) return;
    
    console.log('Sending pattern change:', change);
    socket.emit('pattern-change', {
      roomId,
      change
    });
  };

  // BPM management
  const changeBpm = (newBpm) => {
    if (!socket || !isInRoom) return;
    
    const clampedBpm = Math.max(60, Math.min(300, newBpm));
    
    console.log('Changing BPM to:', clampedBpm);
    socket.emit('set-bpm', {
      roomId,
      bpm: clampedBpm
    });
  };

  // Transport control handlers (much simpler!)
  const handlePlay = async () => {
    if (!socket || !isInRoom) return;
    
    // Initialize audio context on first play (requires user interaction)
    if (schedulerRef.current) {
      await schedulerRef.current.init();
    }
    
    console.log('Sending play command');
    socket.emit('transport-command', {
      roomId,
      command: { type: 'play' }
    });
  };

  const handlePause = () => {
    if (!socket || !isInRoom) return;
    
    console.log('Sending pause command');
    socket.emit('transport-command', {
      roomId,
      command: { type: 'pause' }
    });
  };

  const handleStop = () => {
    if (!socket || !isInRoom) return;
    
    console.log('Sending stop command');
    socket.emit('transport-command', {
      roomId,
      command: { type: 'stop' }
    });
  };

  // Room management functions
  const createRoom = () => {
    if (!socket || !isConnected) return;
    
    console.log('Creating room...');
    socket.emit('create-room', (response) => {
      if (response.success) {
        console.log('Room created:', response.roomId);
        setRoomId(response.roomId);
        setIsInRoom(true);
        setPattern(response.roomState.pattern);
        setBpm(response.roomState.bpm);
        setUsers(response.roomState.users);
        setError(null);
      } else {
        console.error('Failed to create room:', response.error);
        setError('Failed to create room');
      }
    });
  };

  const joinRoom = (targetRoomId) => {
    if (!socket || !isConnected || !targetRoomId.trim()) return;
    
    console.log('Joining room:', targetRoomId);
    socket.emit('join-room', { roomId: targetRoomId.trim() }, (response) => {
      if (response.success) {
        console.log('Joined room:', targetRoomId);
        setRoomId(targetRoomId.trim());
        setIsInRoom(true);
        setPattern(response.roomState.pattern);
        setBpm(response.roomState.bpm);
        setUsers(response.roomState.users);
        setError(null);
      } else {
        console.error('Failed to join room:', response.error);
        setError(`Failed to join room: ${response.error}`);
      }
    });
  };

  // If not connected or not in room, show connection interface
  if (!isInRoom) {
    return (
      <div className="container-fluid py-4" style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
        {error && (
          <div className="alert alert-danger text-center" role="alert">
            {error}
          </div>
        )}
        <RoomInterface 
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          isConnected={isConnected}
        />
      </div>
    );
  }

  // Main drum machine interface
  return (
    <div className="container-fluid py-4" style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      {/* Header */}
      <div className="row mb-4">
        <div className="col">
          <div className="card">
            <div className="card-body">
              <div className="row align-items-center">
                <div className="col">
                  <h3 className="mb-0">Drum Machine</h3>
                  <small className="text-muted">Room: {roomId}</small>
                </div>
                <div className="col-auto">
                  <span className="badge bg-success me-2">
                    {users.length} user{users.length !== 1 ? 's' : ''} online
                  </span>
                  <span className={`badge ${isConnected ? 'bg-success' : 'bg-danger'}`}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transport Controls */}
      <div className="row">
        <div className="col">
          <TransportControls
            isPlaying={isPlaying}
            currentTick={currentTick}
            bpm={bpm}
            onPlay={handlePlay}
            onPause={handlePause}
            onStop={handleStop}
            TICKS_PER_BEAT={TICKS_PER_BEAT}
            BEATS_PER_LOOP={BEATS_PER_LOOP}
          />
        </div>
      </div>

      {/* Pattern Timeline */}
      <div className="row">
        <div className="col">
          <PatternTimeline
            pattern={pattern}
            bpm={bpm}
            currentTick={currentTick}
            isPlaying={isPlaying}
            snapToGrid={snapToGrid}
            onPatternChange={handlePatternChange}
            onBpmChange={changeBpm}
            onSnapToggle={setSnapToGrid}
            TICKS_PER_BEAT={TICKS_PER_BEAT}
            BEATS_PER_LOOP={BEATS_PER_LOOP}
            PIXELS_PER_TICK={0.1}
          />
        </div>
      </div>
      
      {/* Debug info */}
      <div className="row mt-4">
        <div className="col">
          <div className="card">
            <div className="card-header">
              <h6 className="mb-0">Debug Info</h6>
            </div>
            <div className="card-body">
              <small className="text-muted">
                <strong>Pattern:</strong> {JSON.stringify(pattern, null, 2)}
                <br />
                <strong>Playback:</strong> Playing: {isPlaying}, Tick: {currentTick}
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DrumMachine;