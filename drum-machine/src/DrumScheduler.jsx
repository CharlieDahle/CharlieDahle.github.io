class DrumScheduler {
  constructor(bpm = 120, onTickUpdate = null) {
    this.audioContext = null;
    this.bpm = bpm;
    this.onTickUpdate = onTickUpdate; // Callback to update React state
    
    // Timing constants
    this.TICKS_PER_BEAT = 480;
    this.BEATS_PER_LOOP = 16;
    this.TOTAL_TICKS = this.TICKS_PER_BEAT * this.BEATS_PER_LOOP;
    
    // Playback state
    this.isPlaying = false;
    this.currentTick = 0;
    this.nextNoteTime = 0;
    
    // Scheduling parameters
    this.lookahead = 25.0; // How frequently to call scheduler (ms)
    this.scheduleAheadTime = 0.1; // How far ahead to schedule audio (seconds)
    
    // Pattern data (will be set from React state)
    this.pattern = {};
    
    // Audio buffers for loaded sounds
    this.audioBuffers = {};
    this.soundsLoaded = false;
    
    // Simple track to sound mapping
    this.trackSounds = {
      'kick': null,
      'snare': null, 
      'hihat': null,
      'openhat': null
    };
    
    // RAF handle for cleanup
    this.schedulerRAF = null;
  }

  // Initialize audio context and load sounds
  async init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Resume if suspended (required by some browsers)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      console.log('DrumScheduler: Audio context initialized');
      
      // Load drum sounds
      await this.loadSounds();
      
      return true;
    }
    return true;
  }

  // Load drum sounds from JSON and audio files
  async loadSounds() {
    try {
      // Import the JSON file
      const soundLibrary = await import('./drum-sounds.json');
      
      console.log('DrumScheduler: Loading sounds...');
      
      // Pick default sounds for each track (first sound from each category)
      const defaultSounds = {
        'kick': soundLibrary.kicks?.[0]?.file,
        'snare': soundLibrary.snares?.[0]?.file,
        'hihat': soundLibrary.hihats?.[0]?.file,
        'openhat': soundLibrary.cymbals?.[0]?.file
      };
      
      // Load audio files for default sounds
      for (const [trackId, soundFile] of Object.entries(defaultSounds)) {
        if (soundFile) {
          console.log(`Loading ${trackId}: ${soundFile}`);
          const audioBuffer = await this.loadAudioFile(soundFile);
          this.audioBuffers[soundFile] = audioBuffer;
          this.trackSounds[trackId] = soundFile;
        }
      }
      
      this.soundsLoaded = true;
      console.log('DrumScheduler: All sounds loaded successfully');
      
    } catch (error) {
      console.error('DrumScheduler: Failed to load sounds:', error);
      this.soundsLoaded = false;
    }
  }

  // Load individual audio file into AudioBuffer
  async loadAudioFile(filePath) {
    try {
      const response = await fetch(filePath);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      return audioBuffer;
    } catch (error) {
      console.error(`Failed to load audio file: ${filePath}`, error);
      return null;
    }
  }

  // Play a sound at a specific time
  playSound(soundFile, when) {
    if (!this.audioContext || !this.audioBuffers[soundFile]) {
      return;
    }

    const audioBuffer = this.audioBuffers[soundFile];
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    source.start(when);
  }

  // Update BPM
  setBpm(newBpm) {
    this.bpm = Math.max(60, Math.min(300, newBpm));
    console.log('DrumScheduler: BPM set to', this.bpm);
  }

  // Update pattern data
  setPattern(pattern) {
    this.pattern = pattern;
    console.log('DrumScheduler: Pattern updated');
  }

  // Start playback
  async start(fromTick = 0) {
    if (!this.audioContext) {
      await this.init();
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.isPlaying = true;
    this.currentTick = fromTick;
    this.nextNoteTime = this.audioContext.currentTime;
    
    console.log('DrumScheduler: Starting from tick', fromTick);
    this.scheduler();
  }

  // Pause playback (remember position)
  pause() {
    this.isPlaying = false;
    
    if (this.schedulerRAF) {
      cancelAnimationFrame(this.schedulerRAF);
      this.schedulerRAF = null;
    }
    
    console.log('DrumScheduler: Paused at tick', this.currentTick);
  }

  // Stop playback (reset to beginning)
  stop() {
    this.isPlaying = false;
    this.currentTick = 0;
    
    if (this.schedulerRAF) {
      cancelAnimationFrame(this.schedulerRAF);
      this.schedulerRAF = null;
    }
    
    // Update React state immediately
    if (this.onTickUpdate) {
      this.onTickUpdate(0);
    }
    
    console.log('DrumScheduler: Stopped');
  }

  // Main scheduler loop
  scheduler() {
    if (!this.isPlaying) return;

    // Calculate time per tick
    const secondsPerBeat = 60.0 / this.bpm;
    const secondsPerTick = secondsPerBeat / this.TICKS_PER_BEAT;

    // Look ahead and schedule any notes that need to play
    while (this.nextNoteTime < this.audioContext.currentTime + this.scheduleAheadTime) {
      this.scheduleNotesAtTick(this.currentTick, this.nextNoteTime);
      this.advanceTick();
    }

    // Update React state with current tick (for playhead)
    if (this.onTickUpdate) {
      this.onTickUpdate(this.currentTick);
    }

    // Schedule next update
    this.schedulerRAF = requestAnimationFrame(() => this.scheduler());
  }

  // Schedule any notes that should play at this tick
  scheduleNotesAtTick(tick, when) {
    if (!this.soundsLoaded) return;

    // Check each track and play if there's a note at this tick
    Object.keys(this.pattern).forEach(trackId => {
      if (this.pattern[trackId]?.includes(tick)) {
        const soundFile = this.trackSounds[trackId];
        if (soundFile) {
          this.playSound(soundFile, when);
          console.log(`Playing ${trackId} at tick ${tick}`);
        }
      }
    });
  }

  // Advance to next tick
  advanceTick() {
    const secondsPerBeat = 60.0 / this.bpm;
    const secondsPerTick = secondsPerBeat / this.TICKS_PER_BEAT;
    
    this.nextNoteTime += secondsPerTick;
    this.currentTick = (this.currentTick + 1) % this.TOTAL_TICKS;
  }

  // Get current playback state
  getState() {
    return {
      isPlaying: this.isPlaying,
      currentTick: this.currentTick,
      bpm: this.bpm
    };
  }

  // Cleanup
  destroy() {
    this.stop();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    console.log('DrumScheduler: Destroyed');
  }
}

export default DrumScheduler;