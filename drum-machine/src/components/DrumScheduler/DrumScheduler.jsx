class DrumScheduler {
  constructor(bpm = 120, onTickUpdate = null, transportStore = null) {
    this.audioContext = null;
    this.bpm = bpm;
    this.onTickUpdate = onTickUpdate;
    this.transportStore = transportStore; // Reference to get dynamic constants

    // Playback state
    this.isPlaying = false;
    this.currentTick = 0;
    this.nextNoteTime = 0;

    // Scheduling parameters
    this.lookahead = 25.0;
    this.scheduleAheadTime = 0.1;

    // Pattern data
    this.pattern = {};

    // Audio buffers for loaded sounds
    this.audioBuffers = {};
    this.soundsLoaded = false;

    // Dynamic track to sound mapping
    this.trackSounds = {};

    // RAF handle for cleanup
    this.schedulerRAF = null;
  }

  // Helper to get current timing constants from store
  getTimingConstants() {
    if (this.transportStore) {
      const state = this.transportStore.getState();
      return {
        TICKS_PER_BEAT: state.TICKS_PER_BEAT,
        BEATS_PER_LOOP: state.BEATS_PER_LOOP,
        TOTAL_TICKS: state.getTotalTicks(),
      };
    }
    // Fallback to hardcoded values if no store
    return {
      TICKS_PER_BEAT: 480,
      BEATS_PER_LOOP: 16,
      TOTAL_TICKS: 480 * 16,
    };
  }

  // Initialize audio context and load sounds
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

  // Set tracks and load their sounds
  async setTracks(tracks) {
    console.log("DrumScheduler: Setting tracks", tracks);

    this.trackSounds = {};

    for (const track of tracks) {
      this.trackSounds[track.id] = track.soundFile;

      if (track.soundFile && !this.audioBuffers[track.soundFile]) {
        console.log(`Loading sound for ${track.name}: ${track.soundFile}`);

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

  // Play a sound at a specific time with velocity
  playSound(soundFile, when, velocity = 4) {
    if (!this.audioContext || !this.audioBuffers[soundFile]) {
      return;
    }

    const audioBuffer = this.audioBuffers[soundFile];
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;

    // Create gain node for velocity control
    const gainNode = this.audioContext.createGain();

    // Convert velocity (1-4) to gain (0.25-1.0)
    const velocityGain = velocity / 4;
    gainNode.gain.value = velocityGain;

    // Connect: source -> gain -> destination
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

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
    console.log(`🔊 Scheduler.start() called:`, {
      currentlyPlaying: this.isPlaying,
      fromTick,
      audioContextState: this.audioContext?.state,
    });

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

    console.log(
      `🔊 Scheduler.start() completed - now playing:`,
      this.isPlaying
    );
  }

  // Pause playback (remember position)
  pause() {
    console.log(`🔊 Scheduler.pause() called - was playing:`, this.isPlaying);

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
    const { TICKS_PER_BEAT } = this.getTimingConstants();
    const secondsPerTick = secondsPerBeat / TICKS_PER_BEAT;

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

  // Helper to normalize note data (handles both old and new formats)
  normalizeNote(noteData) {
    if (typeof noteData === "number") {
      // Old format: just a tick number
      return { tick: noteData, velocity: 4 };
    }
    // New format: already an object with tick and velocity
    return noteData;
  }

  // Schedule any notes that should play at this tick
  scheduleNotesAtTick(tick, when) {
    // Check each track in the pattern
    Object.keys(this.pattern).forEach((trackId) => {
      if (this.pattern[trackId]) {
        // Find notes at this tick (handle both old and new formats)
        const notesAtTick = this.pattern[trackId]
          .map((noteData) => this.normalizeNote(noteData))
          .filter((note) => note.tick === tick);

        // Play each note found at this tick
        notesAtTick.forEach((note) => {
          const soundFile = this.trackSounds[trackId];
          if (soundFile && this.audioBuffers[soundFile]) {
            this.playSound(soundFile, when, note.velocity);
            console.log(
              `Playing ${trackId} at tick ${tick} with velocity ${note.velocity}`
            );
          } else {
            console.warn(`No sound available for track ${trackId}`);
          }
        });
      }
    });
  }

  // Advance to next tick
  advanceTick() {
    const secondsPerBeat = 60.0 / this.bpm;
    const { TICKS_PER_BEAT, TOTAL_TICKS } = this.getTimingConstants();
    const secondsPerTick = secondsPerBeat / TICKS_PER_BEAT;

    this.nextNoteTime += secondsPerTick;
    this.currentTick = (this.currentTick + 1) % TOTAL_TICKS;
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
