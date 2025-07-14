class DrumScheduler {
  constructor(bpm = 120, onTickUpdate = null) {
    // Audio context
    this.audioContext = null;

    // Timing
    this.bpm = bpm;
    this.onTickUpdate = onTickUpdate; // Callback to update transport store

    // Timing constants - now fixed and simple
    this.TICKS_PER_BEAT = 480;
    this.BEATS_PER_MEASURE = 4;
    this.TOTAL_MEASURES = 4; // Will be updated dynamically

    // Playback state
    this.isPlaying = false;
    this.currentTick = 0;
    this.nextNoteTime = 0;

    // Scheduling parameters
    this.lookahead = 25.0;
    this.scheduleAheadTime = 0.1;

    // Pattern and track data
    this.pattern = {};
    this.trackSounds = {}; // trackId -> soundFile mapping
    this.audioBuffers = {}; // soundFile -> AudioBuffer mapping

    // RAF handle for cleanup
    this.schedulerRAF = null;
  }

  // ============ INITIALIZATION ============

  async init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();

      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      console.log("DrumScheduler: Audio context initialized");
      return true;
    }
    return true;
  }

  // ============ TIMING HELPERS ============

  getTotalTicks() {
    return this.TICKS_PER_BEAT * this.BEATS_PER_MEASURE * this.TOTAL_MEASURES;
  }

  getSecondsPerTick() {
    const secondsPerBeat = 60.0 / this.bmp;
    return secondsPerBeat / this.TICKS_PER_BEAT;
  }

  // ============ AUDIO BUFFER MANAGEMENT ============

  async loadAudioFile(filePath) {
    try {
      const response = await fetch(`/sounds/${filePath}`);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      return audioBuffer;
    } catch (error) {
      console.error(`Failed to load audio file: ${filePath}`, error);
      return null;
    }
  }

  async setTracks(tracks) {
    console.log("DrumScheduler: Setting tracks", tracks);

    // Clear old mappings
    this.trackSounds = {};

    // Map tracks to their sounds and load new audio files
    for (const track of tracks) {
      this.trackSounds[track.id] = track.soundFile;

      // Load audio buffer if not already loaded
      if (track.soundFile && !this.audioBuffers[track.soundFile]) {
        if (!this.audioContext) {
          console.log("No audio context yet, will load sounds later");
          continue;
        }

        try {
          console.log(`Loading sound for ${track.name}: ${track.soundFile}`);
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

  // ============ PATTERN AND TIMING UPDATES ============

  setPattern(pattern) {
    this.pattern = pattern;
    console.log("DrumScheduler: Pattern updated");
  }

  setBpm(newBpm) {
    this.bpm = Math.max(60, Math.min(300, newBpm));
    console.log("DrumScheduler: BPM set to", this.bpm);
  }

  setMeasureCount(measureCount) {
    this.TOTAL_MEASURES = Math.max(1, Math.min(16, measureCount));
    console.log("DrumScheduler: Measure count set to", this.TOTAL_MEASURES);
  }

  // ============ AUDIO PLAYBACK ============

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

  // ============ TRANSPORT CONTROL ============

  async start(fromTick = 0) {
    console.log(`DrumScheduler: Starting from tick ${fromTick}`);

    if (!this.audioContext) {
      await this.init();
    }

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    this.isPlaying = true;
    this.currentTick = fromTick;
    this.nextNoteTime = this.audioContext.currentTime;

    this.scheduler();
  }

  pause() {
    console.log("DrumScheduler: Pausing");
    this.isPlaying = false;

    if (this.schedulerRAF) {
      cancelAnimationFrame(this.schedulerRAF);
      this.schedulerRAF = null;
    }
  }

  stop() {
    console.log("DrumScheduler: Stopping");
    this.isPlaying = false;
    this.currentTick = 0;

    if (this.schedulerRAF) {
      cancelAnimationFrame(this.schedulerRAF);
      this.schedulerRAF = null;
    }

    // Update transport store immediately
    if (this.onTickUpdate) {
      this.onTickUpdate(0);
    }
  }

  // ============ MAIN SCHEDULER LOOP ============

  scheduler() {
    if (!this.isPlaying) return;

    const secondsPerTick = this.getSecondsPerTick();

    // Look ahead and schedule any notes that need to play
    while (
      this.nextNoteTime <
      this.audioContext.currentTime + this.scheduleAheadTime
    ) {
      this.scheduleNotesAtTick(this.currentTick, this.nextNoteTime);
      this.advanceTick();
    }

    // Update transport store with current tick (for playhead)
    if (this.onTickUpdate) {
      this.onTickUpdate(this.currentTick);
    }

    // Schedule next update
    this.schedulerRAF = requestAnimationFrame(() => this.scheduler());
  }

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

  advanceTick() {
    const secondsPerTick = this.getSecondsPerTick();
    const totalTicks = this.getTotalTicks();

    this.nextNoteTime += secondsPerTick;
    this.currentTick = (this.currentTick + 1) % totalTicks;
  }

  // ============ STATE QUERIES ============

  getState() {
    return {
      isPlaying: this.isPlaying,
      currentTick: this.currentTick,
      bpm: this.bmp,
      measureCount: this.TOTAL_MEASURES,
      trackSounds: this.trackSounds,
    };
  }

  // ============ CLEANUP ============

  destroy() {
    this.stop();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    // Clear audio buffers
    this.audioBuffers = {};
    this.trackSounds = {};

    console.log("DrumScheduler: Destroyed");
  }
}

export default DrumScheduler;
