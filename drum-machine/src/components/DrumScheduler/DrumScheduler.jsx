import * as Tone from "tone";

class DrumScheduler {
  constructor(bpm = 120, onTickUpdate = null, transportStore = null) {
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

    // Tone.js Players for loaded sounds
    this.tonePlayers = {};
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

  // Initialize Tone.js
  async init() {
    try {
      await Tone.start();
      console.log("DrumScheduler: Tone.js initialized");
      return true;
    } catch (error) {
      console.error("DrumScheduler: Failed to initialize Tone.js", error);
      return false;
    }
  }

  // Set tracks and load their sounds
  async setTracks(tracks) {
    console.log("DrumScheduler: Setting tracks", tracks);

    // Clean up old players that are no longer needed
    this.cleanupUnusedPlayers(tracks);

    // Update track sounds mapping
    this.trackSounds = {};

    for (const track of tracks) {
      this.trackSounds[track.id] = track.soundFile;

      if (track.soundFile && !this.tonePlayers[track.soundFile]) {
        console.log(`Loading sound for ${track.name}: ${track.soundFile}`);

        try {
          const player = await this.loadAudioFile(track.soundFile);
          if (player) {
            this.tonePlayers[track.soundFile] = player;
          }
        } catch (error) {
          console.error(`Failed to load sound for track ${track.name}:`, error);
        }
      }
    }

    console.log("DrumScheduler: Track sounds mapped:", this.trackSounds);
  }

  // Clean up Tone.Players that are no longer used by any track
  cleanupUnusedPlayers(tracks) {
    const currentSoundFiles = tracks
      .map((track) => track.soundFile)
      .filter(Boolean); // Remove null/undefined

    // Dispose of players that are no longer used
    Object.keys(this.tonePlayers).forEach((soundFile) => {
      if (!currentSoundFiles.includes(soundFile)) {
        console.log(`Cleaning up unused player: ${soundFile}`);
        this.tonePlayers[soundFile].dispose();
        delete this.tonePlayers[soundFile];
      }
    });
  }

  // Load individual audio file into Tone.Player
  async loadAudioFile(filePath) {
    try {
      // Create a new Tone.Player and connect it to the destination
      const player = new Tone.Player(`/${filePath}`).toDestination();

      // Wait for the player to load
      await Tone.loaded();

      console.log(`Successfully loaded: ${filePath}`);
      return player;
    } catch (error) {
      console.error(`Failed to load audio file: ${filePath}`, error);
      return null;
    }
  }

  // Play a sound at a specific time with velocity
  playSound(soundFile, when, velocity = 4) {
    const player = this.tonePlayers[soundFile];
    if (!player) {
      console.warn(`No player found for sound: ${soundFile}`);
      return;
    }

    // Convert velocity (1-4) to volume in decibels
    // velocity 1 = -12dB, velocity 4 = 0dB
    const velocityGain = velocity / 4; // 0.25 to 1.0
    const volumeDb = Tone.gainToDb(velocityGain);

    // Set volume and play
    player.volume.value = volumeDb;
    player.start(when);
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
      toneContextState: Tone.context.state,
    });

    // Ensure Tone.js is started
    if (Tone.context.state !== "running") {
      await Tone.start();
    }

    this.isPlaying = true;
    this.currentTick = fromTick;
    this.nextNoteTime = Tone.now();

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
    while (this.nextNoteTime < Tone.now() + this.scheduleAheadTime) {
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
          if (soundFile && this.tonePlayers[soundFile]) {
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

    // Dispose of all Tone.js players
    Object.values(this.tonePlayers).forEach((player) => {
      player.dispose();
    });
    this.tonePlayers = {};

    console.log("DrumScheduler: Destroyed");
  }
}

export default DrumScheduler;
