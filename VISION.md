# Vision Document: "Google Docs for Beats"

## Executive Summary

This document outlines the complete technical vision for transforming a real-time collaborative drum machine into a document-centric beat production platform. The core concept shifts from **ephemeral collaboration sessions** to **persistent beat documents with real-time collaborative editing**, mirroring the paradigm of Google Docs but for music production.

---

## Original State: Ephemeral Session Model (Pre-Refactor)

**NOTE:** This section describes the system BEFORE Phase 1 & 2 refactors. See "CURRENT STATE" section below for up-to-date status.

### Architecture Overview

**Frontend:**
- React 19.1.0 + Vite
- React Router DOM 6.30.0
- Zustand 5.0.5 (state management)
- Socket.io-client 4.8.1 (WebSocket)
- Tone.js 15.1.22 (audio engine)
- Framer Motion 12.12.1 (animations)

**Backend:**
- Node.js + Express.js
- Socket.io (WebSocket server)
- PostgreSQL (persistence)
- JWT authentication
- bcrypt (password hashing)

**Deployment:**
- Frontend: charliedahle.me
- Backend API: api.charliedahle.me

### Original Paradigm (Pre-Refactor)

The application originally operated on a **dual-entity model**:

1. **Rooms (Ephemeral):**
   - Temporary collaboration spaces identified by 8-character UUIDs
   - Stored in-memory on server (Map structure)
   - Contain real-time state (pattern, tracks, BPM, effects, users)
   - Deleted after 2 minutes of inactivity (if modified) or immediately (if blank)
   - No ownership or permissions - anyone with room code has full access
   - No persistence - lost on server restart

2. **Beats (Persistent):**
   - Personal saved documents in PostgreSQL
   - Owned by individual users
   - No collaborative editing - single-owner model
   - Can be loaded into rooms, but no link between beat and room after load

**Key Limitations:**
- No beat ownership or permission system
- No collaborative beat editing (only session collaboration)
- No connection between rooms and saved beats
- No way to share beats with edit/view permissions
- No admittance control for sessions
- All users in a room have equal permissions

---

## Target State: Document-Centric Collaborative Model

### Core Conceptual Shift

**Beats become the primary entity** with persistent collaborative sessions attached to them. The paradigm changes from:

```
OLD: Beat (saved) → Load into → Room (ephemeral) → Discard
NEW: Beat (document) ↔ Session (collaborative editing instance)
```

### Key Concepts

#### 1. Beat Documents
- Persistent musical compositions stored in PostgreSQL
- Each beat has a unique, immutable `beatId` (UUID)
- Beats have owners, collaborators, and visibility settings
- Beats persist indefinitely (unless deleted by owner or orphaned)
- URL structure: `charliedahle.me/DrumMachine/{beatId}`

#### 2. Sessions
- Temporary collaborative editing instances tied to specific beats
- Sessions open when users access a beat
- Sessions maintain real-time WebSocket connections
- Sessions close after inactivity but beats persist
- Session state auto-saves back to beat document

#### 3. User Roles
- **Owner:** Full permissions (edit, delete, manage collaborators, change visibility)
- **Collaborator:** Edit permissions (can modify beat, cannot delete or manage settings)
- **Spectator:** View-only (can see/hear session, cannot interact)

#### 4. User Modes
- **Edit Mode:** Owner/collaborator actively editing beat in session
- **Listening Mode:** Playing back saved beat locally (no session, static playback)
- **Spectating Mode:** Watching live session in real-time (read-only, synced playback)

#### 5. Visibility Settings
- **Public:** Anyone can view/spectate, shows in public gallery
- **Unlisted:** Anyone with link can view/spectate, hidden from gallery
- **Private:** Only collaborators can access, 404 for others

---

## Detailed Feature Specifications

### 1. Beat Access Control System

#### Access Matrix

| Beat Visibility | User Type | Access Level | Behavior |
|-----------------|-----------|--------------|----------|
| **Public** | Owner/Collaborator | Edit | Join session, full editing permissions |
| **Public** | Non-collaborator (signed in) | Spectator | View in listening mode OR spectate active session |
| **Public** | Guest (not signed in) | Spectator | View in listening mode OR spectate active session |
| **Unlisted** | Owner/Collaborator | Edit | Join session, full editing permissions |
| **Unlisted** | Non-collaborator (signed in) | Spectator | View in listening mode OR spectate active session |
| **Unlisted** | Guest (not signed in) | Spectator | View in listening mode OR spectate active session |
| **Private** | Owner/Collaborator | Edit | Join session, full editing permissions |
| **Private** | Non-collaborator | None | 404 - Beat not found |
| **Private** | Guest | None | 404 - Beat not found |

#### Listening Mode vs Spectating Mode

**Listening Mode:**
- Triggered when user visits beat URL and NO active session exists
- Loads beat data from database
- User can play beat back locally (not synced with anyone)
- Local playback controls (play/pause)
- No WebSocket connection
- Static snapshot of saved beat
- Shows "Request to Edit" button (for public/unlisted beats)

**Spectating Mode:**
- Triggered when user visits beat URL and active session exists
- User joins session as spectator via WebSocket
- Sees/hears real-time changes as collaborators edit
- Zero playback controls (pure observation)
- All UI elements greyed out/disabled
- Cursor hovers disabled
- Shows "Request to Edit" button
- Can see who is currently editing

### 2. Admittance Queue System

The admittance queue allows users to request temporary edit access to a beat session without becoming permanent collaborators.

#### Queue Workflow

**For Public/Unlisted Beats:**
1. User lands on beat URL (as spectator in listening/spectating mode)
2. User sees "Request to Edit" button
3. User clicks → Request sent to all owners/collaborators in session
4. Owners/collaborators see notification: "User X wants to edit"
5. Owner/collaborator approves → User promoted to temporary editor
6. User can now edit for duration of session
7. User leaves session → Returns to spectator status
8. If user returns later → Must request access again

**For Private Beats:**
1. Non-collaborator visits beat URL
2. Sees overlay: "This is a private beat. Request access?"
3. If user requests → Enters queue (cannot see/hear beat until admitted)
4. Owners/collaborators in session see queue notification
5. If approved → User joins session with temporary edit access
6. If denied → User sees "Access denied" message

#### Queue Properties
- **Expiration:** Requests expire after 10 minutes OR when session ends
- **Scope:** Queue access is session-only (not permanent collaboration)
- **Notifications:** Only owners/collaborators see queue (spectators do not)
- **Persistence:** Queue stored in database (`session_queue` table) for reliability

#### Queue vs Collaboration

**Queue (Temporary):**
- Granted for single session
- User becomes spectator when session ends
- No permanent relationship to beat
- Can be granted/revoked on the fly
- Used for one-time collaboration or guest participation

**Collaboration (Permanent):**
- Granted via "Share" or "Add Collaborator" feature
- User has persistent edit access across all future sessions
- Appears in user's "Shared With Me" beat list
- Managed by owners through beat settings
- Used for ongoing team collaboration

### 3. Co-Ownership System

Multiple users can be owners of a single beat, with **equal permissions**.

**Owner Permissions:**
- ✅ Edit beat
- ✅ Save changes (auto-save)
- ✅ Delete beat
- ✅ Transfer/grant ownership to others
- ✅ Add/remove collaborators
- ✅ Change beat visibility (public/unlisted/private)
- ✅ Approve/deny queue requests
- ✅ Rename beat

**Collaborator Permissions:**
- ✅ Edit beat
- ✅ Save changes (auto-save)
- ✅ Approve/deny queue requests
- ❌ Delete beat
- ❌ Change visibility
- ❌ Add/remove collaborators
- ❌ Transfer ownership
- ❌ Rename beat

**Spectator Permissions:**
- ✅ View/hear session in real-time
- ✅ Request to edit (join queue)
- ❌ Edit anything
- ❌ Control playback
- ❌ Interact with UI
- ❌ See queue or approve requests

**Business Rules:**
- A beat can have multiple owners (co-ownership)
- All owners have identical permissions
- Cannot remove the last owner (would orphan beat)
- Owners can promote collaborators to co-owners
- Owners can demote other owners to collaborators (if more than one owner exists)

### 4. Guest User Flow

Guests (unauthenticated users) can create and edit beats temporarily, but must sign in to persist their work.

#### Guest Beat Creation Flow

1. **Guest creates new beat:**
   - System generates unique `beatId`
   - Beat created in database with NO entries in `beat_collaborators` (orphan beat)
   - `is_modified = false`
   - Session starts automatically
   - URL: `/DrumMachine/{beatId}`

2. **Guest makes first edit:**
   - `is_modified = true`
   - Tasteful warning banner appears: "Sign in to save your work or it will be lost"
   - Auto-save begins tracking changes (but beat has no owner)

3. **Guest tries to leave page:**
   - Browser shows prompt: "Sign in to save your work?"
   - If "Yes": Auth modal appears (sign in or sign up)
   - If "No": User leaves, beat will be deleted on session termination

4. **Guest signs in:**
   - User authenticated, receives JWT token
   - User automatically added to `beat_collaborators` as owner
   - Beat now persists permanently
   - Warning banner disappears

5. **Signed-in user joins guest beat:**
   - If guest has created beat but not yet signed in
   - First signed-in user to join becomes owner automatically
   - Guest remains in session (as temporary editor/spectator)
   - Beat now persists (has owner)

#### Guest Beat Cleanup

When a session terminates:

```
IF beat.is_modified == false:
  → Delete beat immediately (never edited)

IF beat.is_modified == true:
  → Check beat_collaborators table
    - IF no rows (no owner):
      → Delete beat (orphaned guest beat)
    - ELSE (has owner):
      → Auto-save session state to beat
      → Keep beat (persistent)
```

