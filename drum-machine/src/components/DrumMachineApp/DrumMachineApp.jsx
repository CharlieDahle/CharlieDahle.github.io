import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebSocket } from '../../hooks/useWebSocket';
import RoomInterface from '../RoomInterface/RoomInterface.jsx';
import DrumMachine from '../DrumMachine/DrumMachine.jsx';
import drumSounds from '../../assets/data/drum-sounds.json';

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
  
 // Track state. we start with a few defaults
  const [tracks, setTracks] = useState([
    {
      id: 'kick',
      name: 'Kick',
      color: '#e74c3c',
      soundFile: drumSounds.kicks[0].file,
      availableSounds: drumSounds.kicks
    },
    {
      id: 'snare',
      name: 'Snare',
      color: '#f39c12',
      soundFile: drumSounds.snares[0].file,
      availableSounds: drumSounds.snares
    },
    {
      id: 'hihat',
      name: 'Hi-Hat',
      color: '#2ecc71',
      soundFile: drumSounds.hihats[0].file,
      availableSounds: drumSounds.hihats
    },
    {
      id: 'openhat',
      name: 'Open Hat',
      color: '#3498db',
      soundFile: drumSounds.cymbals[0].file,
      availableSounds: drumSounds.cymbals
    }
  ]);

  // Animation variants (same as AnimatedPage)
  const pageVariants = {
    initial: { 
      scale: 0.8, 
      opacity: 0,
      y: 50
    },
    in: { 
      scale: 1, 
      opacity: 1,
      y: 0
    },
    out: { 
      scale: 0.8, 
      opacity: 0,
      y: -50
    }
  };

  const pageTransition = {
    type: "spring",
    stiffness: 100,
    damping: 15,
    mass: 0.8
  };

  // Subscribe to WebSocket events
  useEffect(() => {
    // Pattern updates from other users
    subscribe('onPatternUpdate', (change) => {
      console.log('Pattern update received:', change);
      console.log('Current state of pattern:', pattern)
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

  // NEW: Track management handlers
  const handleAddTrack = (trackData) => {
    const newTrack = {
      id: `track_${Date.now()}`, // Simple unique ID
      name: trackData.name || 'New Track',
      color: trackData.color || '#9b59b6',
      soundFile: trackData.soundFile,
      availableSounds: trackData.availableSounds || []
    };
    
    setTracks(prevTracks => [...prevTracks, newTrack]);
  };

  const handleRemoveTrack = (trackId) => {
    setTracks(prevTracks => prevTracks.filter(track => track.id !== trackId));
    
    // Clean up pattern data for removed track
    setPattern(prevPattern => {
      const newPattern = { ...prevPattern };
      delete newPattern[trackId];
      return newPattern;
    });
  };

  const handleUpdateTrackSound = (trackId, newSoundFile) => {
    setTracks(prevTracks => 
      prevTracks.map(track => 
        track.id === trackId 
          ? { ...track, soundFile: newSoundFile }
          : track
      )
    );
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
      <AnimatePresence mode="wait">
        <motion.div
          key="room-interface"
          initial="initial"
          animate="in"
          exit="out"
          variants={pageVariants}
          transition={pageTransition}
          style={{
            width: '100%',
            minHeight: '100vh'
          }}
        >
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
        </motion.div>
      </AnimatePresence>
    );
  }

  // Render the drum machine with server state
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="drum-machine"
        initial="initial"
        animate="in"
        exit="out"
        variants={pageVariants}
        transition={pageTransition}
        style={{
          width: '100%',
          minHeight: '100vh'
        }}
      >
        <DrumMachine 
          roomId={roomId}
          userCount={users.length}
          initialPattern={pattern}
          initialBpm={bpm}
          tracks={tracks}
          onPatternChange={handlePatternChange}
          onBpmChange={handleBpmChange}
          onTransportCommand={handleTransportCommand}
          onAddTrack={handleAddTrack}
          onRemoveTrack={handleRemoveTrack}
          onUpdateTrackSound={handleUpdateTrackSound}
        />
      </motion.div>
    </AnimatePresence>
  );
}

export default DrumMachineApp;