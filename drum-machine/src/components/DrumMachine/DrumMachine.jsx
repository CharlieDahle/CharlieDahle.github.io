import React, { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import RoomInterface from '../RoomInterface/RoomInterface.jsx';
import PatternTimeline from '../PatternTimeline/PatternTimeline';
import TransportControls from '../TransportControls/TransportControls';
import DrumScheduler from '../DrumScheduler/DrumScheduler';

function DrumMachine() {
  // Use the WebSocket hook
  const {
    isConnected,
    isInRoom,
    roomId,
    users,
    error,
    createRoom,
    joinRoom,
    sendPatternChange,
    setBpm: sendBpmChange,
    sendTransportCommand,
    subscribe,
    unsubscribe
  } = useWebSocket();
  
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

  // Subscribe to WebSocket events
  useEffect(() => {
    // Pattern updates from other users
    subscribe('onPatternUpdate', (change) => {
      console.log('Pattern update received:', change);
      applyPatternChange(change);
    });

    // BPM changes
    subscribe('onBpmChange', (newBpm) => {
      console.log('BPM changed to:', newBpm);
      setBpm(newBpm);
    });

    // Transport sync
    subscribe('onTransportSync', (command) => {
      console.log('Transport command received:', command);
      handleTransportCommand(command);
    });

    return () => {
      unsubscribe('onPatternUpdate');
      unsubscribe('onBpmChange');
      unsubscribe('onTransportSync');
    };
  }, []);

  // Handle transport commands from server
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

  const handlePatternChange = (change) => {
    sendPatternChange(change);
  };

  const changeBpm = (newBpm) => {
    sendBpmChange(newBpm);
  };

  const handlePlay = async () => {
    // Initialize audio context on first play
    if (schedulerRef.current) {
      await schedulerRef.current.init();
    }
    
    sendTransportCommand({ type: 'play' });
  };

  const handlePause = () => {
    sendTransportCommand({ type: 'pause' });
  };

  const handleStop = () => {
    sendTransportCommand({ type: 'stop' });
  };

  // Room management 
  const handleCreateRoom = async () => {
    try {
      const roomState = await createRoom();
      setPattern(roomState.pattern);
      setBpm(roomState.bpm);
    } catch (error) {
      console.error('Failed to create room:', error);
    }
  };

  const handleJoinRoom = async (targetRoomId) => {
    try {
      const roomState = await joinRoom(targetRoomId);
      setPattern(roomState.pattern);
      setBpm(roomState.bpm);
    } catch (error) {
      console.error('Failed to join room:', error);
    }
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
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
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