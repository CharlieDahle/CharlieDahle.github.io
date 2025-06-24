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

    // NEW: Dynamic track to sound mapping (replaces hardcoded trackSounds)
    this.trackSounds = {};

    // RAF handle for cleanup
    this.schedulerRAF = null;
  }

  // Initialize audio context and load sounds
  async init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();

      // Resume if suspended (required by some browsers)
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      console.log("DrumScheduler: Audio context initialized");

      return true;
    }
    return true;
  }

  // Set tracks and load their sounds
  async setTracks(tracks) {
    console.log("DrumScheduler: Setting tracks", tracks);

    // Clear existing mappings
    this.trackSounds = {};

    // Build new track sound mappings
    for (const track of tracks) {
      this.trackSounds[track.id] = track.soundFile;

      // Load the sound file if not already loaded
      if (track.soundFile && !this.audioBuffers[track.soundFile]) {
        console.log(`Loading sound for ${track.name}: ${track.soundFile}`);

        // Guard clause: skip loading if no audio context yet
        if (!this.audioContext) {
          console.log("No audio context yet, will load sounds later");
          continue;
        }

        try {
          const audioBuffer = await this.loadAudioFile(track.soundFile);
          if (audioBuffer) {
            this.audioBuffers[track.soundFile] = audioBuffer;
          }
        } catch (error) {
          console.error(`Failed to load sound for track ${track.name}:`, error);
        }
      }
    }

    console.log("DrumScheduler: Track sounds mapped:", this.trackSounds);
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
    console.log("DrumScheduler: BPM set to", this.bpm);
  }

  // Update pattern data
  setPattern(pattern) {
    this.pattern = pattern;
    console.log("DrumScheduler: Pattern updated");
  }

  // Start playback
  async start(fromTick = 0) {
    if (!this.audioContext) {
      await this.init();
    }

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    this.isPlaying = true;
    this.currentTick = fromTick;
    this.nextNoteTime = this.audioContext.currentTime;

    console.log("DrumScheduler: Starting from tick", fromTick);
    this.scheduler();
  }

  // Pause playback (remember position)
  pause() {
    this.isPlaying = false;

    if (this.schedulerRAF) {
      cancelAnimationFrame(this.schedulerRAF);
      this.schedulerRAF = null;
    }

    console.log("DrumScheduler: Paused at tick", this.currentTick);
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

    console.log("DrumScheduler: Stopped");
  }

  // Main scheduler loop
  scheduler() {
    if (!this.isPlaying) return;

    // Calculate time per tick
    const secondsPerBeat = 60.0 / this.bpm;
    const secondsPerTick = secondsPerBeat / this.TICKS_PER_BEAT;

    // Look ahead and schedule any notes that need to play
    while (
      this.nextNoteTime <
      this.audioContext.currentTime + this.scheduleAheadTime
    ) {
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
    // Check each track in the pattern
    Object.keys(this.pattern).forEach((trackId) => {
      if (this.pattern[trackId]?.includes(tick)) {
        const soundFile = this.trackSounds[trackId];
        if (soundFile && this.audioBuffers[soundFile]) {
          this.playSound(soundFile, when);
          console.log(`Playing ${trackId} at tick ${tick}`);
        } else {
          console.warn(`No sound available for track ${trackId}`);
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
      bpm: this.bpm,
      trackSounds: this.trackSounds,
    };
  }

  // Cleanup
  destroy() {
    this.stop();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    console.log("DrumScheduler: Destroyed");
  }
}

export default DrumScheduler;