**Key Point:** Guest beats are deleted when session ends UNLESS someone has signed in and taken ownership.

### 5. Session Lifecycle Management

Sessions are the ephemeral collaborative editing instances tied to persistent beats.

#### Session Creation

**Trigger:** User navigates to `/DrumMachine/{beatId}` with edit permissions

**Flow:**
1. Check if session already exists for this beatId
   - **Exists:** User joins existing session
   - **Does not exist:** Server creates new session from beat data
2. Load beat data from database (pattern, tracks, BPM, effects, etc.)
3. Initialize `DrumSession` instance
4. User joins session via WebSocket
5. Auto-save interval starts (every 2 minutes)

**Session State:**
```javascript
{
  beatId: 'uuid',
  visibility: 'public' | 'unlisted' | 'private',
  isModified: boolean,
  pattern: { trackId: [{ tick, velocity }] },
  tracks: [{ id, name, color, soundFile, volume }],
  bpm: number,
  measureCount: number,
  effects: { trackId: { effectType: {...params} } },
  users: Map<socketId, { userId, username, role }>,
  spectators: Set<socketId>,
  queueRequests: Map<requestId, { userId, username, socketId, expiresAt }>,
  lastActivityAt: timestamp,
  lastSaveAt: timestamp,
  lastEditedBy: userId
}
```

#### Session Termination

**Termination Triggers:**
1. **No users connected** for 2 minutes
2. **All users inactive** (no edits/playback changes) for 10 minutes

**Termination Flow:**
1. Server detects termination condition
2. Server broadcasts `session-terminating` event (30 second countdown)
3. Check if beat has owner:
   - **Has owner AND is_modified = true:** Auto-save session state to database
   - **No owner (orphan guest beat):** Delete beat from database
4. Clear auto-save interval
5. Broadcast `session-terminated` event
6. Disconnect all users
7. Remove session from `activeSessions` map

**Auto-Save on Termination:**
- Always saves before termination if beat has owner
- Updates `beats` table with final session state
- Updates `last_saved_at` and `last_edited_by`

#### Activity Tracking

**Activity Events (reset inactivity timer):**
- Pattern changes (add/remove/move notes)
- Track changes (add/remove/update)
- BPM or measure count changes
- Effect modifications
- Transport commands (play/pause/stop)
- User joins or leaves

**Non-Activity Events (do not reset timer):**
- Spectators joining/leaving
- Queue requests
- Auto-save triggers
- WebSocket heartbeat pings

### 6. Auto-Save System

Beats auto-save during active sessions to prevent data loss.

#### Auto-Save Triggers

1. **Interval-based:** Every 2 minutes (if `is_modified = true`)
2. **Session termination:** Always saves before session ends
3. **Manual save:** User clicks "Save" button (optional feature)

#### Auto-Save Flow

```javascript
// Every 2 minutes in active session:
if (session.isModified && session.hasOwner()) {
  await db.query(`
    UPDATE beats
    SET
      pattern_data = $1,
      tracks_config = $2,
      bpm = $3,
      measure_count = $4,
      effects_state = $5,
      last_saved_at = NOW(),
      last_edited_by = $6
    WHERE id = $7
  `, [session.pattern, session.tracks, session.bpm, ...]);

  session.lastSaveAt = Date.now();

  // Notify all users
  io.to(beatId).emit('beat-auto-saved', {
    beatId,
    savedAt: Date.now(),
    savedBy: session.lastEditedBy
  });
}
```

#### Client-Side Auto-Save Indicator

**UI Display:**
```
"Last saved 2 minutes ago by @username"
"Saving..." (during save)
"All changes saved" (immediately after save)
```

**Behavior:**
- Owners/collaborators see save status
- Spectators do not see save status
- Auto-save does not interrupt user workflow
- No blocking modals or spinners

### 7. Database Schema

#### Modified `beats` Table

```sql
CREATE TABLE beats (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  room_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(), -- Persistent session ID
  visibility VARCHAR(10) CHECK (visibility IN ('public', 'unlisted', 'private')) DEFAULT 'private',
  is_modified BOOLEAN DEFAULT false, -- Has beat been edited

  -- Beat content
  pattern_data JSONB NOT NULL, -- { trackId: [{ tick, velocity }] }
  tracks_config JSONB NOT NULL, -- [{ id, name, color, soundFile, volume }]
  bpm INTEGER DEFAULT 120,
  measure_count INTEGER DEFAULT 4,
  effects_state JSONB, -- { trackId: { effectType: {...params} } }

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_edited_by INTEGER REFERENCES users(id)
);

CREATE INDEX idx_beats_room_id ON beats(room_id);
CREATE INDEX idx_beats_visibility ON beats(visibility);
```

#### New `beat_collaborators` Table

```sql
CREATE TABLE beat_collaborators (
  id SERIAL PRIMARY KEY,
  beat_id INTEGER NOT NULL REFERENCES beats(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'collaborator')),
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  added_by INTEGER REFERENCES users(id), -- Who added this collaborator
  UNIQUE(beat_id, user_id) -- User can only have one role per beat
);

CREATE INDEX idx_beat_collaborators_beat ON beat_collaborators(beat_id);
CREATE INDEX idx_beat_collaborators_user ON beat_collaborators(user_id);
CREATE INDEX idx_beat_collaborators_role ON beat_collaborators(role);
```

**Business Rules:**
- A beat MUST have at least one owner (enforced at application level)
- User cannot be both owner and collaborator on same beat (UNIQUE constraint)
- Deleting a beat cascades to delete all collaborator relationships
- Deleting a user cascades to remove them from all beats

#### New `session_queue` Table

```sql
CREATE TABLE session_queue (
  id SERIAL PRIMARY KEY,
  beat_id INTEGER NOT NULL REFERENCES beats(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- NULL for guests
  guest_identifier VARCHAR(100), -- Socket ID for unauthenticated users
  username VARCHAR(100), -- Display name (from user account or guest input)
  status VARCHAR(20) CHECK (status IN ('pending', 'approved', 'denied')) DEFAULT 'pending',

  -- Timestamps
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 minutes'),
  responded_at TIMESTAMP,
  responded_by INTEGER REFERENCES users(id), -- Owner/collaborator who approved/denied

  -- Metadata
  request_message TEXT -- Optional message from requester
);

CREATE INDEX idx_session_queue_beat ON session_queue(beat_id);
CREATE INDEX idx_session_queue_status ON session_queue(status);
CREATE INDEX idx_session_queue_expires ON session_queue(expires_at);
```

**Cleanup Strategy:**
- Cron job runs every 5 minutes to delete expired requests: `DELETE FROM session_queue WHERE expires_at < NOW()`
- When session terminates, delete all queue requests for that beat
- When beat is deleted, cascade deletes all queue requests

#### Existing `users` Table

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE, -- Optional for future email features
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
```

---

## API Endpoints

### Authentication

#### `POST /api/auth/register`
**Purpose:** Create new user account
**Auth:** None
**Body:**
```json
{
  "username": "string",
  "password": "string"
}
```
**Response:**
```json
{
  "token": "jwt-token",
  "user": { "id": 1, "username": "string" }
}
```

#### `POST /api/auth/login`
**Purpose:** Authenticate existing user
**Auth:** None
**Body:**
```json
{
  "username": "string",
  "password": "string"
}
```
**Response:**
```json
{
  "token": "jwt-token",
  "user": { "id": 1, "username": "string" }
}
```

### Beat Management

#### `GET /api/beats/:id/access`
**Purpose:** Check user's access level to a beat
**Auth:** Optional (JWT if signed in)
**Response:**
```json
{
  "access": "owner" | "collaborator" | "spectator" | "none",
  "beat": {
    "id": 123,
    "name": "My Beat",
    "visibility": "public",
    "room_id": "uuid",
    "bpm": 120,
    "pattern_data": {...},
    "tracks_config": [...],
    "effects_state": {...}
  },
  "session": {
    "active": true,
    "connectedUsers": [
      { "userId": 1, "username": "john", "role": "owner" }
    ]
  }
}
```

**Logic:**
```javascript
// Determine access level:
- User is in beat_collaborators with role='owner' → access: 'owner'
- User is in beat_collaborators with role='collaborator' → access: 'collaborator'
- Beat visibility is 'public' or 'unlisted' → access: 'spectator'
- Beat visibility is 'private' and user not in collaborators → access: 'none'
```

#### `GET /api/beats/:id`
**Purpose:** Load complete beat data
**Auth:** Optional (JWT if signed in)
**Response:**
```json
{
  "id": 123,
  "name": "My Beat",
  "room_id": "uuid",
  "visibility": "public",
  "bpm": 120,
  "measure_count": 4,
  "pattern_data": { "track-1": [{ "tick": 0, "velocity": 3 }] },
  "tracks_config": [
    { "id": "track-1", "name": "Kick", "color": "#FF0000", "soundFile": "kick.wav", "volume": 0.8 }
  ],
  "effects_state": {
    "track-1": {
      "reverb": { "wet": 0.3, "decay": 2.5 }
    }
  },
  "created_at": "2025-01-01T00:00:00Z",
  "last_saved_at": "2025-01-02T12:30:00Z",
  "last_edited_by": { "id": 1, "username": "john" }
}
```

**Access Control:**
- Private beat + no permission → 404
- Public/unlisted beat → Return data (guest can view)
- Owner/collaborator → Return data

#### `POST /api/beats`
**Purpose:** Create new beat
**Auth:** Optional (JWT if signed in)
**Body:**
```json
{
  "name": "Untitled Beat",
  "bpm": 120,
  "measure_count": 4,
  "pattern_data": {},
  "tracks_config": [],
  "effects_state": {}
}
```
**Response:**
```json
{
  "id": 123,
  "room_id": "uuid",
  "name": "Untitled Beat",
  "visibility": "private",
  "is_modified": false
}
```

**Logic:**
```javascript
// If user is authenticated:
- Create beat in beats table
- Add user to beat_collaborators with role='owner'

