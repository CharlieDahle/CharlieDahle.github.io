import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import io from 'socket.io-client';
import drumSoundsData from './drum-sounds.json';
import DrumGrid from './DrumGrid.jsx';
import TransportControls from './TransportControls.jsx';
import CollaborativePanel from './CollaborativePanel.jsx';
import './DrumMachine.css'; 


const TICKS_PER_BEAT = 480;
const BEATS_PER_LOOP = 4;
const TOTAL_TICKS = TICKS_PER_BEAT * BEATS_PER_LOOP;

const SOUND_LIBRARY = drumSoundsData;

function DrumMachine() {
  // Mode and connection state
  const [mode, setMode] = useState('solo');
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // Core drum state
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTick, setCurrentTick] = useState(0);
  const [tracks, setTracks] = useState([]);
  const [loadedSounds, setLoadedSounds] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  
  // Solo mode refs
  const intervalRef = useRef(null);
  const audioContextRef = useRef(null);

  // Initialize audio and load sounds (both modes need this)
  useEffect(() => {
    initializeAudio();
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Handle mode switching
  useEffect(() => {
    if (mode === 'collaborative') {
      connectToServer();
    } else {
      disconnectFromServer();
    }
    
    return () => {
      disconnectFromServer();
    };
  }, [mode]);

  // Solo mode playback loop
  useEffect(() => {
    if (mode === 'solo' && isPlaying) {
      const tickInterval = (60 / bpm / TICKS_PER_BEAT) * 1000;
      
      intervalRef.current = setInterval(() => {
        setCurrentTick(prevTick => {
          const nextTick = (prevTick + 1) % TOTAL_TICKS;
          playTickSounds(nextTick);
          return nextTick;
        });
      }, tickInterval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [mode, isPlaying, bpm, tracks]);

  const initializeAudio = async () => {
    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      await loadAudioFiles();
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      setIsLoading(false);
    }
  };

  const loadAudioFiles = async () => {
    try {
      const sounds = {};
      
      for (const [category, soundList] of Object.entries(SOUND_LIBRARY)) {
        for (const sound of soundList) {
          sounds[sound.file] = {
            name: sound.name,
            buffer: null,
            category
          };
        }
      }
      
      setLoadedSounds(sounds);
      setIsLoading(false);
      console.log('Loaded sounds:', Object.keys(sounds));
    } catch (error) {
      console.error('Failed to load audio files:', error);
      setIsLoading(false);
    }
  };

  const connectToServer = () => {
    try {
      const newSocket = io('http://localhost:3001');
      
      newSocket.on('connect', () => {
        console.log('Connected to server');
        setConnectionStatus('connected');
        setSocket(newSocket);
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from server');
        setConnectionStatus('disconnected');
        setSocket(null);
        setRoomId('');
        setConnectedUsers([]);
      });

      newSocket.on('room-state', (state) => {
        console.log('Received room state:', state);
        setBpm(state.bpm);
        setIsPlaying(state.isPlaying);
        setCurrentTick(state.currentTick);
        setTracks(state.tracks);
        setConnectedUsers(state.users || []);
      });

      newSocket.on('tick-sync', (data) => {
        setCurrentTick(data.tick);
        if (data.tick === 0 || data.tick % TICKS_PER_BEAT === 0) {
          playTickSounds(data.tick);
        }
      });

      newSocket.on('drum-action', (action) => {
        console.log('Received action:', action);
        handleServerAction(action);
      });

      newSocket.on('user-joined', (data) => {
        console.log('User joined:', data.userId);
        // Update the user list when someone joins
        setConnectedUsers(prev => {
          if (!prev.find(user => user.id === data.userId)) {
            return [...prev, { id: data.userId, ...data }];
          }
          return prev;
        });
      });

      newSocket.on('user-left', (data) => {
        console.log('User left:', data.userId);
        // Update the user list when someone leaves
        setConnectedUsers(prev => prev.filter(user => user.id !== data.userId));
      });

      newSocket.on('users-updated', (users) => {
        console.log('Users list updated:', users);
        // Handle direct user list updates from server
        setConnectedUsers(users || []);
      });

    } catch (error) {
      console.error('Failed to connect to server:', error);
      setConnectionStatus('error');
    }
  };

  const disconnectFromServer = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setConnectionStatus('disconnected');
      setRoomId('');
      setConnectedUsers([]);
    }
  };

  const handleServerAction = (action) => {
    switch (action.type) {
      case 'PLAY':
        setIsPlaying(true);
        break;
      case 'PAUSE':
        setIsPlaying(false);
        break;
      case 'STOP':
        setIsPlaying(false);
        setCurrentTick(0);
        break;
      case 'SET_BPM':
        setBpm(action.payload.bpm);
        break;
      default:
        break;
    }
  };

  const playTickSounds = (tick) => {
    tracks.forEach(track => {
      const beat = track.beats.find(b => b.tick === tick);
      if (beat) {
        playSound(track.soundId, beat.velocity);
      }
    });
  };

  const playSound = (soundId, velocity = 127) => {
    console.log(`Playing ${soundId} at velocity ${velocity}`);
  };

  // Action handlers
  const handlePlay = () => {
    if (mode === 'solo') {
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
      setIsPlaying(true);
    } else if (socket && roomId) {
      socket.emit('drum-action', {
        roomId,
        action: { type: 'PLAY' }
      });
    }
  };

  const handlePause = () => {
    if (mode === 'solo') {
      setIsPlaying(false);
    } else if (socket && roomId) {
      socket.emit('drum-action', {
        roomId,
        action: { type: 'PAUSE' }
      });
    }
  };

  const handleStop = () => {
    if (mode === 'solo') {
      setIsPlaying(false);
      setCurrentTick(0);
    } else if (socket && roomId) {
      socket.emit('drum-action', {
        roomId,
        action: { type: 'STOP' }
      });
    }
  };

  const handleBpmChange = (newBpm) => {
    if (mode === 'solo') {
      setBpm(newBpm);
    } else if (socket && roomId) {
      socket.emit('drum-action', {
        roomId,
        action: { type: 'SET_BPM', payload: { bpm: newBpm } }
      });
    }
  };

  const addTrack = (soundId) => {
    if (mode === 'solo') {
      const newTrack = {
        id: `track-${Date.now()}`,
        soundId,
        beats: []
      };
      setTracks(prev => [...prev, newTrack]);
    } else if (socket && roomId) {
      socket.emit('drum-action', {
        roomId,
        action: { type: 'ADD_TRACK', payload: { soundId } }
      });
    }
  };

  const removeTrack = (trackId) => {
    if (mode === 'solo') {
      setTracks(prev => prev.filter(track => track.id !== trackId));
    } else if (socket && roomId) {
      socket.emit('drum-action', {
        roomId,
        action: { type: 'REMOVE_TRACK', payload: { trackId } }
      });
    }
  };

  const toggleBeat = (trackId, tick, velocity) => {
    if (mode === 'solo') {
      setTracks(prev => prev.map(track => {
        if (track.id === trackId) {
          const existingBeatIndex = track.beats.findIndex(beat => beat.tick === tick);
          
          if (existingBeatIndex >= 0) {
            return {
              ...track,
              beats: track.beats.filter((_, index) => index !== existingBeatIndex)
            };
          } else {
            return {
              ...track,
              beats: [...track.beats, { tick, velocity }]
            };
          }
        }
        return track;
      }));
    } else if (socket && roomId) {
      socket.emit('drum-action', {
        roomId,
        action: { 
          type: 'TOGGLE_BEAT', 
          payload: { trackId, tick, velocity } 
        }
      });
    }
  };

  // Add subdivision state and handler
  // const [subdivision, setSubdivision] = useState('sixteenth');

  // const handleSubdivisionChange = (newSubdivision) => {
  //   console.log('Subdivision changed to:', newSubdivision);
  //   setSubdivision(newSubdivision);
  // };

  // Room management
  const createRoom = () => {
    if (socket) {
      socket.emit('create-room', (response) => {
        if (response.success) {
          setRoomId(response.roomId);
          // Server now sends back the user list including the creator
          setConnectedUsers(response.users || []);
          console.log('Created room:', response.roomId, 'Users:', response.users);
        } else {
          console.error('Failed to create room:', response.error);
        }
      });
    }
  };

  const joinRoom = (roomIdToJoin) => {
    if (socket && roomIdToJoin) {
      socket.emit('join-room', { roomId: roomIdToJoin }, (response) => {
        if (response.success) {
          setRoomId(roomIdToJoin);
          // Server now sends back the user list including all users
          setConnectedUsers(response.users || []);
          console.log('Joined room:', roomIdToJoin, 'Users:', response.users);
        } else {
          console.error('Failed to join room:', response.error);
          alert('Failed to join room: ' + response.error);
        }
      });
    }
  };

  if (isLoading) {
    return (
      <div className="drum-machine-container">
        <div className="d-flex justify-content-center align-items-center" style={{minHeight: '50vh'}}>
          <div className="text-center">
            <div className="spinner-border text-primary mb-3" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <h4 className="text-secondary">Loading drum sounds...</h4>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="drum-machine-container">
      <h1 className="main-header">🥁 Drum Machine</h1>
      
      {/* Mode Selection Card */}
      <div className="mode-selection-card">
        <h5 className="mb-3">Choose Mode</h5>
        <div>
          <button
            onClick={() => setMode('solo')}
            className={`btn mode-btn ${mode === 'solo' ? 'active' : ''}`}
          >
            Solo Mode
          </button>
          <button
            onClick={() => setMode('collaborative')}
            className={`btn mode-btn ${mode === 'collaborative' ? 'active' : ''}`}
          >
            Collaborative Mode
          </button>
        </div>
      </div>

      {/* Collaborative Mode */}
      {mode === 'collaborative' && (
        <CollaborativePanel
          connectionStatus={connectionStatus}
          roomId={roomId}
          connectedUsers={connectedUsers}
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
        />
      )}

      {/* Transport Controls */}
      <TransportControls
        isPlaying={isPlaying}
        bpm={bpm}
        currentTick={currentTick}
        totalTicks={TOTAL_TICKS}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onBpmChange={handleBpmChange}
        disabled={mode === 'collaborative' && !roomId}
      />

      {/* Add Track Card */}
      <div className="add-track-card">
        <h5 className="mb-3">Add Track</h5>
        <div className="add-track-grid">
          {Object.entries(loadedSounds).slice(0, 8).map(([soundId, sound]) => (
            <button
              key={soundId}
              onClick={() => addTrack(soundId)}
              disabled={mode === 'collaborative' && !roomId}
              className="btn add-track-btn"
            >
              <Plus size={16} className="me-2" />
              {sound.name}
            </button>
          ))}
        </div>
      </div>

      {/* Tracks */}
      <div className="tracks-container">
        {tracks.map(track => (
          <div key={track.id} className="track-card">
            <div className="track-info">
              <div className="track-name">{loadedSounds[track.soundId]?.name}</div>
              <div className="track-beats">{track.beats.length} beats</div>
            </div>
            
            <div className="track-grid-container">
              <DrumGrid
                track={track}
                currentTick={currentTick}
                onToggleBeat={(tick, velocity) => toggleBeat(track.id, tick, velocity)}
                disabled={mode === 'collaborative' && !roomId}
              />
            </div>
            
            <div className="track-actions">
              <button
                onClick={() => removeTrack(track.id)}
                disabled={mode === 'collaborative' && !roomId}
                className="btn remove-track-btn"
                title="Remove Track"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {tracks.length === 0 && (
        <div className="empty-state">
          <h4>🎵 Ready to Create</h4>
          <p>Add some tracks above to start building your beat!</p>
        </div>
      )}
    </div>
  );
}

export default DrumMachine;