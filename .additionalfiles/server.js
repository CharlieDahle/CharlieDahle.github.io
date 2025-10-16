require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

// Database setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

// Middleware
app.use(
  cors({
    origin: ["http://localhost:5173", "https://charliedahle.me"],
    credentials: true,
  })
);
app.use(express.json());

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" });
    }
    req.user = user;
    next();
  });
};

// ============================================================================
// AUTH ROUTES
// ============================================================================

// Register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    // Check if username exists
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE username = $1",
      [username]
    );
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "Username already exists" });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await pool.query(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at",
      [username, passwordHash]
    );

    const user = result.rows[0];

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "User created successfully",
      user: { id: user.id, username: user.username },
      token,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    // Find user
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      user: { id: user.id, username: user.username },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================================
// BEATS ROUTES
// ============================================================================

// Get user's beats
app.get("/api/beats", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, bpm, measure_count, created_at, updated_at FROM beats WHERE user_id = $1 ORDER BY updated_at DESC",
      [req.user.userId]
    );

    res.json({ beats: result.rows });
  } catch (error) {
    console.error("Get beats error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Save a beat
app.post("/api/beats", authenticateToken, async (req, res) => {
  try {
    const { name, patternData, tracksConfig, bpm, measureCount, effectsState } =
      req.body;

    if (!name || !patternData || !tracksConfig) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await pool.query(
      "INSERT INTO beats (user_id, name, pattern_data, tracks_config, bpm, measure_count, effects_state) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [
        req.user.userId,
        name,
        JSON.stringify(patternData),
        JSON.stringify(tracksConfig),
        bpm || 120,
        measureCount || 4,
        JSON.stringify(effectsState || {}),
      ]
    );

    const beat = result.rows[0];
    res.status(201).json({
      message: "Beat saved successfully",
      beat: {
        id: beat.id,
        name: beat.name,
        bpm: beat.bpm,
        measureCount: beat.measure_count,
        createdAt: beat.created_at,
        effectsState: beat.effects_state,
      },
    });
  } catch (error) {
    console.error("Save beat error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Load a specific beat
app.get("/api/beats/:id", authenticateToken, async (req, res) => {
  try {
    const beatId = req.params.id;

    const result = await pool.query(
      "SELECT * FROM beats WHERE id = $1 AND user_id = $2",
      [beatId, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Beat not found" });
    }

    const beat = result.rows[0];
    res.json({
      id: beat.id,
      name: beat.name,
      patternData: beat.pattern_data,
      tracksConfig: beat.tracks_config,
      bpm: beat.bpm,
      measureCount: beat.measure_count,
      effectsState: beat.effects_state || {},
      createdAt: beat.created_at,
      updatedAt: beat.updated_at,
    });
  } catch (error) {
    console.error("Load beat error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/api/beats/:id", authenticateToken, async (req, res) => {
  try {
    const beatId = req.params.id;
    const { name, patternData, tracksConfig, bpm, measureCount, effectsState } =
      req.body;

    if (!name || !patternData || !tracksConfig) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // First, verify the beat exists and belongs to the user
    const existingBeat = await pool.query(
      "SELECT id FROM beats WHERE id = $1 AND user_id = $2",
      [beatId, req.user.userId]
    );

    if (existingBeat.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Beat not found or not owned by user" });
    }

    // Update the beat
    const result = await pool.query(
      "UPDATE beats SET name = $1, pattern_data = $2, tracks_config = $3, bpm = $4, measure_count = $5, effects_state = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7 AND user_id = $8 RETURNING *",
      [
        name,
        JSON.stringify(patternData),
        JSON.stringify(tracksConfig),
        bpm || 120,
        measureCount || 4,
        JSON.stringify(effectsState || {}),
        beatId,
        req.user.userId,
      ]
    );

    const beat = result.rows[0];
    res.json({
      message: "Beat updated successfully",
      beat: {
        id: beat.id,
        name: beat.name,
        bpm: beat.bpm,
        measureCount: beat.measure_count,
        effectsState: beat.effects_state,
        created_at: beat.created_at,
        updated_at: beat.updated_at,
      },
    });
  } catch (error) {
    console.error("Update beat error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================================
// EXISTING WEBSOCKET CODE (unchanged)
// ============================================================================

const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:5173", "https://charliedahle.me"],
    methods: ["GET", "POST"],
  },
});

// Simple room storage - just data, no playback logic
const rooms = new Map();

// ============================================================================
// EFFECTS VALIDATION
// ============================================================================

// Effect parameter validation ranges (matches client-side constraints)
const EFFECT_VALIDATION_RULES = {
  eq: {
    high: { min: -12, max: 12, type: "number" },
    mid: { min: -12, max: 12, type: "number" },
    low: { min: -12, max: 12, type: "number" },
  },
  filter: {
    frequency: { min: 100, max: 20000, type: "number" },
    Q: { min: 0.1, max: 30, type: "number" },
  },
  compressor: {
    threshold: { min: -60, max: 0, type: "number" },
    ratio: { min: 1, max: 20, type: "number" },
    attack: { min: 0, max: 0.1, type: "number" },
    release: { min: 0.01, max: 1, type: "number" },
  },
  chorus: {
    rate: { min: 0.1, max: 10, type: "number" },
    depth: { min: 0, max: 1, type: "number" },
    wet: { min: 0, max: 1, type: "number" },
  },
  vibrato: {
    rate: { min: 0.1, max: 20, type: "number" },
    depth: { min: 0, max: 1, type: "number" },
    wet: { min: 0, max: 1, type: "number" },
  },
  distortion: {
    amount: { min: 0, max: 1, type: "number" },
    oversample: { values: ["2x", "4x"], type: "enum" },
  },
  pitchShift: {
    pitch: { min: -12, max: 12, type: "number" },
    windowSize: { min: 0.01, max: 0.1, type: "number" },
    wet: { min: 0, max: 1, type: "number" },
  },
  reverb: {
    roomSize: { min: 0.1, max: 0.9, type: "number" },
    decay: { min: 0.1, max: 10, type: "number" },
    wet: { min: 0, max: 1, type: "number" },
  },
  delay: {
    delayTime: { min: 0.01, max: 1, type: "number" },
    feedback: { min: 0, max: 0.95, type: "number" },
    wet: { min: 0, max: 1, type: "number" },
  },
};

// Validate a single effect parameter
function validateEffectParameter(effectType, parameter, value) {
  const rules = EFFECT_VALIDATION_RULES[effectType];
  if (!rules) {
    return { valid: false, error: `Unknown effect type: ${effectType}` };
  }

  const paramRule = rules[parameter];
  if (!paramRule) {
    return {
      valid: false,
      error: `Unknown parameter: ${parameter} for effect ${effectType}`,
    };
  }

  if (paramRule.type === "number") {
    if (typeof value !== "number" || isNaN(value)) {
      return { valid: false, error: `Parameter ${parameter} must be a number` };
    }
    if (value < paramRule.min || value > paramRule.max) {
      return {
        valid: false,
        error: `Parameter ${parameter} must be between ${paramRule.min} and ${paramRule.max}`,
      };
    }
  } else if (paramRule.type === "enum") {
    if (!paramRule.values.includes(value)) {
      return {
        valid: false,
        error: `Parameter ${parameter} must be one of: ${paramRule.values.join(
          ", "
        )}`,
      };
    }
  }

  return { valid: true };
}

// Validate complete effects state object
function validateEffectsState(effectsState) {
  const errors = [];

  for (const [effectType, effectParams] of Object.entries(effectsState)) {
    if (!EFFECT_VALIDATION_RULES[effectType]) {
      errors.push(`Unknown effect type: ${effectType}`);
      continue;
    }

    for (const [parameter, value] of Object.entries(effectParams)) {
      const validation = validateEffectParameter(effectType, parameter, value);
      if (!validation.valid) {
        errors.push(validation.error);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors,
  };
}

class DrumRoom {
  constructor(id) {
    this.id = id;
    this.bpm = 120;
    this.measureCount = 4; // Add measure count to room state
    this.pattern = new Map(); // trackId -> Array of note objects {tick, velocity}
    this.tracks = new Map(); // trackId -> track data (name, color, soundFile, etc.)
    this.users = new Set();
    this.lastActivity = Date.now();

    // Effects state management
    this.trackEffects = new Map(); // trackId -> complete effects object
    this.enabledEffects = new Map(); // trackId -> { effectType: boolean }

    // Initialize default tracks with empty patterns and effects
    this.initializeDefaultTracks();
  }

  initializeDefaultTracks() {
    const defaultTracks = [
      {
        id: "kick",
        name: "Kick",
        color: "#e74c3c",
        soundFile: "kicks/Ac_K.wav",
        availableSounds: [],
      },
      {
        id: "snare",
        name: "Snare",
        color: "#f39c12",
        soundFile: "snares/Box_Snr2.wav",
        availableSounds: [],
      },
      {
        id: "hihat",
        name: "Hi-Hat",
        color: "#2ecc71",
        soundFile: "hihats/Jls_H.wav",
        availableSounds: [],
      },
      {
        id: "openhat",
        name: "Open Hat",
        color: "#3498db",
        soundFile: "cymbals/CL_OHH1.wav",
        availableSounds: [],
      },
    ];

    defaultTracks.forEach((track) => {
      this.tracks.set(track.id, track);
      this.pattern.set(track.id, []); // Array instead of Set

      // Initialize effects for each track
      this.initializeTrackEffects(track.id);
    });
  }

  addUser(userId) {
    this.users.add(userId);
    this.lastActivity = Date.now();
  }

  removeUser(userId) {
    this.users.delete(userId);
    this.lastActivity = Date.now();

    // Don't immediately delete empty rooms
    // Let the cleanup interval handle it after 2 minutes
    if (this.users.size === 0) {
      console.log(
        `Room ${this.id} is now empty - will cleanup in 2 minutes if no one rejoins`
      );
    }
  }

  // Check if room is completely blank (no user modifications)
  isBlank() {
    // Check if BPM is at default
    if (this.bpm !== 120) return false;

    // Check if measure count is at default
    if (this.measureCount !== 4) return false;

    // Check if there are more than 4 tracks (default tracks)
    if (this.tracks.size !== 4) return false;

    // Check if any track has notes
    for (const [trackId, notes] of this.pattern.entries()) {
      if (notes.length > 0) return false;
    }

    // Check if any effects are non-default
    const defaultEffects = this.getDefaultEffects();
    for (const [trackId, trackEffects] of this.trackEffects.entries()) {
      for (const [effectType, effectParams] of Object.entries(trackEffects)) {
        if (defaultEffects[effectType]) {
          for (const [param, value] of Object.entries(effectParams)) {
            if (value !== defaultEffects[effectType][param]) {
              return false;
            }
          }
        }
      }
    }

    // Check if any tracks have non-default sounds
    const defaultSounds = {
      kick: "kicks/Ac_K.wav",
      snare: "snares/Box_Snr2.wav",
      hihat: "hihats/Jls_H.wav",
      openhat: "cymbals/CL_OHH1.wav",
    };

    for (const [trackId, track] of this.tracks.entries()) {
      if (defaultSounds[trackId] && track.soundFile !== defaultSounds[trackId]) {
        return false;
      }
    }

    return true;
  }

  // Add a note at specific tick position with velocity
  addNote(trackId, tick, velocity = 4) {
    if (!this.pattern.has(trackId)) {
      this.pattern.set(trackId, []);
    }

    const trackNotes = this.pattern.get(trackId);

    // Check if note already exists at this tick
    const existingNoteIndex = trackNotes.findIndex(
      (note) => note.tick === tick
    );

    if (existingNoteIndex === -1) {
      // Add new note
      trackNotes.push({ tick, velocity: Math.max(1, Math.min(4, velocity)) });
      this.lastActivity = Date.now();
    }
    // If note exists, don't add duplicate
  }

  // Remove a note from specific tick position
  removeNote(trackId, tick) {
    if (this.pattern.has(trackId)) {
      const trackNotes = this.pattern.get(trackId);
      const filteredNotes = trackNotes.filter((note) => note.tick !== tick);
      this.pattern.set(trackId, filteredNotes);
      this.lastActivity = Date.now();
    }
  }

  // Update note velocity
  updateNoteVelocity(trackId, tick, velocity) {
    if (this.pattern.has(trackId)) {
      const trackNotes = this.pattern.get(trackId);
      const noteIndex = trackNotes.findIndex((note) => note.tick === tick);

      if (noteIndex !== -1) {
        trackNotes[noteIndex].velocity = Math.max(1, Math.min(4, velocity));
        this.lastActivity = Date.now();
      }
    }
  }

  // Move a note from one position to another
  moveNote(trackId, fromTick, toTick) {
    if (this.pattern.has(trackId)) {
      const trackNotes = this.pattern.get(trackId);
      const noteIndex = trackNotes.findIndex((note) => note.tick === fromTick);

      if (noteIndex !== -1) {
        const noteToMove = trackNotes[noteIndex];
        // Remove from old position
        trackNotes.splice(noteIndex, 1);
        // Add at new position
        trackNotes.push({ ...noteToMove, tick: toTick });
        this.lastActivity = Date.now();
      }
    }
  }

  // Clear entire track
  clearTrack(trackId) {
    if (this.pattern.has(trackId)) {
      this.pattern.set(trackId, []);
      this.lastActivity = Date.now();
    }
  }

  // Get current room state for sending to clients
  getState() {
    // Convert pattern Map to object with arrays
    const serializedPattern = {};
    for (const [trackId, noteArray] of this.pattern.entries()) {
      serializedPattern[trackId] = noteArray; // Already an array
    }

    // Convert tracks Map to Array
    const serializedTracks = Array.from(this.tracks.values());

    // Convert effects Maps to objects
    const serializedTrackEffects = {};
    const serializedEnabledEffects = {};

    for (const [trackId, effects] of this.trackEffects.entries()) {
      serializedTrackEffects[trackId] = effects;
    }

    for (const [trackId, enabled] of this.enabledEffects.entries()) {
      serializedEnabledEffects[trackId] = enabled;
    }

    return {
      id: this.id,
      bpm: this.bpm,
      measureCount: this.measureCount,
      pattern: serializedPattern,
      tracks: serializedTracks,
      users: Array.from(this.users),
      trackEffects: serializedTrackEffects,
      enabledEffects: serializedEnabledEffects,
    };
  }

  setBpm(newBpm) {
    this.bpm = Math.max(60, Math.min(300, newBpm)); // Clamp between 60-300
    this.lastActivity = Date.now();
  }

  // Add measure count management
  setMeasureCount(newMeasureCount) {
    this.measureCount = Math.max(1, Math.min(16, newMeasureCount)); // Clamp between 1-16
    this.lastActivity = Date.now();
  }

  // Track management
  addTrack(trackData) {
    this.tracks.set(trackData.id, trackData);
    this.pattern.set(trackData.id, []); // Empty array for new track
    this.initializeTrackEffects(trackData.id); // Initialize effects for new track
    this.lastActivity = Date.now();
  }

  removeTrack(trackId) {
    this.tracks.delete(trackId);
    this.pattern.delete(trackId);
    this.trackEffects.delete(trackId); // Remove effects state
    this.enabledEffects.delete(trackId); // Remove enabled effects state
    this.lastActivity = Date.now();
  }

  updateTrackSound(trackId, newSoundFile) {
    if (this.tracks.has(trackId)) {
      const track = this.tracks.get(trackId);
      track.soundFile = newSoundFile;
      this.tracks.set(trackId, track);
      this.lastActivity = Date.now();
    }
  }

  // ============================================================================
  // EFFECTS MANAGEMENT METHODS
  // ============================================================================

  // Get default effects configuration (matches client-side defaults)
  getDefaultEffects() {
    return {
      eq: { high: 0, mid: 0, low: 0 },
      filter: { frequency: 20000, Q: 1 },
      compressor: { threshold: -24, ratio: 4, attack: 0.01, release: 0.1 },
      chorus: { rate: 1, depth: 0, wet: 0 },
      vibrato: { rate: 5, depth: 0, wet: 0 },
      distortion: { amount: 0, oversample: "2x" },
      pitchShift: { pitch: 0, windowSize: 0.05, wet: 0 },
      reverb: { roomSize: 0.5, decay: 1.5, wet: 0 },
      delay: { delayTime: 0.25, feedback: 0.3, wet: 0 },
    };
  }

  // Initialize effects for a track
  initializeTrackEffects(trackId) {
    this.trackEffects.set(trackId, this.getDefaultEffects());
    this.enabledEffects.set(trackId, {});
    this.lastActivity = Date.now();
  }

  // Set a specific effect parameter
  setTrackEffect(trackId, effectType, parameter, value) {
    if (!this.trackEffects.has(trackId)) {
      this.initializeTrackEffects(trackId);
    }

    const trackEffects = this.trackEffects.get(trackId);
    if (trackEffects[effectType]) {
      trackEffects[effectType][parameter] = value;

      // Update enabled effects based on whether effect has non-default values
      this.updateEnabledEffects(trackId, effectType);
      this.lastActivity = Date.now();
    }
  }

  // Update enabled effects tracking
  updateEnabledEffects(trackId, effectType) {
    const trackEffects = this.trackEffects.get(trackId);
    const defaultEffects = this.getDefaultEffects();
    const enabledEffectsForTrack = this.enabledEffects.get(trackId) || {};

    if (
      trackEffects &&
      trackEffects[effectType] &&
      defaultEffects[effectType]
    ) {
      // Check if any parameter differs from default
      const isEnabled = Object.keys(trackEffects[effectType]).some(
        (param) =>
          trackEffects[effectType][param] !== defaultEffects[effectType][param]
      );

      if (isEnabled) {
        enabledEffectsForTrack[effectType] = true;
      } else {
        delete enabledEffectsForTrack[effectType];
      }

      this.enabledEffects.set(trackId, enabledEffectsForTrack);
    }
  }

  // Reset all effects for a track to defaults
  resetTrackEffects(trackId) {
    if (this.trackEffects.has(trackId)) {
      this.trackEffects.set(trackId, this.getDefaultEffects());
      this.enabledEffects.set(trackId, {});
      this.lastActivity = Date.now();
    }
  }

  // Reset a specific effect to defaults
  resetTrackEffect(trackId, effectType) {
    if (this.trackEffects.has(trackId)) {
      const trackEffects = this.trackEffects.get(trackId);
      const defaultEffects = this.getDefaultEffects();

      if (trackEffects[effectType] && defaultEffects[effectType]) {
        trackEffects[effectType] = { ...defaultEffects[effectType] };
        this.updateEnabledEffects(trackId, effectType);
        this.lastActivity = Date.now();
      }
    }
  }

  // Get effects for a specific track
  getTrackEffects(trackId) {
    return this.trackEffects.get(trackId) || this.getDefaultEffects();
  }

  // Get enabled effects for a specific track
  getTrackEnabledEffects(trackId) {
    return this.enabledEffects.get(trackId) || {};
  }

  // Set complete effects state for a track (used when applying changes)
  setTrackEffectsState(trackId, effectsState) {
    if (!this.trackEffects.has(trackId)) {
      this.initializeTrackEffects(trackId);
    }

    this.trackEffects.set(trackId, { ...effectsState });

    // Recalculate enabled effects
    Object.keys(effectsState).forEach((effectType) => {
      this.updateEnabledEffects(trackId, effectType);
    });

    this.lastActivity = Date.now();
  }
}

// Socket connection handling
io.on("connection", (socket) => {
  console.log(`[${new Date().toISOString()}] User connected: ${socket.id}`);

  socket.on("ping", () => {
    console.log(`[${new Date().toISOString()}] Ping from ${socket.id}`);
  });

  socket.on("pong", (latency) => {
    console.log(
      `[${new Date().toISOString()}] Pong from ${
        socket.id
      }, latency: ${latency}ms`
    );
  });

  // Create new room
  socket.on("create-room", (callback) => {
    const roomId = uuidv4().slice(0, 8);
    const room = new DrumRoom(roomId);
    rooms.set(roomId, room);

    socket.join(roomId);
    room.addUser(socket.id);

    console.log(`Room created: ${roomId} by ${socket.id}`);

    callback({
      success: true,
      roomId,
      roomState: room.getState(),
    });
  });

  // Join existing room
  socket.on("join-room", ({ roomId }, callback) => {
    const room = rooms.get(roomId);

    if (!room) {
      callback({ success: false, error: "Room not found" });
      return;
    }

    socket.join(roomId);
    room.addUser(socket.id);

    console.log(`User ${socket.id} joined room ${roomId}`);

    // Send current room state to joining user
    callback({
      success: true,
      roomState: room.getState(),
    });

    // Notify other users in room
    socket.to(roomId).emit("user-joined", {
      userId: socket.id,
      userCount: room.users.size,
    });
  });

  // Handle pattern changes
  socket.on("pattern-change", ({ roomId, change }) => {
    const room = rooms.get(roomId);
    if (!room || !room.users.has(socket.id)) {
      console.log(`Invalid pattern change request:`, {
        roomId,
        userId: socket.id,
      });
      return;
    }

    console.log(`Pattern change in room ${roomId}:`, change);

    // Apply the change to room state
    switch (change.type) {
      case "add-note":
        room.addNote(change.trackId, change.tick, change.velocity);
        break;

      case "remove-note":
        room.removeNote(change.trackId, change.tick);
        break;

      case "update-note-velocity":
        room.updateNoteVelocity(change.trackId, change.tick, change.velocity);
        break;

      case "move-note":
        room.moveNote(change.trackId, change.fromTick, change.toTick);
        break;

      case "clear-track":
        room.clearTrack(change.trackId);
        break;

      default:
        console.log(`Unknown pattern change type: ${change.type}`);
        return;
    }

    // Broadcast change to all users in room (excluding sender)
    socket.to(roomId).emit("pattern-update", change);
  });

  // Handle transport commands (play/pause/stop)
  socket.on("transport-command", ({ roomId, command }) => {
    const room = rooms.get(roomId);
    if (!room || !room.users.has(socket.id)) {
      console.log(`Invalid transport command:`, { roomId, userId: socket.id });
      return;
    }

    console.log(`Transport command in room ${roomId}:`, command);

    // Add high-precision timestamp for sync
    const syncCommand = {
      ...command,
      timestamp: Date.now(),
    };

    // Broadcast to all users in room with timestamp
    socket.to(roomId).emit("transport-sync", syncCommand);
  });

  // Handle BPM changes
  socket.on("set-bpm", ({ roomId, bpm }) => {
    const room = rooms.get(roomId);
    if (!room || !room.users.has(socket.id)) {
      console.log(`Invalid BPM change:`, { roomId, userId: socket.id });
      return;
    }

    console.log(`BPM change in room ${roomId}: ${room.bpm} -> ${bpm}`);

    room.setBpm(bpm);

    // Broadcast BPM change to all users
    socket.to(roomId).emit("bpm-change", {
      bpm: room.bpm,
      timestamp: Date.now(),
    });
  });

  // Handle measure count changes
  socket.on("set-measure-count", ({ roomId, measureCount }) => {
    const room = rooms.get(roomId);
    if (!room || !room.users.has(socket.id)) {
      console.log(`Invalid measure count change:`, {
        roomId,
        userId: socket.id,
      });
      return;
    }

    console.log(
      `Measure count change in room ${roomId}: ${room.measureCount} -> ${measureCount}`
    );

    room.setMeasureCount(measureCount);

    // Broadcast measure count change to all users
    socket.to(roomId).emit("measure-count-change", {
      measureCount: room.measureCount,
      timestamp: Date.now(),
    });
  });

  // Handle track addition
  socket.on("add-track", ({ roomId, trackData }) => {
    const room = rooms.get(roomId);
    if (!room || !room.users.has(socket.id)) {
      console.log(`Invalid add track request:`, { roomId, userId: socket.id });
      return;
    }

    console.log(`Track added in room ${roomId}:`, trackData);

    room.addTrack(trackData);

    // Broadcast track addition to all users (excluding sender)
    socket.to(roomId).emit("track-added", {
      trackData,
      timestamp: Date.now(),
    });
  });

  // Handle track removal
  socket.on("remove-track", ({ roomId, trackId }) => {
    const room = rooms.get(roomId);
    if (!room || !room.users.has(socket.id)) {
      console.log(`Invalid remove track request:`, {
        roomId,
        userId: socket.id,
      });
      return;
    }

    console.log(`Track removed in room ${roomId}:`, trackId);

    room.removeTrack(trackId);

    // Broadcast track removal to all users (excluding sender)
    socket.to(roomId).emit("track-removed", {
      trackId,
      timestamp: Date.now(),
    });
  });

  // Handle track sound changes
  socket.on("update-track-sound", ({ roomId, trackId, soundFile }) => {
    const room = rooms.get(roomId);
    if (!room || !room.users.has(socket.id)) {
      console.log(`Invalid track sound update:`, { roomId, userId: socket.id });
      return;
    }

    console.log(`Track sound updated in room ${roomId}:`, {
      trackId,
      soundFile,
    });

    room.updateTrackSound(trackId, soundFile);

    // Broadcast sound change to all users (excluding sender)
    socket.to(roomId).emit("track-sound-updated", {
      trackId,
      soundFile,
      timestamp: Date.now(),
    });
  });

  // ============================================================================
  // DYNAMIC EFFECTS SYSTEM
  // ============================================================================

  // Handle effect chain updates (complete enabled effects state)
  socket.on("effect-chain-update", ({ roomId, trackId, enabledEffects }) => {
    const room = rooms.get(roomId);
    if (!room || !room.users.has(socket.id)) {
      console.log(`Invalid effect chain update:`, {
        roomId,
        userId: socket.id,
      });
      return;
    }

    console.log(`Effect chain update in room ${roomId}:`, {
      trackId,
      enabledEffects,
    });

    // Update room state with enabled effects
    if (room.enabledEffects.has(trackId)) {
      room.enabledEffects.set(trackId, { ...enabledEffects });
      room.lastActivity = Date.now();
    }

    // Broadcast effect chain update to all users (excluding sender)
    socket.to(roomId).emit("effect-chain-update", {
      trackId,
      enabledEffects,
      timestamp: Date.now(),
    });
  });

  // Handle effect reset (clears all effects for a track)
  socket.on("effect-reset", ({ roomId, trackId }) => {
    const room = rooms.get(roomId);
    if (!room || !room.users.has(socket.id)) {
      console.log(`Invalid effect reset:`, { roomId, userId: socket.id });
      return;
    }

    console.log(`Effect reset in room ${roomId}:`, trackId);

    // Reset effects in room state
    room.resetTrackEffects(trackId);

    // Broadcast effect reset to all users (excluding sender)
    socket.to(roomId).emit("effect-reset", {
      trackId,
      timestamp: Date.now(),
    });
  });

  // Handle complete effect state application (when user clicks "Apply")
  socket.on("effect-state-apply", ({ roomId, trackId, effectsState }) => {
    const room = rooms.get(roomId);
    if (!room || !room.users.has(socket.id)) {
      console.log(`Invalid effect state apply:`, {
        roomId,
        userId: socket.id,
      });
      return;
    }

    // Validate the complete effects state
    const validation = validateEffectsState(effectsState);
    if (!validation.valid) {
      console.log(`Invalid effects state:`, validation.errors);
      socket.emit("effect-state-error", {
        trackId,
        errors: validation.errors,
        timestamp: Date.now(),
      });
      return;
    }

    console.log(`Effect state apply in room ${roomId}:`, {
      trackId,
      effectsState,
    });

    // Update complete effects state in room
    room.setTrackEffectsState(trackId, effectsState);

    // Broadcast complete effects state to all users (excluding sender)
    socket.to(roomId).emit("effect-state-apply", {
      trackId,
      effectsState,
      enabledEffects: room.getTrackEnabledEffects(trackId),
      timestamp: Date.now(),
    });
  });

  // Get current room state (for periodic sync if needed)
  socket.on("get-room-state", ({ roomId }, callback) => {
    const room = rooms.get(roomId);
    if (room && room.users.has(socket.id)) {
      callback({ success: true, roomState: room.getState() });
    } else {
      callback({ success: false, error: "Room not found or not a member" });
    }
  });

  // Check if rooms exist (for quick rejoin feature)
  socket.on("check-rooms", ({ roomIds }, callback) => {
    const results = roomIds.map((roomId) => {
      const room = rooms.get(roomId);
      return {
        roomId,
        exists: !!room,
        userCount: room ? room.users.size : 0,
      };
    });

    callback({ results });
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(
      `[${new Date().toISOString()}] User disconnected: ${socket.id}`
    );

    // Remove user from all rooms they were in
    rooms.forEach((room, roomId) => {
      if (room.users.has(socket.id)) {
        room.removeUser(socket.id);

        // Notify remaining users
        socket.to(roomId).emit("user-left", {
          userId: socket.id,
          userCount: room.users.size,
        });
      }
    });
  });

  socket.on("leave-room", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || !room.users.has(socket.id)) {
      console.log(`Invalid leave room request:`, { roomId, userId: socket.id });
      return;
    }

    console.log(`User ${socket.id} left room ${roomId}`);

    // Remove user from room but keep socket connection alive
    socket.leave(roomId);
    room.removeUser(socket.id);

    // Notify remaining users in room
    socket.to(roomId).emit("user-left", {
      userId: socket.id,
      userCount: room.users.size,
    });
  });

  socket.on("error", (err) => {
    console.error(`[${new Date().toISOString()}] Socket error:`, err.message);
  });
});

// Updated cleanup with instant deletion for blank rooms, 2-minute grace for modified rooms
setInterval(() => {
  const now = Date.now();
  const MODIFIED_ROOM_TIMEOUT = 1000 * 60 * 2; // 2 minutes for rooms with changes

  rooms.forEach((room, roomId) => {
    // Only check empty rooms
    if (room.users.size === 0) {
      if (room.isBlank()) {
        // Blank room with no users - delete immediately
        rooms.delete(roomId);
        console.log(`Cleaned up blank room: ${roomId} (no changes, no users)`);
      } else if (now - room.lastActivity > MODIFIED_ROOM_TIMEOUT) {
        // Modified room that's been empty for 2+ minutes - delete
        rooms.delete(roomId);
        console.log(`Cleaned up modified room: ${roomId} (empty for 2+ minutes)`);
      }
    }
    // Active rooms with users are NEVER auto-deleted
  });
}, 1000 * 30); // Check every 30 seconds

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Auth API available at /api/auth/* and /api/beats/*`);
  console.log(`WebSocket drum machine running with 2-minute room persistence`);
});