// If user is guest:
- Create beat in beats table
- Do NOT create entry in beat_collaborators (orphan beat)
- Beat will be deleted on session termination if not claimed
```

#### `PUT /api/beats/:id`
**Purpose:** Update beat (typically via auto-save)
**Auth:** Required (JWT)
**Body:**
```json
{
  "name": "Updated Name",
  "bpm": 130,
  "pattern_data": {...},
  "tracks_config": [...],
  "effects_state": {...}
}
```
**Response:**
```json
{
  "success": true,
  "last_saved_at": "2025-01-02T12:30:00Z"
}
```

**Access Control:**
- User must be owner or collaborator
- Updates `last_edited_by` to current user
- Sets `is_modified = true`
- Updates `last_saved_at` timestamp

#### `DELETE /api/beats/:id`
**Purpose:** Delete beat permanently
**Auth:** Required (JWT)
**Response:**
```json
{ "success": true }
```

**Access Control:**
- User must have role='owner' in beat_collaborators
- Cascades to delete collaborators and queue entries
- If session active, terminates session and disconnects users

#### `PUT /api/beats/:id/visibility`
**Purpose:** Change beat visibility setting
**Auth:** Required (JWT)
**Body:**
```json
{
  "visibility": "public" | "unlisted" | "private"
}
```
**Response:**
```json
{ "success": true }
```

**Access Control:**
- User must be owner

### Collaborator Management

#### `GET /api/beats/:id/collaborators`
**Purpose:** Get list of beat collaborators
**Auth:** Required (JWT)
**Response:**
```json
{
  "collaborators": [
    {
      "id": 1,
      "user_id": 1,
      "username": "john",
      "role": "owner",
      "added_at": "2025-01-01T00:00:00Z",
      "added_by": null
    },
    {
      "id": 2,
      "user_id": 2,
      "username": "jane",
      "role": "collaborator",
      "added_at": "2025-01-02T10:00:00Z",
      "added_by": 1
    }
  ]
}
```

**Access Control:**
- User must be owner or collaborator

#### `POST /api/beats/:id/collaborators`
**Purpose:** Add collaborator to beat
**Auth:** Required (JWT)
**Body:**
```json
{
  "userId": 2,
  "role": "owner" | "collaborator"
}
```
**Response:**
```json
{ "success": true }
```

**Access Control:**
- User must be owner
- Cannot add duplicate collaborator (UNIQUE constraint)

#### `PUT /api/beats/:id/collaborators/:userId`
**Purpose:** Change collaborator role
**Auth:** Required (JWT)
**Body:**
```json
{
  "role": "owner" | "collaborator"
}
```
**Response:**
```json
{ "success": true }
```

**Access Control:**
- User must be owner
- Cannot demote last owner (would orphan beat)

#### `DELETE /api/beats/:id/collaborators/:userId`
**Purpose:** Remove collaborator from beat
**Auth:** Required (JWT)
**Response:**
```json
{ "success": true }
```

**Access Control:**
- User must be owner
- Cannot remove last owner (would orphan beat)

### Beat Discovery

#### `GET /api/beats/my-beats`
**Purpose:** Get beats owned by current user
**Auth:** Required (JWT)
**Response:**
```json
{
  "beats": [
    {
      "id": 123,
      "name": "My Beat",
      "visibility": "public",
      "bpm": 120,
      "created_at": "2025-01-01T00:00:00Z",
      "last_saved_at": "2025-01-02T12:30:00Z",
      "collaborator_count": 3
    }
  ]
}
```

**Query:**
```sql
SELECT b.*, COUNT(bc2.id) as collaborator_count
FROM beats b
JOIN beat_collaborators bc ON b.id = bc.beat_id
LEFT JOIN beat_collaborators bc2 ON b.id = bc2.beat_id
WHERE bc.user_id = $userId AND bc.role = 'owner'
GROUP BY b.id
ORDER BY b.last_saved_at DESC;
```

#### `GET /api/beats/shared-with-me`
**Purpose:** Get beats where user is collaborator (not owner)
**Auth:** Required (JWT)
**Response:**
```json
{
  "beats": [
    {
      "id": 124,
      "name": "Shared Beat",
      "visibility": "private",
      "bpm": 140,
      "owner": { "id": 1, "username": "john" },
      "added_at": "2025-01-02T10:00:00Z"
    }
  ]
}
```

**Query:**
```sql
SELECT b.*, bc.added_at, u.id as owner_id, u.username as owner_username
FROM beats b
JOIN beat_collaborators bc ON b.id = bc.beat_id
JOIN beat_collaborators bc_owner ON b.id = bc_owner.beat_id AND bc_owner.role = 'owner'
JOIN users u ON bc_owner.user_id = u.id
WHERE bc.user_id = $userId AND bc.role = 'collaborator'
ORDER BY bc.added_at DESC;
```

#### `GET /api/beats/public`
**Purpose:** Get all public beats (gallery)
**Auth:** None
**Query Params:**
- `limit` (default: 50)
- `offset` (default: 0)
- `sort` (default: 'recent', options: 'recent', 'popular')

**Response:**
```json
{
  "beats": [
    {
      "id": 125,
      "name": "Public Beat",
      "visibility": "public",
      "bpm": 128,
      "owner": { "id": 1, "username": "john" },
      "created_at": "2025-01-01T00:00:00Z"
    }
  ],
  "total": 100,
  "hasMore": true
}
```

---

## WebSocket Events

### Connection & Authentication

#### Client → Server: `authenticate`
**Purpose:** Authenticate WebSocket connection with JWT
**Payload:**
```json
{
  "token": "jwt-token" | null
}
```

#### Server → Client: `authenticated`
**Purpose:** Confirm authentication status
**Payload:**
```json
{
  "userId": 1,
  "username": "john"
}
```

Or for guests:
```json
{
  "userId": null,
  "username": null,
  "socketId": "abc123"
}
```

### Session Management

#### Client → Server: `join-beat`
**Purpose:** Join beat session (as editor or spectator)
**Payload:**
```json
{
  "beatId": "uuid",
  "asSpectator": false
}
```

#### Server → Client: `session-joined`
**Purpose:** Confirm successful session join
**Payload:**
```json
{
  "beatId": "uuid",
  "role": "owner" | "collaborator" | "spectator",
  "beatData": {
    "name": "My Beat",
    "bpm": 120,
    "pattern": {...},
    "tracks": [...],
    "effects": {...}
  },
  "connectedUsers": [
    { "userId": 1, "username": "john", "role": "owner" },
    { "userId": 2, "username": "jane", "role": "spectator" }
  ],
  "queueRequests": [
    { "id": 1, "username": "guest123", "requestedAt": "2025-01-02T12:00:00Z" }
  ]
}
```

**Note:** `queueRequests` only included if user is owner/collaborator

#### Server → Client: `session-join-failed`
**Purpose:** Notify failed join attempt
**Payload:**
```json
{
  "reason": "not-found" | "private" | "no-permission",
  "message": "This beat is private"
}
```

#### Client → Server: `leave-beat`
**Purpose:** Leave current session
**Payload:**
```json
{
  "beatId": "uuid"
}
```

#### Server → All in Session: `user-joined-session`
**Purpose:** Notify all users when someone joins
**Payload:**
```json
{
  "userId": 1,
  "username": "john",
  "role": "owner" | "collaborator" | "spectator"
}
```

#### Server → All in Session: `user-left-session`
**Purpose:** Notify all users when someone leaves
**Payload:**
```json
{
  "userId": 1,
  "username": "john"
}
```

### Admittance Queue

#### Client → Server: `request-edit-access`
**Purpose:** Request temporary edit access to session
**Payload:**
```json
{
  "beatId": "uuid",
  "username": "Guest User", // For guests, omitted if authenticated
  "message": "Can I join?" // Optional
}
```

#### Server → Owners/Collaborators: `queue-request-added`
**Purpose:** Notify owners/collaborators of new queue request
**Payload:**
```json
{
  "requestId": 123,
  "userId": 2 | null,
  "username": "jane",
  "requestedAt": "2025-01-02T12:00:00Z",
  "message": "Can I join?"
}
```

#### Client → Server: `respond-to-queue-request`
**Purpose:** Approve or deny queue request
**Payload:**
```json
{
  "requestId": 123,
  "approve": true | false
}
```

**Access Control:**
- User must be owner or collaborator
- Request must be in 'pending' status

#### Server → Requester: `edit-access-granted`
**Purpose:** Notify requester they were approved
**Payload:**
```json
{
  "beatId": "uuid",
  "message": "You can now edit this beat"
}
```

**Side Effect:**
- User's role promoted from 'spectator' to temporary editor
- User receives all subsequent session updates as editor
- User can now emit pattern/transport changes

#### Server → Requester: `edit-access-denied`
**Purpose:** Notify requester they were denied
**Payload:**
```json
{
  "beatId": "uuid",
  "message": "Your request was denied"
}
```

#### Server → Requester: `queue-request-expired`
**Purpose:** Notify requester their request expired
**Payload:**
```json
{
  "requestId": 123,
  "message": "Your request has expired"
}
```

**Trigger:** Request older than 10 minutes OR session terminated

### Pattern & Transport Events (Existing, Unchanged)

#### Client → Server: `pattern-change`
**Purpose:** Modify beat pattern
**Payload:**
```json
{
  "action": "add" | "remove" | "move" | "velocity",
  "trackId": "track-1",
  "tick": 0,
  "velocity": 3,
  "newTick": 4 // For move action
}
```

**Access Control:**
- User must be owner, collaborator, or approved queue user
- Spectators cannot emit this event

#### Server → All in Session: `pattern-update`
**Purpose:** Broadcast pattern change to all users
**Payload:** Same as `pattern-change`

#### Client → Server: `transport-command`
**Purpose:** Control playback
**Payload:**
```json
{
  "command": "play" | "pause" | "stop"
}
```

**Access Control:**
- User must be owner, collaborator, or approved queue user

#### Server → All in Session: `transport-sync`
**Purpose:** Sync playback state to all users
**Payload:**
```json
{
  "command": "play" | "pause" | "stop",
  "currentTick": 0
}
```

#### Client → Server: `set-bpm`
**Purpose:** Change tempo
**Payload:**
```json
{
  "bpm": 140
}
```

#### Server → All in Session: `bpm-change`
**Purpose:** Broadcast BPM change
**Payload:**
```json
{
  "bpm": 140
}
```

#### Client → Server: `set-measure-count`
**Purpose:** Change beat length
**Payload:**
```json
{
  "measureCount": 8
}
```

#### Server → All in Session: `measure-count-change`
**Purpose:** Broadcast measure count change
**Payload:**
```json
{
  "measureCount": 8
}
```

### Track Management Events (Existing, Unchanged)

#### Client → Server: `add-track`
**Payload:**
```json
{
  "track": {
    "id": "track-2",
    "name": "Snare",
    "color": "#00FF00",
    "soundFile": "snare.wav",
    "volume": 0.8
  }
}
```

#### Server → All in Session: `track-added`
**Payload:** Same as `add-track`

#### Client → Server: `remove-track`
**Payload:**
```json
{
  "trackId": "track-2"
}
```

#### Server → All in Session: `track-removed`
**Payload:** Same as `remove-track`

#### Client → Server: `update-track-sound`
**Payload:**
```json
{
  "trackId": "track-1",
  "soundFile": "kick-deep.wav"
}
```

#### Server → All in Session: `track-sound-updated`
**Payload:** Same as `update-track-sound`

### Effects Events (Existing, Unchanged)

#### Client → Server: `effect-chain-update`
**Payload:**
```json
{
  "trackId": "track-1",
  "effectType": "reverb",
  "enabled": true
}
```

#### Server → All in Session: `effect-chain-update`
**Payload:** Same as client event

#### Client → Server: `effect-state-apply`
**Payload:**
```json
{
  "trackId": "track-1",
  "effects": {
    "reverb": { "wet": 0.3, "decay": 2.5 },
    "delay": { "delayTime": 0.25, "feedback": 0.4 }
  }
}
```

#### Server → All in Session: `effect-state-apply`
**Payload:** Same as client event

### Auto-Save Events

#### Server → All in Session: `beat-auto-saved`
**Purpose:** Notify users that beat was auto-saved
**Payload:**
```json
{
  "beatId": "uuid",
  "savedAt": "2025-01-02T12:30:00Z",
  "savedBy": 1,
  "savedByUsername": "john"
}
```

**Trigger:**
- Every 2 minutes (if `is_modified = true`)
- Before session termination
- Manual save (if implemented)

### Session Termination Events

#### Server → All in Session: `session-terminating`
**Purpose:** Warn users session is about to end
**Payload:**
```json
{
  "reason": "inactivity" | "no-users",
  "countdown": 30 // seconds
}
```

**Trigger:**
- 30 seconds before termination
- Gives users time to finish edits

#### Server → All in Session: `session-terminated`
**Purpose:** Notify users session has ended
**Payload:**
```json
{
  "beatId": "uuid",
  "reason": "inactivity" | "no-users"
}
```

**Side Effect:**
- All users disconnected from session
- Session removed from server memory
- Beat saved to database (if has owner)

---

## Frontend Architecture

### Component Structure

#### New Components

**`ListeningMode.jsx`**
- **Purpose:** Static playback of saved beat (no session)
- **Renders when:** User visits public/unlisted beat with no active session
- **Features:**
  - Loads beat data from API
  - Local playback controls (play/pause)
  - Displays beat pattern (read-only)
  - "Request to Edit" button (joins queue)
  - No WebSocket connection
  - Visual indicator: "Listening Mode"

**`SpectatorMode.jsx`**
- **Purpose:** Real-time viewing of active session
- **Renders when:** User visits beat as spectator (public/unlisted + session active)
- **Features:**
  - WebSocket connection (receive-only)
  - All UI elements greyed out/disabled
  - No hover states on interactive elements
  - Sees real-time pattern/transport changes
  - Cannot control playback
  - "Request to Edit" button
  - Shows connected users
  - Visual indicator: "Spectating - View Only"

**`SessionQueue.jsx`**
- **Purpose:** Display and manage queue requests
- **Renders when:** User is owner/collaborator
- **Features:**
  - List of pending requests
  - User info (username, request time)
  - Approve/Deny buttons
  - Real-time updates when new requests arrive
  - Notification badge on header
  - Auto-remove expired requests

**`GuestAuthPrompt.jsx`**
- **Purpose:** Prompt guests to sign in to save work
- **Renders when:** Guest user edits beat
- **Features:**
  - Tasteful warning banner: "Sign in to save your work or it will be lost"
  - "Sign In" button → Opens auth modal
  - "Sign Up" button → Opens registration modal
  - Dismissable (but reappears on page refresh)
  - Shows when `is_modified = true` and user is guest

**`AuthModal.jsx`**
- **Purpose:** In-place authentication without page reload
- **Features:**
  - Sign In tab
  - Sign Up tab
  - Username/password fields
  - Form validation
  - JWT token stored in localStorage on success
  - Updates Zustand auth state
  - Closes and refreshes permissions after auth

**`BeatVisibilityToggle.jsx`**
- **Purpose:** Change beat visibility setting
- **Renders when:** User is owner
- **Features:**
  - Dropdown: Public / Unlisted / Private
  - Visual indicators for each mode
  - API call to update visibility
  - Confirmation modal for public → private (warns about removing access)

**`CollaboratorManager.jsx`**
- **Purpose:** Manage beat collaborators
- **Renders when:** User is owner
- **Features:**
  - List of current collaborators (owner/collaborator badges)
  - "Add Collaborator" button → Search users
  - Role dropdown (owner/collaborator)
  - Remove button (with confirmation)
  - Cannot remove last owner (disabled)

#### Modified Components

**`DrumMachine.jsx`** - Major Refactor
```javascript
// New flow:
function DrumMachine() {
  const { beatId } = useParams();
  const { mode, userRole, checkAccess, joinSession } = useAppStore();

  useEffect(() => {
    // 1. Check access level
    const access = await checkAccess(beatId);

    // 2. Determine mode
    if (access.level === 'owner' || access.level === 'collaborator') {
      setMode('edit');
      joinSession(beatId, false); // Join as editor
    } else if (access.level === 'spectator') {
      if (access.session.active) {
        setMode('spectating');
        joinSession(beatId, true); // Join as spectator
      } else {
        setMode('listening');
        loadBeatData(beatId); // Load without WebSocket
      }
    } else {
      // No access (private beat)
      navigate('/404');
    }
  }, [beatId]);

  // 3. Render appropriate mode
  if (mode === 'listening') {
    return <ListeningMode beatId={beatId} />;
  }

  if (mode === 'spectating') {
    return (
      <>
        <SpectatorBanner />
        <DrumGrid disabled={true} />
        <TransportControls disabled={true} />
      </>
    );
  }

  // Edit mode (existing functionality)
  return (
    <>
      {userRole === 'guest' && <GuestAuthPrompt />}
      {(userRole === 'owner' || userRole === 'collaborator') && <SessionQueue />}
      <DrumGrid disabled={false} />
      <TransportControls disabled={false} />
      <EffectsPanel disabled={false} />
    </>
  );
}
```

**`BeatsPage.jsx`** - Enhanced
```javascript
function BeatsPage() {
  const [activeTab, setActiveTab] = useState('my-beats');

  return (
    <div>
      <Tabs>
        <Tab label="My Beats" active={activeTab === 'my-beats'} />
        <Tab label="Shared With Me" active={activeTab === 'shared'} />
        <Tab label="Public Gallery" active={activeTab === 'public'} />
      </Tabs>

      {activeTab === 'my-beats' && <MyBeatsGrid />}
      {activeTab === 'shared' && <SharedBeatsGrid />}
      {activeTab === 'public' && <PublicGalleryGrid />}
    </div>
  );
}
```

**`BeatCard.jsx`** - New Actions
```javascript
function BeatCard({ beat, userRole }) {
  return (
    <Card>
      <h3>{beat.name}</h3>
      <p>BPM: {beat.bpm}</p>
      <p>Last saved: {beat.last_saved_at}</p>

      <Actions>
        <Button onClick={() => navigate(`/DrumMachine/${beat.room_id}`)}>
          Open
        </Button>

        {userRole === 'owner' && (
          <>
            <Button onClick={() => openRenameModal(beat.id)}>Rename</Button>
            <Button onClick={() => openVisibilityModal(beat.id)}>
              {beat.visibility === 'public' ? 'Public' : 'Private'}
            </Button>
            <Button onClick={() => openCollaboratorsModal(beat.id)}>
              Collaborators ({beat.collaborator_count})
            </Button>
            <Button onClick={() => deleteBeat(beat.id)} variant="danger">
              Delete
            </Button>
          </>
        )}

        <Button onClick={() => copyShareLink(beat.room_id)}>
          Share Link
        </Button>
      </Actions>
    </Card>
  );
}
```

### State Management (Zustand)

**New Session Slice:**
```javascript
sessionSlice: {
  // State
  beatId: null,
  sessionActive: false,
  mode: null, // 'edit' | 'listening' | 'spectating'
  userRole: null, // 'owner' | 'collaborator' | 'spectator' | 'guest'
  connectedUsers: [],
  queueRequests: [],

  // Actions
  checkAccess: async (beatId) => {
    const res = await fetch(`/api/beats/${beatId}/access`);
    const data = await res.json();
    set({ userRole: data.access });
    return data;
  },

  joinSession: (beatId, asSpectator) => {
    socket.emit('join-beat', { beatId, asSpectator });
  },

  leaveSession: () => {
    socket.emit('leave-beat', { beatId: get().beatId });
    set({ sessionActive: false, beatId: null });
  },

  requestEditAccess: () => {
    socket.emit('request-edit-access', { beatId: get().beatId });
  },

  respondToQueueRequest: (requestId, approve) => {
    socket.emit('respond-to-queue-request', { requestId, approve });
  },

  // WebSocket listeners
  onSessionJoined: (data) => {
    set({
      sessionActive: true,
      beatId: data.beatId,
      connectedUsers: data.connectedUsers,
      queueRequests: data.queueRequests || []
    });
  },

  onQueueRequestAdded: (request) => {
    set((state) => ({
      queueRequests: [...state.queueRequests, request]
    }));
  },

  onUserJoinedSession: (user) => {
    set((state) => ({
      connectedUsers: [...state.connectedUsers, user]
    }));
  },

  onUserLeftSession: (user) => {
    set((state) => ({
      connectedUsers: state.connectedUsers.filter(u => u.userId !== user.userId)
    }));
  }
}
```

**Modified Beats Slice:**
```javascript
beatsSlice: {
  // ... existing properties
  visibility: 'private',
  collaborators: [],

  // New actions
  setVisibility: async (beatId, visibility) => {
    await fetch(`/api/beats/${beatId}/visibility`, {
      method: 'PUT',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility })
    });
    set({ visibility });
  },

  addCollaborator: async (beatId, userId, role) => {
    await fetch(`/api/beats/${beatId}/collaborators`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role })
    });
    // Refresh collaborators list
    get().fetchCollaborators(beatId);
  },

  removeCollaborator: async (beatId, userId) => {
    await fetch(`/api/beats/${beatId}/collaborators/${userId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    get().fetchCollaborators(beatId);
  },

  fetchCollaborators: async (beatId) => {
    const res = await fetch(`/api/beats/${beatId}/collaborators`, {
      headers: getAuthHeaders()
    });
    const data = await res.json();
    set({ collaborators: data.collaborators });
  }
}
```

### Routing Updates

**`main.jsx`:**
```javascript
<Routes>
  <Route path="/" element={<Home />} />
  <Route path="/DrumMachine/:beatId" element={<DrumMachine />} />
  <Route path="/beats" element={<ProtectedRoute element={<BeatsPage />} />} />
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />
  <Route path="*" element={<Navigate to="/" />} />
</Routes>
```

**Note:** No `?viewing=true` parameter needed - mode is determined by permissions and session state

---

## Server-Side Implementation

### DrumSession Class (Replacing DrumRoom)

```javascript
class DrumSession {
  constructor(beatId, beatData) {
    this.beatId = beatId;
    this.visibility = beatData.visibility;
    this.isModified = beatData.is_modified;

    // Beat content
    this.pattern = beatData.pattern_data;
    this.tracks = beatData.tracks_config;
    this.bpm = beatData.bpm;
    this.measureCount = beatData.measure_count;
    this.effects = beatData.effects_state;

    // Session management
    this.users = new Map(); // socketId → {userId, username, role}
    this.spectators = new Set(); // socketIds
    this.queueRequests = new Map(); // requestId → {userId, username, socketId, expiresAt}

    // Timestamps
    this.createdAt = Date.now();
    this.lastActivityAt = Date.now();
    this.lastSaveAt = Date.now();
    this.lastEditedBy = null;

    // Auto-save interval (every 2 minutes)
    this.autoSaveInterval = setInterval(() => this.autoSave(), 120000);

    // Inactivity check interval (every 30 seconds)
    this.inactivityCheckInterval = setInterval(() => this.checkInactivity(), 30000);
  }

  // User management
  addUser(socketId, userId, username, role) {
    if (role === 'spectator') {
      this.spectators.add(socketId);
    } else {
      this.users.set(socketId, { userId, username, role });
      this.lastActivityAt = Date.now();
    }

    return {
      beatData: this.getBeatData(),
      connectedUsers: this.getConnectedUsers(),
      queueRequests: role !== 'spectator' ? this.getQueueRequests() : undefined
    };
  }

  removeUser(socketId) {
    this.users.delete(socketId);
    this.spectators.delete(socketId);

    // Start shutdown timer if no users left
    if (this.users.size === 0 && this.spectators.size === 0) {
      this.startShutdownTimer();
    }
  }

  promoteSpectator(socketId, userId, username) {
    this.spectators.delete(socketId);
    this.users.set(socketId, { userId, username, role: 'approved-editor' });
    this.lastActivityAt = Date.now();
  }

  // Pattern/transport changes
  handleChange(changeData, socketId) {
    const user = this.users.get(socketId);

    // Validate: Only editors can make changes
    if (!user) {
      return false; // Spectators blocked
    }

    this.isModified = true;
    this.lastActivityAt = Date.now();
    this.lastEditedBy = user.userId;

    // Apply change to session state
    switch (changeData.action) {
      case 'add':
        this.addNote(changeData.trackId, changeData.tick, changeData.velocity);
        break;
      case 'remove':
        this.removeNote(changeData.trackId, changeData.tick);
        break;
      // ... other actions
    }

    return true;
  }

  // Queue management
  addQueueRequest(requestId, userId, username, socketId) {
    this.queueRequests.set(requestId, {
      userId,
      username,
      socketId,
      expiresAt: Date.now() + 600000 // 10 minutes
    });
  }

  removeQueueRequest(requestId) {
    this.queueRequests.delete(requestId);
  }

  getQueueRequests() {
    return Array.from(this.queueRequests.entries()).map(([id, data]) => ({
      requestId: id,
      userId: data.userId,
      username: data.username,
      requestedAt: data.expiresAt - 600000
    }));
  }

  // Auto-save
  async autoSave() {
    if (!this.isModified) return;

    const hasOwner = await this.checkHasOwner();
    if (!hasOwner) {
      console.log(`Skipping auto-save for orphan beat ${this.beatId}`);
      return;
    }

    await this.saveToDB();
    this.lastSaveAt = Date.now();

    // Notify users
    io.to(this.beatId).emit('beat-auto-saved', {
      beatId: this.beatId,
      savedAt: new Date().toISOString(),
      savedBy: this.lastEditedBy
    });
  }

  async saveToDB() {
    await db.query(`
      UPDATE beats
      SET
        pattern_data = $1,
        tracks_config = $2,
        bpm = $3,
        measure_count = $4,
        effects_state = $5,
        is_modified = $6,
        last_saved_at = NOW(),
        last_edited_by = $7
      WHERE room_id = $8
    `, [
      JSON.stringify(this.pattern),
      JSON.stringify(this.tracks),
      this.bpm,
      this.measureCount,
      JSON.stringify(this.effects),
      this.isModified,
      this.lastEditedBy,
      this.beatId
    ]);
  }

  async checkHasOwner() {
    const result = await db.query(`
      SELECT b.id
      FROM beats b
      JOIN beat_collaborators bc ON b.id = bc.beat_id
      WHERE b.room_id = $1
      LIMIT 1
    `, [this.beatId]);

    return result.rows.length > 0;
  }

  // Inactivity & termination
  checkInactivity() {
    const now = Date.now();
    const timeSinceActivity = now - this.lastActivityAt;
    const userCount = this.users.size;

    // No users for 2 minutes
    if (userCount === 0 && timeSinceActivity > 120000) {
      this.terminate('no-users');
    }

    // All users inactive for 10 minutes
    if (userCount > 0 && timeSinceActivity > 600000) {
      this.terminate('inactivity');
    }
  }

  startShutdownTimer() {
    if (this.shutdownTimer) return;

    this.shutdownTimer = setTimeout(() => {
      this.terminate('no-users');
    }, 120000); // 2 minutes
  }

  async terminate(reason) {
    console.log(`Terminating session ${this.beatId} (reason: ${reason})`);

    // Clear intervals
    clearInterval(this.autoSaveInterval);
    clearInterval(this.inactivityCheckInterval);
    clearTimeout(this.shutdownTimer);

    // Check if beat has owner
    const hasOwner = await this.checkHasOwner();

    if (hasOwner && this.isModified) {
      // Save before termination
      await this.saveToDB();
      console.log(`Saved beat ${this.beatId} before termination`);
    } else if (!hasOwner) {
      // Delete orphan guest beat
      await this.deleteBeat();
      console.log(`Deleted orphan beat ${this.beatId}`);
    }

    // Clean up queue requests
    await db.query('DELETE FROM session_queue WHERE beat_id = (SELECT id FROM beats WHERE room_id = $1)', [this.beatId]);

    // Notify all users
    io.to(this.beatId).emit('session-terminated', {
      beatId: this.beatId,
      reason
    });

    // Remove from active sessions
    activeSessions.delete(this.beatId);
  }

  async deleteBeat() {
    await db.query('DELETE FROM beats WHERE room_id = $1', [this.beatId]);
  }

  // Utility methods
  getBeatData() {
    return {
      name: this.name,
      bpm: this.bpm,
      measureCount: this.measureCount,
      pattern: this.pattern,
      tracks: this.tracks,
      effects: this.effects
    };
  }

  getConnectedUsers() {
    return Array.from(this.users.values()).map(u => ({
      userId: u.userId,
      username: u.username,
      role: u.role
    }));
  }
}
```

### WebSocket Event Handlers

```javascript
io.on('connection', (socket) => {
  let currentBeatId = null;
  let currentUserId = null;
  let currentUsername = null;

  // Authentication
  socket.on('authenticate', async ({ token }) => {
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        currentUserId = decoded.userId;

        const userResult = await db.query('SELECT username FROM users WHERE id = $1', [currentUserId]);
        currentUsername = userResult.rows[0].username;

        socket.emit('authenticated', {
          userId: currentUserId,
          username: currentUsername
        });
      } catch (err) {
        socket.emit('authenticated', { userId: null, username: null, socketId: socket.id });
      }
    } else {
      // Guest user
      socket.emit('authenticated', { userId: null, username: null, socketId: socket.id });
    }
  });

  // Join beat session
  socket.on('join-beat', async ({ beatId, asSpectator }) => {
    try {
      // Check permissions
      const access = await checkBeatAccess(beatId, currentUserId);

      if (access.level === 'none') {
        socket.emit('session-join-failed', { reason: 'no-permission' });
        return;
      }

      // Determine role
      let role;
      if (asSpectator || access.level === 'spectator') {
        role = 'spectator';
      } else {
        role = access.level; // 'owner' or 'collaborator'
      }

      // Get or create session
      let session = activeSessions.get(beatId);
      if (!session) {
        const beatData = await loadBeatFromDB(beatId);
        session = new DrumSession(beatId, beatData);
        activeSessions.set(beatId, session);
      }

      // Add user to session
      const sessionData = session.addUser(socket.id, currentUserId, currentUsername, role);

      // Join Socket.io room
      socket.join(beatId);
      currentBeatId = beatId;

      // Send session data to user
      socket.emit('session-joined', {
        beatId,
        role,
        beatData: sessionData.beatData,
        connectedUsers: sessionData.connectedUsers,
        queueRequests: sessionData.queueRequests
      });

      // Notify others
      socket.to(beatId).emit('user-joined-session', {
        userId: currentUserId,
        username: currentUsername,
        role
      });

    } catch (err) {
      console.error('Error joining beat:', err);
      socket.emit('session-join-failed', { reason: 'error', message: err.message });
    }
  });

  // Leave beat session
  socket.on('leave-beat', () => {
    if (!currentBeatId) return;

    const session = activeSessions.get(currentBeatId);
    if (session) {
      session.removeUser(socket.id);

      socket.to(currentBeatId).emit('user-left-session', {
        userId: currentUserId,
        username: currentUsername
      });
    }

    socket.leave(currentBeatId);
    currentBeatId = null;
  });

  // Request edit access (join queue)
  socket.on('request-edit-access', async ({ beatId, username, message }) => {
    const displayName = currentUsername || username || 'Guest';

    // Save to database
    const result = await db.query(`
      INSERT INTO session_queue (beat_id, user_id, guest_identifier, username, request_message)
      VALUES (
        (SELECT id FROM beats WHERE room_id = $1),
        $2,
        $3,
        $4,
        $5
      )
      RETURNING id
    `, [beatId, currentUserId, socket.id, displayName, message]);

    const requestId = result.rows[0].id;

    // Add to session queue
    const session = activeSessions.get(beatId);
    if (session) {
      session.addQueueRequest(requestId, currentUserId, displayName, socket.id);
    }

    // Notify owners/collaborators
    socket.to(beatId).emit('queue-request-added', {
      requestId,
      userId: currentUserId,
      username: displayName,
      requestedAt: new Date().toISOString(),
      message
    });
  });

  // Respond to queue request
  socket.on('respond-to-queue-request', async ({ requestId, approve }) => {
    // Verify user is owner/collaborator
    const session = activeSessions.get(currentBeatId);
    if (!session) return;

    const user = session.users.get(socket.id);
    if (!user || (user.role !== 'owner' && user.role !== 'collaborator')) {
      return; // Not authorized
    }

    // Update database
    await db.query(`
      UPDATE session_queue
      SET status = $1, responded_by = $2, responded_at = NOW()
      WHERE id = $3
    `, [approve ? 'approved' : 'denied', currentUserId, requestId]);

    // Get requester info
    const queueEntry = session.queueRequests.get(requestId);
    if (!queueEntry) return;

    if (approve) {
      // Promote spectator to editor
      session.promoteSpectator(queueEntry.socketId, queueEntry.userId, queueEntry.username);

      // Notify requester
      io.to(queueEntry.socketId).emit('edit-access-granted', {
        beatId: currentBeatId,
        message: 'You can now edit this beat'
      });

      // Notify all users of role change
      io.to(currentBeatId).emit('user-role-changed', {
        userId: queueEntry.userId,
        username: queueEntry.username,
        role: 'approved-editor'
      });
    } else {
      // Notify requester of denial
      io.to(queueEntry.socketId).emit('edit-access-denied', {
        beatId: currentBeatId,
        message: 'Your request was denied'
      });
    }

    // Remove from queue
    session.removeQueueRequest(requestId);
  });

  // Pattern changes
  socket.on('pattern-change', (data) => {
    const session = activeSessions.get(currentBeatId);
    if (!session) return;

    const allowed = session.handleChange(data, socket.id);
    if (!allowed) return; // Spectator tried to edit

    // Broadcast to others
    socket.to(currentBeatId).emit('pattern-update', data);
  });

  // Transport commands
  socket.on('transport-command', (data) => {
    const session = activeSessions.get(currentBeatId);
    if (!session) return;

    const user = session.users.get(socket.id);
    if (!user) return; // Spectator

    session.lastActivityAt = Date.now();

    // Broadcast to all (including sender for sync)
    io.to(currentBeatId).emit('transport-sync', data);
  });

  // BPM changes
  socket.on('set-bpm', (data) => {
    const session = activeSessions.get(currentBeatId);
    if (!session) return;

    const user = session.users.get(socket.id);
    if (!user) return;

    session.bpm = data.bpm;
    session.isModified = true;
    session.lastActivityAt = Date.now();
    session.lastEditedBy = currentUserId;

    socket.to(currentBeatId).emit('bpm-change', data);
  });

  // ... other event handlers (tracks, effects, etc.)

  // Disconnect
  socket.on('disconnect', () => {
    if (currentBeatId) {
      const session = activeSessions.get(currentBeatId);
      if (session) {
        session.removeUser(socket.id);

        socket.to(currentBeatId).emit('user-left-session', {
          userId: currentUserId,
          username: currentUsername
        });
      }
    }
  });
});

// Helper functions
async function checkBeatAccess(beatId, userId) {
  // Check if user is owner/collaborator
  const collabResult = await db.query(`
    SELECT bc.role
    FROM beats b
    JOIN beat_collaborators bc ON b.id = bc.beat_id
    WHERE b.room_id = $1 AND bc.user_id = $2
  `, [beatId, userId]);

  if (collabResult.rows.length > 0) {
    return { level: collabResult.rows[0].role }; // 'owner' or 'collaborator'
  }

  // Check beat visibility
  const beatResult = await db.query('SELECT visibility FROM beats WHERE room_id = $1', [beatId]);

  if (beatResult.rows.length === 0) {
    return { level: 'none' }; // Beat doesn't exist
  }

  const visibility = beatResult.rows[0].visibility;

  if (visibility === 'public' || visibility === 'unlisted') {
    return { level: 'spectator' };
  }

  return { level: 'none' }; // Private beat, no permission
}

async function loadBeatFromDB(beatId) {
  const result = await db.query(`
    SELECT * FROM beats WHERE room_id = $1
  `, [beatId]);

  if (result.rows.length === 0) {
    throw new Error('Beat not found');
  }

  return result.rows[0];
}
```

---

## 🎯 CURRENT STATE (As of November 2025)

### ✅ Phases Complete

**Phase 1: Database & Permissions Foundation** - ✅ COMPLETE
- Database migration successful (25 existing beats migrated)
- `room_id` UUID column added to beats table
- `beat_collaborators` table created with owner/collaborator roles
- Permission-based API endpoints implemented
- Backend hosted at `api.charliedahle.me`

**Phase 2: Session-Beat Linking** - ✅ COMPLETE
- Frontend fully refactored to use persistent beat IDs
- Beat creation now via API: `POST /api/beats`
- WebSocket events updated: `join-beat`, `leave-beat` (removed `create-room`)
- All components updated to use `beatId` instead of `roomId`
- Vite proxy configured to route `/api/*` to backend
- Auto-join logic working correctly

**Phase 3: Listening Mode** - ✅ COMPLETE
- Access control system implemented (owner/collaborator/spectator/none)
- `GET /api/beats/:id/access` endpoint (supports UUID and numeric ID)
- ListeningMode component for read-only beat viewing
- Visibility toggle UI (Public/Unlisted/Private)
- Access-based routing in DrumMachineApp
- Local playback without WebSocket session

### 📂 Repository Structure

**Frontend (this repo):** `/drum-machine/`
- React app with Vite build system
- Hosted at `charliedahle.me`
- Dev server: `npm run dev` on port 5173

**Backend (separate deployment):** `.additionalfiles/server.js`
- Hosted at `api.charliedahle.me`
- PostgreSQL database
- WebSocket + REST API

### ⚙️ Development Configuration

**Vite Proxy (vite.config.js):**
```javascript
server: {
  proxy: {
    '/api': { target: 'https://api.charliedahle.me' },
    '/socket.io': { target: 'https://api.charliedahle.me', ws: true },
  },
}
```
This allows `fetch('/api/beats')` in dev to proxy to the production backend - standard practice, not janky!

**Key Files Modified in Phase 2:**
- `src/stores/useAppStore.js` - WebSocket state, removed `createRoom()`, renamed to `beatId`
- `src/components/DrumMachineApp/DrumMachineApp.jsx` - Auto-join logic, beat routing
- `src/pages/Beats/Beats.jsx` - API-based beat creation
- `src/components/RoomInterface/RoomInterface.jsx` - API-based beat creation
- `src/components/RoomHeader/RoomHeader.jsx` - Display beatId, use `leaveBeat()`
- `src/components/QuickRejoin/QuickRejoin.jsx` - Navigate to beats
- `src/main.jsx` - Route changed to `/DrumMachine/:beatId`

### 🔄 Current Flow

1. User creates beat → `POST /api/beats` → Returns `{ beat: { roomId: "uuid", ... } }`
2. Navigate to `/DrumMachine/{uuid}`
3. DrumMachineApp auto-joins beat session via `join-beat` WebSocket event
4. Real-time collaboration works with persistent beat storage

### ➡️ Next Up: Phase 4

**Phase 4: Spectator Mode** - Ready to implement
- Implement spectator role in WebSocket sessions
- Real-time viewing of active collaborative sessions
- Disabled UI with live updates
- Foundation for admittance queue system

---

## Implementation Phases

### Phase 1: Database & Permissions Foundation (Week 1) ✅ **COMPLETE**

**Goal:** Establish beat ownership and permissions system

**Tasks:**
1. ✅ Create database migration script for new schema
2. ✅ Migrate existing beats to new structure:
   - ✅ Add `room_id`, `visibility`, `is_modified` columns
   - ✅ Create `beat_collaborators` table
   - ✅ Migrate existing `user_id` to `beat_collaborators` as owner
3. ✅ Create `session_queue` table
4. ✅ Update API endpoints to use new permission checks
5. ✅ Write permission middleware functions
6. ✅ Test: Create beat, add collaborators, verify permissions (25 beats migrated successfully)

**Deliverables:**
- ✅ Migration SQL script (`.additionalfiles/migrate-permissions.sql`)
- ✅ Updated API routes with permission checks (Backend)
- ✅ Backend deployed to api.charliedahle.me

**Migration Script Example:**
```sql
-- Add new columns to beats
ALTER TABLE beats
  ADD COLUMN room_id UUID DEFAULT gen_random_uuid() UNIQUE,
  ADD COLUMN visibility VARCHAR(10) DEFAULT 'private' CHECK (visibility IN ('public', 'unlisted', 'private')),
  ADD COLUMN is_modified BOOLEAN DEFAULT false,
  ADD COLUMN last_saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN last_edited_by INTEGER REFERENCES users(id);

-- Create beat_collaborators table
CREATE TABLE beat_collaborators (
  id SERIAL PRIMARY KEY,
  beat_id INTEGER NOT NULL REFERENCES beats(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'collaborator')),
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  added_by INTEGER REFERENCES users(id),
  UNIQUE(beat_id, user_id)
);

-- Migrate existing beats (assume user_id column exists)
INSERT INTO beat_collaborators (beat_id, user_id, role)
SELECT id, user_id, 'owner' FROM beats WHERE user_id IS NOT NULL;

-- Remove old user_id column
ALTER TABLE beats DROP COLUMN user_id;

-- Create session_queue table
CREATE TABLE session_queue (
  id SERIAL PRIMARY KEY,
  beat_id INTEGER NOT NULL REFERENCES beats(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  guest_identifier VARCHAR(100),
  username VARCHAR(100),
  status VARCHAR(20) CHECK (status IN ('pending', 'approved', 'denied')) DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 minutes'),
  responded_at TIMESTAMP,
  responded_by INTEGER REFERENCES users(id),
  request_message TEXT
);

-- Create indexes
CREATE INDEX idx_beats_room_id ON beats(room_id);
CREATE INDEX idx_beats_visibility ON beats(visibility);
CREATE INDEX idx_beat_collaborators_beat ON beat_collaborators(beat_id);
CREATE INDEX idx_beat_collaborators_user ON beat_collaborators(user_id);
CREATE INDEX idx_session_queue_beat ON session_queue(beat_id);
CREATE INDEX idx_session_queue_status ON session_queue(status);
```

---

### Phase 2: Session-Beat Linking (Week 1-2) ✅ **COMPLETE**

**Goal:** Replace ephemeral rooms with beat-linked sessions

**Tasks:**
1. ✅ Refactor `DrumRoom` class → `DrumSession` class (Backend - already done)
2. ✅ Link sessions to `beatId` (UUID from `room_id` column)
3. ✅ Update WebSocket event: `create-room` → removed
4. ✅ Update WebSocket event: `join-room` → `join-beat`
5. ✅ Modify frontend to use `beatId` in URLs and WebSocket
6. ✅ Update URL routing: `/DrumMachine/:beatId`
7. ✅ Update beat creation flow to use persistent `room_id` via API
8. ✅ Test: Create beat via API, navigate to room_id, auto-join works

**Deliverables:**
- ✅ `DrumSession` class implementation (Backend)
- ✅ Updated WebSocket handlers (`join-beat`, `leave-beat`)
- ✅ Frontend routing changes (all components updated)
- ✅ Vite proxy configuration for API
- ✅ Beat creation via POST /api/beats working

**Frontend Changes Completed:**
- `useAppStore.js`: Renamed `roomId` → `beatId`, removed `createRoom()`, updated all WebSocket events
- `DrumMachineApp.jsx`: Auto-join logic, beat-not-found modal
- `Beats.jsx`: API-based beat creation, navigation to room_id
- `RoomInterface.jsx`: API-based beat creation
- `RoomHeader.jsx`: Display beatId, use `leaveBeat()`
- `QuickRejoin.jsx`: Navigate to beats directly
- `main.jsx`: Updated route to `:beatId`
- `vite.config.js`: Added proxy to api.charliedahle.me

---

### Phase 3: Listening Mode (Week 2) ✅ **COMPLETE**

**Goal:** Non-owners can view public beats without starting sessions

**Tasks:**
1. ✅ Create `GET /api/beats/:id/access` endpoint
2. ✅ Implement access check logic (owner/collaborator/spectator/none)
3. ✅ Create `ListeningMode.jsx` component:
   - ✅ Load beat data from API
   - ✅ Local Tone.js playback (not synced)
   - ✅ Disabled UI (pattern visible but not editable)
   - ✅ "Request to Edit" button (placeholder for Phase 5)
4. ✅ Update `DrumMachineApp.jsx` to route to ListeningMode when appropriate
5. ✅ Implement 404 for private beats with no permission
6. ⚠️ Test: Visit public beat as guest, verify local playback (blocked by ownership assignment - see notes)

**Deliverables:**
- ✅ `ListeningMode` component (`src/components/ListeningMode/`)
- ✅ Access check API endpoint (accepts both numeric ID and UUID room_id)
- ✅ Updated routing logic in `DrumMachineApp.jsx`
- ✅ **Bonus:** `VisibilityToggle` component for changing beat visibility

**Implementation Notes:**
- Added `optionalAuthenticateToken` middleware to support guest access checking
- Updated `/api/beats/:id/access` and `/api/beats/:id/visibility` to accept UUID `room_id` in addition to numeric `id`
- Beat ownership assignment logic already exists in POST `/api/beats` (lines 399-405)
- Existing beats created before Phase 1/2 have no owners in `beat_collaborators` table
- New beats created while authenticated automatically assign user as owner
- Frontend checks access level and routes to ListeningMode vs Edit Mode accordingly

**Files Modified:**
- Backend: `.additionalfiles/server.js` (middleware + endpoint updates)
- Frontend:
  - `src/components/ListeningMode/ListeningMode.jsx` (new)
  - `src/components/ListeningMode/ListeningMode.module.css` (new)
  - `src/components/VisibilityToggle/VisibilityToggle.jsx` (new)
  - `src/components/VisibilityToggle/VisibilityToggle.css` (new)
  - `src/components/DrumMachineApp/DrumMachineApp.jsx` (access checking + routing)
  - `src/components/RoomHeader/RoomHeader.jsx` (added visibility toggle)

---

### Phase 4: Spectator Mode (Week 2-3)

**Goal:** Users can watch active sessions in real-time

**Tasks:**
1. Implement spectator role in `DrumSession` class
2. Update `join-beat` WebSocket event to accept `asSpectator` parameter
3. Server: Send session events to spectators (read-only)
4. Frontend: Create `SpectatorMode.jsx` or `SpectatorBanner.jsx`
5. Disable UI for spectators:
   - Grey out pattern grid
   - Disable transport controls
   - Remove hover states
6. Spectators receive real-time updates (pattern, BPM, etc.)
7. Test: Join active session as spectator, watch changes

**Deliverables:**
- Spectator role in session
- Spectator UI components
- Integration tests for spectator mode

---

### Phase 5: Admittance Queue (Week 3)

**Goal:** Request temporary edit access to sessions

**Tasks:**
1. Implement queue WebSocket events:
   - `request-edit-access`
   - `respond-to-queue-request`
   - `queue-request-added`
   - `edit-access-granted`
   - `edit-access-denied`
2. Create `SessionQueue.jsx` component:
   - List pending requests
   - Approve/deny buttons
   - Real-time updates
3. Add "Request to Edit" button to ListeningMode and SpectatorMode
4. Implement queue expiration (10 minutes)
5. Server: Promote spectator to editor when approved
6. Test: Request access, approve, edit, leave, verify back to spectator

**Deliverables:**
- Queue WebSocket handlers
- `SessionQueue` UI component
- Queue expiration logic
- Integration tests

---

### Phase 6: Guest User Flow (Week 3-4)

**Goal:** Guests can create beats, prompted to sign in to save

**Tasks:**
1. Allow guest beat creation (no entry in `beat_collaborators`)
2. Track `is_modified` flag on first edit
3. Create `GuestAuthPrompt.jsx`:
   - Warning banner: "Sign in to save your work"
   - Sign In/Sign Up buttons
4. Create `AuthModal.jsx` for in-place authentication
5. Implement "sign in to save" prompt on page leave (beforeunload)
6. Implement guest-to-owner promotion when signed-in user joins
7. Implement orphan beat deletion logic:
   - On session termination, check `beat_collaborators`
   - If empty, delete beat
8. Test: Guest creates beat, edits, leaves → Beat deleted
9. Test: Guest creates beat, signs in → Beat persists

**Deliverables:**
- Guest authentication flow
- `GuestAuthPrompt` and `AuthModal` components
- Orphan beat cleanup logic
- Integration tests

---

### Phase 7: Auto-Save (Week 4)

**Goal:** Beats auto-save during sessions

**Tasks:**
1. Implement 2-minute auto-save interval in `DrumSession`
2. Implement save-before-termination logic
3. Track `last_edited_by` and `last_saved_at` in database
4. WebSocket event: `beat-auto-saved`
5. Frontend: Display "Last saved X minutes ago by @user"
6. Skip auto-save for orphan beats (no owner)
7. Test: Edit beat, wait 2 minutes, verify auto-save
8. Test: Session terminates, verify final save

**Deliverables:**
- Auto-save implementation
- Save status UI
- Database updates for save tracking
- Integration tests

---

### Phase 8: Beats Page Enhancements (Week 4-5)

**Goal:** Manage beats, collaborators, visibility

**Tasks:**
1. Update `/beats` page layout:
   - Three tabs: My Beats, Shared With Me, Public Gallery
2. Implement API endpoints:
   - `GET /api/beats/my-beats`
   - `GET /api/beats/shared-with-me`
   - `GET /api/beats/public`
   - `POST /api/beats/:id/collaborators`
   - `DELETE /api/beats/:id/collaborators/:userId`
   - `PUT /api/beats/:id/visibility`
3. Create UI components:
   - `BeatVisibilityToggle.jsx`
   - `CollaboratorManager.jsx`
   - Enhanced `BeatCard.jsx` with actions
4. Implement beat management actions:
   - Rename (owners only)
   - Delete (owners only)
   - Change visibility (owners only)
   - Add/remove collaborators (owners only)
   - Share link (copy to clipboard)
5. Test: Change visibility, add collaborator, verify access

**Deliverables:**
- Enhanced `/beats` page
- Beat management UI components
- Collaborator/visibility API endpoints
- Integration tests

---

### Phase 9: Session Termination & Cleanup (Week 5)

**Goal:** Sessions end gracefully with proper cleanup

**Tasks:**
1. Implement inactivity tracking in `DrumSession`:
   - No users for 2 minutes → Terminate
   - All users inactive for 10 minutes → Terminate
2. Implement session termination flow:
   - Auto-save if has owner
   - Delete beat if orphan
   - Clean up queue requests
   - Notify users via `session-terminating` and `session-terminated`
3. Frontend: Handle session termination gracefully:
   - Show "Session ended" message
   - Redirect to beats page or home
4. Implement queue request cleanup:
   - Cron job to delete expired requests
   - Delete all requests when session ends
5. Test: Leave session, wait 2 minutes, verify termination
6. Test: Inactive session, wait 10 minutes, verify termination

**Deliverables:**
- Session termination logic
- Frontend termination handling
- Queue cleanup cron job
- Integration tests

---

### Phase 10: Polish & Edge Cases (Week 5-6)

**Goal:** Handle edge cases and improve UX

**Tasks:**
1. Co-owner management:
   - Allow promoting collaborators to co-owner
   - Prevent removing last owner
2. Queue notification UI:
   - Toast/notification when request arrives
   - Badge count on queue icon
3. Session reconnection logic:
   - Handle WebSocket disconnections
   - Rejoin session automatically
4. Loading states and error messages:
   - Beat loading spinner
   - "Beat not found" page
   - "Access denied" modal
5. Comprehensive testing:
   - End-to-end tests for all user flows
   - Permission edge cases
   - Concurrent editing scenarios
6. Performance optimization:
   - Debounce auto-save
   - Optimize WebSocket payloads
7. Documentation:
   - API documentation
   - Architecture diagrams
   - User guide

**Deliverables:**
- Polished UI/UX
- Comprehensive test suite
- Documentation
- Production deployment

---

## Technical Considerations

### Concurrency & Conflict Resolution

**Current Approach:** Last Write Wins (LWW)
- Simple to implement
- Works well for small teams (2-5 collaborators)
- Potential for lost edits in high-concurrency scenarios

**Future Enhancement:** Operational Transforms (OT) or CRDTs
- More complex but prevents conflicts
- Required for larger teams or public collaboration
- Libraries: ShareDB, Yjs, Automerge

### Scalability

**Current Architecture:** Single server, in-memory sessions
- Works for MVP and small-scale deployments
- Sessions lost on server restart
- Limited by single server memory/CPU

**Scaling Strategy:**
1. **Horizontal scaling:** Use Redis for session state (shared across servers)
2. **WebSocket scaling:** Use Socket.io Redis adapter for multi-server WebSocket
3. **Database optimization:** Connection pooling, read replicas
4. **CDN:** Serve static assets (sound files) from CDN

### Security Considerations

**Current Security Measures:**
- JWT authentication
- Password hashing (bcrypt)
- SQL parameterized queries (prevent injection)
- CORS restrictions

**Additional Security (Phase 10+):**
- Rate limiting on API endpoints
- WebSocket rate limiting (prevent DoS)
- Content Security Policy (CSP) headers
- Audit logging for owner actions (delete, permission changes)
- Email verification for accounts
- Two-factor authentication (2FA)

### Performance Optimization

**Frontend:**
- Lazy load components (React.lazy)
- Virtualize beat list (react-window) for large libraries
- Memoize expensive computations (useMemo, React.memo)
- Debounce auto-save and WebSocket emissions

**Backend:**
- Database indexing (already planned in schema)
- Connection pooling (pg-pool)
- Compress WebSocket messages (Socket.io compression)
- Cache public gallery results (Redis)

**Audio:**
- Preload sound files
- Use Web Workers for audio processing
- Optimize Tone.js transport scheduling

---

## Success Metrics

### Technical Metrics
- **Session uptime:** >99% availability
- **Auto-save success rate:** >99.9%
- **WebSocket latency:** <100ms for real-time updates
- **Page load time:** <2 seconds for beat loading
- **API response time:** <200ms for most endpoints

### User Experience Metrics
- **Collaboration success rate:** % of queue requests approved
- **Guest conversion rate:** % of guests who sign up after creating beat
- **Beat persistence rate:** % of beats saved vs abandoned
- **Active sessions:** Concurrent sessions at peak times
- **User retention:** Weekly/monthly active users

---

## Future Enhancements (Post-MVP)

### Phase 11+: Advanced Features

**Beat Forking & Remixing:**
- Fork public beats to create variations
- Attribution system (show original beat creator)
- "Remixes" section showing forks of a beat

**Version History:**
- Save snapshots on each auto-save
- Rollback to previous versions
- Diff view showing changes between versions

**Comments & Annotations:**
- Add comments to specific measures/tracks
- Reply threads for collaboration discussion
- @mention collaborators

**Export & Integration:**
- Export beats as MIDI files
- Export as audio (WAV, MP3)
- Integration with DAWs (Ableton Live Link, etc.)

**Advanced Permissions:**
- Custom roles (e.g., "Viewer+Comment", "Editor-Delete")
- Per-track permissions (user can only edit certain tracks)
- Time-limited access (collaborator expires after X days)

**Public Discovery:**
- Beat tags and categories
- Search and filtering
- "Trending" and "Featured" sections
- User profiles and follower system

**Real-Time Presence:**
- Show user cursors on pattern grid
- Highlight which track user is editing
- Show who is listening (spectator list)
- Typing indicators for comments

**Notifications:**
- Email notifications for collaboration invites
- Push notifications for queue requests
- Digest emails (weekly summary of collaborations)

---

## Conclusion

This vision document outlines the transformation of a real-time collaborative drum machine into a **document-centric beat production platform** modeled after Google Docs. The architecture shifts from ephemeral sessions to persistent beat documents with sophisticated permission controls, real-time collaboration, and a flexible access system.

**Key Innovations:**
1. **Beat-as-document paradigm** - Beats are first-class persistent entities
2. **Three-tier access control** - Owner, Collaborator, Spectator
3. **Dual viewing modes** - Listening (static) vs Spectating (live)
4. **Admittance queue** - Temporary edit access without permanent collaboration
5. **Guest-to-user conversion** - Frictionless onboarding with save prompts
6. **Auto-save & session management** - Automatic persistence with graceful cleanup

**Technical Foundation:**
- React + Zustand + Socket.io (real-time sync)
- PostgreSQL (persistence)
- JWT authentication
- Tone.js (audio engine)
- Express + Socket.io (backend)

**Implementation Timeline:** 5-6 weeks across 10 phases

This document serves as the **complete technical specification** for implementing "Google Docs for Beats" and should be used to onboard AI assistants, developers, or collaborators to the project vision.

---

**Document Version:** 1.0
**Last Updated:** 2025-01-04
**Author:** Project Vision Team
**Status:** Implementation Ready
