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

    // Tone.js Players and Effects for loaded sounds
    this.tonePlayers = {};
    this.trackEffects = {}; // Store effect chains per track
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
        TICKS_PER_BEAT: state.transport.TICKS_PER_BEAT,
        BEATS_PER_LOOP: state.transport.BEATS_PER_LOOP,
        TOTAL_TICKS: state.transport.getTotalTicks(),
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

  // Create effect chain for a track
  createEffectChain(trackId) {
    console.log(`Creating effect chain for track: ${trackId}`);

    // Create all effects in chain order
    const eq = new Tone.EQ3(0, 0, 0); // high, mid, low (all 0dB initially)
    const filter = new Tone.Filter(20000, "lowpass"); // 20kHz cutoff, lowpass
    filter.Q.value = 1; // Default Q value

    const compressor = new Tone.Compressor(-24, 4); // threshold, ratio
    compressor.attack.value = 0.01;
    compressor.release.value = 0.1;

    const chorus = new Tone.Chorus(2, 0.3, 0); // rate, depth, wet
    const vibrato = new Tone.Vibrato(5, 0.1); // rate, depth
    vibrato.wet.value = 0; // Start dry

    const distortion = new Tone.Distortion(0); // amount (start clean)
    distortion.oversample = "2x";

    const pitchShift = new Tone.PitchShift(0); // pitch (no shift initially)
    pitchShift.windowSize = 0.03;
    pitchShift.wet.value = 0; // Start dry

    const reverb = new Tone.Reverb(1.5); // 1.5s decay time
    reverb.wet.value = 0; // 0% wet initially

    const delay = new Tone.FeedbackDelay(0.25, 0.3); // 0.25s delay, 0.3 feedback
    delay.wet.value = 0; // 0% wet initially

    // Chain effects together in the correct order
    eq.chain(
      filter,
      compressor,
      chorus,
      vibrato,
      distortion,
      pitchShift,
      reverb,
      delay,
      Tone.Destination
    );

    // Store effect references
    this.trackEffects[trackId] = {
      input: eq, // This is where the player connects
      eq,
      filter,
      compressor,
      chorus,
      vibrato,
      distortion,
      pitchShift,
      reverb,
      delay,
    };

    console.log(`Effect chain created for track: ${trackId}`);
    return this.trackEffects[trackId];
  }

  // Update effect parameters for a track
  updateTrackEffects(trackId, effectsState) {
    const effects = this.trackEffects[trackId];
    if (!effects) return;

    try {
      // Update EQ
      if (effectsState.eq) {
        effects.eq.high.value = effectsState.eq.high;
        effects.eq.mid.value = effectsState.eq.mid;
        effects.eq.low.value = effectsState.eq.low;
      }

      // Update Filter
      if (effectsState.filter) {
        effects.filter.frequency.value = effectsState.filter.frequency;
        effects.filter.Q.value = effectsState.filter.Q;
      }

      // Update Compressor
      if (effectsState.compressor) {
        effects.compressor.threshold.value = effectsState.compressor.threshold;
        effects.compressor.ratio.value = effectsState.compressor.ratio;
        effects.compressor.attack.value = effectsState.compressor.attack;
        effects.compressor.release.value = effectsState.compressor.release;
      }

      // Update Chorus
      if (effectsState.chorus) {
        effects.chorus.frequency.value = effectsState.chorus.rate;
        effects.chorus.depth = effectsState.chorus.depth;
        effects.chorus.wet.value = effectsState.chorus.wet;
      }

      // Update Vibrato
      if (effectsState.vibrato) {
        effects.vibrato.frequency.value = effectsState.vibrato.rate;
        effects.vibrato.depth.value = effectsState.vibrato.depth;
        effects.vibrato.wet.value = effectsState.vibrato.wet;
      }

      // Update Distortion
      if (effectsState.distortion) {
        effects.distortion.distortion = effectsState.distortion.amount;
        effects.distortion.oversample = effectsState.distortion.oversample;
      }

      // Update Pitch Shift
      if (effectsState.pitchShift) {
        effects.pitchShift.pitch = effectsState.pitchShift.pitch;
        effects.pitchShift.windowSize = effectsState.pitchShift.windowSize;
        effects.pitchShift.wet.value = effectsState.pitchShift.wet;
      }

      // Update Reverb
      if (effectsState.reverb) {
        // Map roomSize to decay (roomSize affects how long reverb lasts)
        if (effectsState.reverb.roomSize !== undefined) {
          effects.reverb.decay = effectsState.reverb.roomSize * 10; // Scale 0.1-0.9 to 1-9 seconds
        }
        if (effectsState.reverb.decay !== undefined) {
          effects.reverb.decay = effectsState.reverb.decay;
        }
        if (effectsState.reverb.wet !== undefined) {
          effects.reverb.wet.value = effectsState.reverb.wet;
        }
      }

      // Update Delay
      if (effectsState.delay) {
        effects.delay.delayTime.value = effectsState.delay.delayTime;
        effects.delay.feedback.value = effectsState.delay.feedback;
        effects.delay.wet.value = effectsState.delay.wet;
      }

      console.log(`Updated effects for track ${trackId}:`, effectsState);
    } catch (error) {
      console.error(`Error updating effects for track ${trackId}:`, error);
    }
  }

  // Set tracks and load their sounds with effects
  async setTracks(tracks) {
    console.log("DrumScheduler: Setting tracks", tracks);

    // Clean up old players that are no longer needed
    this.cleanupUnusedPlayers(tracks);

    // Update track sounds mapping
    this.trackSounds = {};

    for (const track of tracks) {
      this.trackSounds[track.id] = track.soundFile;

      // Create effect chain for this track if it doesn't exist
      if (!this.trackEffects[track.id]) {
        this.createEffectChain(track.id);
      }

      if (track.soundFile && !this.tonePlayers[track.soundFile]) {
        console.log(`Loading sound for ${track.name}: ${track.soundFile}`);

        try {
          const player = await this.loadAudioFile(track.soundFile, track.id);
          if (player) {
            this.tonePlayers[track.soundFile] = player;
          }
        } catch (error) {
          console.error(`Failed to load sound for track ${track.name}:`, error);
        }
      } else if (track.soundFile && this.tonePlayers[track.soundFile]) {
        // Reconnect existing player to this track's effects
        const player = this.tonePlayers[track.soundFile];
        const effects = this.trackEffects[track.id];
        if (effects) {
          player.disconnect();
          player.connect(effects.input);
        }
      }
    }

    console.log("DrumScheduler: Track sounds mapped:", this.trackSounds);
  }

  // Clean up Tone.Players and effects that are no longer used
  cleanupUnusedPlayers(tracks) {
    const currentSoundFiles = tracks
      .map((track) => track.soundFile)
      .filter(Boolean); // Remove null/undefined

    const currentTrackIds = tracks.map((track) => track.id);

    // Dispose of players that are no longer used
    Object.keys(this.tonePlayers).forEach((soundFile) => {
      if (!currentSoundFiles.includes(soundFile)) {
        console.log(`Cleaning up unused player: ${soundFile}`);
        this.tonePlayers[soundFile].dispose();
        delete this.tonePlayers[soundFile];
      }
    });

    // Dispose of effect chains that are no longer used
    Object.keys(this.trackEffects).forEach((trackId) => {
      if (!currentTrackIds.includes(trackId)) {
        console.log(`Cleaning up unused effects for track: ${trackId}`);
        const effects = this.trackEffects[trackId];

        // Dispose of all effects in the chain
        Object.values(effects).forEach((effect) => {
          if (effect && typeof effect.dispose === "function") {
            effect.dispose();
          }
        });

        delete this.trackEffects[trackId];
      }
    });
  }

  // Load individual audio file into Tone.Player and connect to effects
  async loadAudioFile(filePath, trackId) {
    try {
      // Create a new Tone.Player
      const player = new Tone.Player(`/${filePath}`);

      // Connect to the track's effect chain
      const effects = this.trackEffects[trackId];
      if (effects) {
        player.connect(effects.input);
      } else {
        // Fallback to direct connection if no effects
        player.toDestination();
      }

      // Wait for the player to load
      await Tone.loaded();

      console.log(`Successfully loaded: ${filePath} for track: ${trackId}`);
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

    // Dispose of all effect chains
    Object.values(this.trackEffects).forEach((effects) => {
      Object.values(effects).forEach((effect) => {
        if (effect && typeof effect.dispose === "function") {
          effect.dispose();
        }
      });
    });
    this.trackEffects = {};

    console.log("DrumScheduler: Destroyed");
  }
}

export default DrumScheduler;
