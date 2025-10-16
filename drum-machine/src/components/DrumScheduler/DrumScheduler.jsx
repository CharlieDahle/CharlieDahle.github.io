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
    this.trackEffectStates = {}; // Track which effects are enabled/disabled per track
    this.soundsLoaded = false;

    // Dynamic track to sound mapping
    this.trackSounds = {};
    
    // Track volumes mapping
    this.trackVolumes = {};

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

  // Helper function to properly encode file paths
  encodeFilePath(filePath) {
    return filePath
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
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

  // Create a single effect instance based on type and settings
  createEffect(effectType, settings) {
    switch (effectType) {
      case "eq":
        return new Tone.EQ3(settings.high, settings.mid, settings.low);

      case "filter":
        const filter = new Tone.Filter(settings.frequency, "lowpass");
        filter.Q.value = settings.Q;
        return filter;

      case "compressor":
        const compressor = new Tone.Compressor(
          settings.threshold,
          settings.ratio
        );
        compressor.attack.value = settings.attack;
        compressor.release.value = settings.release;
        return compressor;

      case "chorus":
        const chorus = new Tone.Chorus(
          settings.rate,
          settings.depth,
          settings.wet
        );
        return chorus;

      case "vibrato":
        const vibrato = new Tone.Vibrato(settings.rate, settings.depth);
        vibrato.wet.value = settings.wet;
        return vibrato;

      case "distortion":
        const distortion = new Tone.Distortion(settings.amount);
        distortion.oversample = settings.oversample;
        return distortion;

      case "pitchShift":
        const pitchShift = new Tone.PitchShift(settings.pitch);
        pitchShift.windowSize = settings.windowSize;
        pitchShift.wet.value = settings.wet;
        return pitchShift;

      case "reverb":
        const reverb = new Tone.Reverb(settings.decay);
        reverb.wet.value = settings.wet;
        return reverb;

      case "delay":
        const delay = new Tone.FeedbackDelay(
          settings.delayTime,
          settings.feedback
        );
        delay.wet.value = settings.wet;
        return delay;

      default:
        console.warn(`Unknown effect type: ${effectType}`);
        return null;
    }
  }

  // Check if an effect should be considered "enabled" (non-default values)
  isEffectEnabled(effectType, settings) {
    switch (effectType) {
      case "eq":
        return settings.high !== 0 || settings.mid !== 0 || settings.low !== 0;
      case "filter":
        return settings.frequency !== 20000 || settings.Q !== 1;
      case "compressor":
        return (
          settings.threshold !== -24 ||
          settings.ratio !== 4 ||
          settings.attack !== 0.01 ||
          settings.release !== 0.1
        );
      case "chorus":
        return settings.wet > 0;
      case "vibrato":
        return settings.wet > 0;
      case "distortion":
        return settings.amount > 0;
      case "pitchShift":
        return settings.wet > 0 || settings.pitch !== 0;
      case "reverb":
        return settings.wet > 0;
      case "delay":
        return settings.wet > 0;
      default:
        return false;
    }
  }

  // Rebuild the entire effect chain for a track
  rebuildEffectChain(trackId, effectsState) {
    console.log(`Rebuilding effect chain for track: ${trackId}`);

    // 1. First, disconnect the player from the old chain
    const soundFile = this.trackSounds[trackId];
    if (soundFile && this.tonePlayers[soundFile]) {
      const player = this.tonePlayers[soundFile];
      player.disconnect(); // Disconnect player from old chain first
      console.log(`Disconnected player for ${trackId} from old chain`);
    }

    // 2. Properly dispose of old effect chain
    if (this.trackEffects[trackId]) {
      console.log(`Disposing old effects for track: ${trackId}`);

      // Get all effects as an array to handle them properly
      const oldEffects = Object.values(this.trackEffects[trackId]).filter(
        (effect) => effect && typeof effect.disconnect === "function"
      );

      // First pass: disconnect all effects from each other and destination
      oldEffects.forEach((effect) => {
        try {
          effect.disconnect(); // This is the key fix!
          console.log(`Disconnected effect:`, effect.constructor.name);
        } catch (error) {
          console.warn(`Failed to disconnect effect:`, error);
        }
      });

      // Second pass: dispose of all disconnected effects
      oldEffects.forEach((effect) => {
        try {
          if (typeof effect.dispose === "function") {
            effect.dispose();
            console.log(`Disposed effect:`, effect.constructor.name);
          }
        } catch (error) {
          console.warn(`Failed to dispose effect:`, error);
        }
      });
    }

    // 3. Determine which effects are enabled (same as before)
    const enabledEffects = [];
    const effectOrder = [
      "eq",
      "filter",
      "compressor",
      "chorus",
      "vibrato",
      "distortion",
      "pitchShift",
      "reverb",
      "delay",
    ];

    effectOrder.forEach((effectType) => {
      if (
        effectsState[effectType] &&
        this.isEffectEnabled(effectType, effectsState[effectType])
      ) {
        enabledEffects.push({
          type: effectType,
          settings: effectsState[effectType],
        });
      }
    });

    console.log(
      `Enabled effects for ${trackId}:`,
      enabledEffects.map((e) => e.type)
    );

    // 4. Create new effect instances (same as before)
    const newEffects = {};
    const effectInstances = [];

    enabledEffects.forEach(({ type, settings }) => {
      const effect = this.createEffect(type, settings);
      if (effect) {
        newEffects[type] = effect;
        effectInstances.push(effect);
        console.log(`Created new ${type} effect`);
      }
    });

    // 5. Chain effects together (same as before)
    if (effectInstances.length > 0) {
      // Chain effects in series: first -> second -> ... -> last -> destination
      for (let i = 0; i < effectInstances.length; i++) {
        if (i === effectInstances.length - 1) {
          // Last effect connects to destination
          effectInstances[i].toDestination();
        } else {
          // Connect to next effect in chain
          effectInstances[i].connect(effectInstances[i + 1]);
        }
      }
      // The first effect becomes our input point
      newEffects.input = effectInstances[0];
    } else {
      // No effects - players should connect directly to destination
      newEffects.input = null;
    }

    // 6. Store the new chain
    this.trackEffects[trackId] = newEffects;

    // 7. Reconnect the player to the new chain (or destination)
    if (soundFile && this.tonePlayers[soundFile]) {
      const player = this.tonePlayers[soundFile];

      if (newEffects.input) {
        player.connect(newEffects.input);
        console.log(`Reconnected player for ${trackId} to effect chain`);
      } else {
        player.toDestination();
        console.log(
          `Reconnected player for ${trackId} directly to destination`
        );
      }
    }

    console.log(`Effect chain rebuilt for track: ${trackId}`);
    
    // Validate connections after rebuild
    this.validateTrackConnections(trackId);
  }

  // Validate that a track's connections are working properly
  validateTrackConnections(trackId) {
    const soundFile = this.trackSounds[trackId];
    const player = this.tonePlayers[soundFile];
    const effects = this.trackEffects[trackId];
    
    if (!player) {
      console.warn(`No player found for track ${trackId}`);
      return false;
    }
    
    // Check if player is connected
    const isConnected = player.numberOfOutputs > 0;
    
    if (!isConnected) {
      console.warn(`Player for track ${trackId} is not connected, attempting reconnection`);
      this.reconnectTrack(trackId);
      return false;
    }
    
    console.log(`✅ Track ${trackId} connections validated`);
    return true;
  }
  
  // Reconnect a track's player to its effect chain
  reconnectTrack(trackId) {
    const soundFile = this.trackSounds[trackId];
    const player = this.tonePlayers[soundFile];
    const effects = this.trackEffects[trackId];
    
    if (!player) return;
    
    try {
      // Disconnect first
      player.disconnect();
      
      // Reconnect to effect chain or destination
      if (effects && effects.input) {
        player.connect(effects.input);
        console.log(`🔌 Reconnected player for ${trackId} to effect chain`);
      } else {
        player.toDestination();
        console.log(`🔌 Reconnected player for ${trackId} directly to destination`);
      }
    } catch (error) {
      console.error(`Failed to reconnect track ${trackId}:`, error);
    }
  }

  // Smart effect update - only rebuilds if effects are enabled/disabled
  updateTrackEffects(trackId, effectsState) {
    // Initialize effect state tracking if needed
    if (!this.trackEffectStates[trackId]) {
      this.trackEffectStates[trackId] = {};
    }

    const previousStates = this.trackEffectStates[trackId];
    const newStates = {};
    let needsRebuild = false;

    // Check each effect type to see if it's enabled/disabled status changed
    const effectOrder = [
      "eq", "filter", "compressor", "chorus", "vibrato", 
      "distortion", "pitchShift", "reverb", "delay"
    ];

    effectOrder.forEach((effectType) => {
      const isEnabled = this.isEffectEnabled(effectType, effectsState[effectType]);
      const wasEnabled = previousStates[effectType] || false;
      
      newStates[effectType] = isEnabled;
      
      // Check if enable/disable status changed
      if (isEnabled !== wasEnabled) {
        console.log(`${effectType} effect ${isEnabled ? 'enabled' : 'disabled'} for track ${trackId}`);
        needsRebuild = true;
      }
    });

    // Update our tracking
    this.trackEffectStates[trackId] = newStates;

    if (needsRebuild) {
      console.log(`Rebuilding effect chain for ${trackId} due to enable/disable changes`);
      this.rebuildEffectChain(trackId, effectsState);
    } else {
      console.log(`Updating parameters for ${trackId} without rebuilding`);
      this.updateEffectParameters(trackId, effectsState);
    }
  }

  // Update individual effect parameters without rebuilding the chain
  updateEffectParameters(trackId, effectsState) {
    const effects = this.trackEffects[trackId];
    if (!effects) return;

    // Update each enabled effect's parameters
    Object.keys(effectsState).forEach((effectType) => {
      const effect = effects[effectType];
      const settings = effectsState[effectType];
      
      if (!effect || !settings || !this.isEffectEnabled(effectType, settings)) {
        return;
      }

      try {
        this.updateSingleEffectParameters(effect, effectType, settings);
      } catch (error) {
        console.warn(`Failed to update ${effectType} parameters for track ${trackId}:`, error);
      }
    });
  }

  // Update parameters for a single effect instance
  updateSingleEffectParameters(effect, effectType, settings) {
    switch (effectType) {
      case "eq":
        if (effect.high) effect.high.value = settings.high;
        if (effect.mid) effect.mid.value = settings.mid;
        if (effect.low) effect.low.value = settings.low;
        break;
        
      case "filter":
        if (effect.frequency) effect.frequency.value = settings.frequency;
        if (effect.Q) effect.Q.value = settings.Q;
        break;
        
      case "compressor":
        if (effect.threshold) effect.threshold.value = settings.threshold;
        if (effect.ratio) effect.ratio.value = settings.ratio;
        if (effect.attack) effect.attack.value = settings.attack;
        if (effect.release) effect.release.value = settings.release;
        break;
        
      case "chorus":
        if (effect.frequency) effect.frequency.value = settings.rate;
        if (effect.depth) effect.depth.value = settings.depth;
        if (effect.wet) effect.wet.value = settings.wet;
        break;
        
      case "vibrato":
        if (effect.frequency) effect.frequency.value = settings.rate;
        if (effect.depth) effect.depth.value = settings.depth;
        if (effect.wet) effect.wet.value = settings.wet;
        break;
        
      case "distortion":
        if (effect.distortion) effect.distortion.value = settings.amount;
        if (effect.oversample !== undefined) effect.oversample = settings.oversample;
        break;
        
      case "pitchShift":
        if (effect.pitch) effect.pitch.value = settings.pitch;
        if (effect.windowSize) effect.windowSize.value = settings.windowSize;
        if (effect.wet) effect.wet.value = settings.wet;
        break;
        
      case "reverb":
        if (effect.wet) effect.wet.value = settings.wet;
        // Note: roomSize/decay require recreation for Tone.Reverb
        break;
        
      case "delay":
        if (effect.delayTime) effect.delayTime.value = settings.delayTime;
        if (effect.feedback) effect.feedback.value = settings.feedback;
        if (effect.wet) effect.wet.value = settings.wet;
        break;
        
      default:
        console.warn(`Unknown effect type for parameter update: ${effectType}`);
    }
  }

  // Enable a specific effect (forces rebuild)
  enableEffect(trackId, effectType, settings) {
    console.log(`Enabling ${effectType} effect for track ${trackId}`);
    
    // Update our state tracking
    if (!this.trackEffectStates[trackId]) {
      this.trackEffectStates[trackId] = {};
    }
    this.trackEffectStates[trackId][effectType] = true;
    
    // Get current effects state and update it
    const currentEffectsState = this.getTrackEffectsState(trackId);
    currentEffectsState[effectType] = { ...settings };
    
    // Rebuild the chain
    this.rebuildEffectChain(trackId, currentEffectsState);
  }

  // Disable a specific effect (forces rebuild)
  disableEffect(trackId, effectType) {
    console.log(`Disabling ${effectType} effect for track ${trackId}`);
    
    // Update our state tracking
    if (!this.trackEffectStates[trackId]) {
      this.trackEffectStates[trackId] = {};
    }
    this.trackEffectStates[trackId][effectType] = false;
    
    // Get current effects state and reset this effect to defaults
    const currentEffectsState = this.getTrackEffectsState(trackId);
    const defaults = this.getDefaultEffectSettings(effectType);
    if (defaults) {
      currentEffectsState[effectType] = { ...defaults };
    }
    
    // Rebuild the chain
    this.rebuildEffectChain(trackId, currentEffectsState);
  }

  // Get current effects state for a track
  getTrackEffectsState(trackId) {
    // Get effects state from the store
    if (this.transportStore) {
      const state = this.transportStore.getState();
      return state.effects.getTrackEffects(trackId);
    }
    
    // Fallback to defaults if no store access
    return this.getAllDefaultEffectSettings();
  }
  
  // Get all default effect settings
  getAllDefaultEffectSettings() {
    return {
      eq: { high: 0, mid: 0, low: 0 },
      filter: { frequency: 20000, Q: 1 },
      compressor: { threshold: -24, ratio: 4, attack: 0.01, release: 0.1 },
      chorus: { rate: 2, depth: 0.3, wet: 0 },
      vibrato: { rate: 5, depth: 0.1, wet: 0 },
      distortion: { amount: 0, oversample: "2x" },
      pitchShift: { pitch: 0, windowSize: 0.03, wet: 0 },
      reverb: { roomSize: 0.3, decay: 1.5, wet: 0 },
      delay: { delayTime: 0.25, feedback: 0.3, wet: 0 }
    };
  }

  // Get default settings for a specific effect type
  getDefaultEffectSettings(effectType) {
    const allDefaults = this.getAllDefaultEffectSettings();
    return allDefaults[effectType];
  }

  // Set tracks and load their sounds with effects
  async setTracks(tracks) {
    console.log("DrumScheduler: Setting tracks", tracks);

    // Clean up old players that are no longer needed
    this.cleanupUnusedPlayers(tracks);

    // Update track sounds and volumes mapping
    this.trackSounds = {};
    this.trackVolumes = {};

    for (const track of tracks) {
      this.trackSounds[track.id] = track.soundFile;
      this.trackVolumes[track.id] = track.volume ?? 1.0;

      // Initialize empty effect chain for this track if it doesn't exist
      if (!this.trackEffects[track.id]) {
        console.log(`Initializing empty effect chain for ${track.id}`);
        this.trackEffects[track.id] = { input: null }; // No effects initially
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
        if (effects && effects.input) {
          player.disconnect();
          player.connect(effects.input);
          console.log(
            `Reconnected existing player for ${track.id} to effect chain`
          );
        } else {
          player.disconnect();
          player.toDestination();
          console.log(
            `Reconnected existing player for ${track.id} directly to destination`
          );
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
        delete this.trackEffectStates[trackId];
      }
    });
  }

  // Load individual audio file into Tone.Player and connect to effects
  async loadAudioFile(filePath, trackId) {
    try {
      // Properly encode the file path for URL usage
      const encodedPath = this.encodeFilePath(filePath);
      console.log(`Loading audio file:`, {
        originalPath: filePath,
        encodedPath: encodedPath,
        trackId: trackId,
      });

      // Create a new Tone.Player with the encoded path
      const player = new Tone.Player(`/${encodedPath}`);

      // Connect to the track's effect chain
      const effects = this.trackEffects[trackId];
      if (effects && effects.input) {
        player.connect(effects.input);
        console.log(`Connected player to effect chain for ${trackId}`);
      } else {
        // Fallback to direct connection if no effects
        player.toDestination();
        console.log(`Connected player directly to destination for ${trackId}`);
      }

      // Wait for the player to load
      await Tone.loaded();

      console.log(`✅ Successfully loaded: ${filePath} for track: ${trackId}`);
      return player;
    } catch (error) {
      console.error(`❌ Failed to load audio file: ${filePath}`, error);

      // Add to failed loads tracking
      if (window.drumSoundDebugData) {
        if (!window.drumSoundDebugData.failed) {
          window.drumSoundDebugData.failed = [];
        }
        window.drumSoundDebugData.failed.push({
          file: filePath,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }

      return null;
    }
  }

  // Play a sound at a specific time with velocity and track volume
  playSound(soundFile, when, velocity = 4, trackVolume = 1.0) {
    const player = this.tonePlayers[soundFile];
    if (!player) {
      console.warn(`No player found for sound: ${soundFile}`);
      return;
    }

    // Check if player is properly connected
    console.log(`Playing ${soundFile} - Player state:`, {
      loaded: player.loaded,
      state: player.state,
      connected: player.numberOfOutputs > 0,
      velocity: velocity,
      trackVolume: trackVolume,
    });

    // Convert velocity (1-4) to gain (0.25 to 1.0)
    const velocityGain = velocity / 4;
    
    // Combine track volume and velocity
    const finalGain = velocityGain * trackVolume;
    
    // Convert to decibels (with a minimum to avoid -Infinity)
    const volumeDb = finalGain > 0 ? Tone.gainToDb(finalGain) : -60;

    // Set volume and play
    player.volume.value = volumeDb;
    player.start(when);

    console.log(
      `Triggered sound ${soundFile} at ${when} with velocity ${velocity}, track volume ${trackVolume}, final volume ${volumeDb}dB`
    );
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
          const trackVolume = this.trackVolumes[trackId] ?? 1.0;
          if (soundFile && this.tonePlayers[soundFile]) {
            this.playSound(soundFile, when, note.velocity, trackVolume);
            console.log(
              `Playing ${trackId} at tick ${tick} with velocity ${note.velocity}, track volume ${trackVolume}`
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
    this.trackEffectStates = {};

    console.log("DrumScheduler: Destroyed");
  }
}

export default DrumScheduler;
