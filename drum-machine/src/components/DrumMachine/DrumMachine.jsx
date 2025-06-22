import React, { useState, useEffect, useRef } from 'react';
import PatternTimeline from '../PatternTimeline/PatternTimeline';
import TransportControls from '../TransportControls/TransportControls';
import DrumScheduler from '../DrumScheduler/DrumScheduler';

function DrumMachine({ 
  roomId, 
  userCount, 
  initialPattern, 
  initialBpm,
  tracks, // NEW: dynamic tracks
  onPatternChange, 
  onBpmChange, 
  onTransportCommand,
  onAddTrack, // NEW: track management handlers
  onRemoveTrack,
  onUpdateTrackSound
}) {
  // Local pattern state (synced with server via props)
  const [pattern, setPattern] = useState(initialPattern);
  const [bpm, setBpm] = useState(initialBpm);
  
  // Local playback state (managed by scheduler)
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTick, setCurrentTick] = useState(0);
  
  // UI state
  const [snapToGrid, setSnapToGrid] = useState(true);
  
  // Scheduler instance
  const schedulerRef = useRef(null);

  // Constants
  const TICKS_PER_BEAT = 480;
  const BEATS_PER_LOOP = 16;

  // Sync props to local state when they change
  useEffect(() => {
    setPattern(initialPattern);
  }, [initialPattern]);

  useEffect(() => {
    setBpm(initialBpm);
  }, [initialBpm]);

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

  // Update scheduler when pattern, BPM, or tracks change
  useEffect(() => {
    if (schedulerRef.current) {
      schedulerRef.current.setPattern(pattern);
      schedulerRef.current.setBpm(bpm);
      // NEW: Update scheduler with current tracks
      schedulerRef.current.setTracks(tracks);
    }
  }, [pattern, bpm, tracks]);

  // Handle pattern changes (update local state and notify parent)
  const handlePatternChange = (change) => {
    // Check if track still exists (in case it was removed)
    const trackExists = tracks.some(track => track.id === change.trackId);
    if (!trackExists) {
      console.warn('Pattern change for non-existent track:', change.trackId);
      return;
    }

    // Update local state immediately for responsive UI
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

    // Notify parent
    onPatternChange(change);
  };

  // Handle BPM changes
  const changeBpm = (newBpm) => {
    setBpm(newBpm);
    onBpmChange(newBpm);
  };

  // Transport control handlers
  const handlePlay = async () => {
    // Initialize audio context on first play
    if (schedulerRef.current) {
      await schedulerRef.current.init();
    }
    
    // Update local state immediately
    setIsPlaying(true);
    
    // Start local playback
    if (schedulerRef.current) {
      await schedulerRef.current.start(currentTick);
    }
    
    // Notify server
    onTransportCommand({ type: 'play' });
  };

  const handlePause = () => {
    // Update local state immediately
    setIsPlaying(false);
    
    // Pause local playback
    if (schedulerRef.current) {
      schedulerRef.current.pause();
    }
    
    // Notify server
    onTransportCommand({ type: 'pause' });
  };

  const handleStop = () => {
    // Update local state immediately
    setIsPlaying(false);
    setCurrentTick(0);
    
    // Stop local playback
    if (schedulerRef.current) {
      schedulerRef.current.stop();
    }
    
    // Notify server
    onTransportCommand({ type: 'stop' });
  };

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
                    {userCount} user{userCount !== 1 ? 's' : ''} online
                  </span>
                  <span className="badge bg-success">
                    Connected
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
            tracks={tracks} // NEW: pass dynamic tracks
            onPatternChange={handlePatternChange}
            onBpmChange={changeBpm}
            onSnapToggle={setSnapToGrid}
            onAddTrack={onAddTrack} // NEW: pass track management handlers
            onRemoveTrack={onRemoveTrack}
            onUpdateTrackSound={onUpdateTrackSound}
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
                <strong>Tracks:</strong> {tracks.map(t => t.name).join(', ')}
                <br />
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