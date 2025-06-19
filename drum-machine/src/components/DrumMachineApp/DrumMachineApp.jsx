import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket'
import RoomInterface from '../RoomInterface/RoomInterface.jsx';
import DrumMachine from '../DrumMachine/DrumMachine.jsx';

function DrumMachineApp() {
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
  
  // Server state that gets synced
  const [pattern, setPattern] = useState({});
  const [bpm, setBpm] = useState(120);

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

    // We don't handle transport sync here since that's local to DrumMachine
    // Transport commands need to be handled by the audio engine directly

    return () => {
      unsubscribe('onPatternUpdate');
      unsubscribe('onBpmChange');
    };
  }, [subscribe, unsubscribe]);

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

  // Handlers for DrumMachine callbacks
  const handlePatternChange = (change) => {
    // Optimistically update local state
    applyPatternChange(change);
    // Send to server
    sendPatternChange(change);
  };

  const handleBpmChange = (newBpm) => {
    // Optimistically update local state
    setBpm(newBpm);
    // Send to server
    sendBpmChange(newBpm);
  };

  const handleTransportCommand = (command) => {
    // Just pass through to server - DrumMachine will handle local audio
    sendTransportCommand(command);
  };

  // Room management handlers
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

  // Render the drum machine with server state
  return (
    <DrumMachine 
      roomId={roomId}
      userCount={users.length}
      initialPattern={pattern}
      initialBpm={bpm}
      onPatternChange={handlePatternChange}
      onBpmChange={handleBpmChange}
      onTransportCommand={handleTransportCommand}
    />
  );
}

export default DrumMachineApp;