// src/components/DebugPanel/DebugPanel.jsx
import React, { useState, useEffect } from "react";
import { useAppStore } from "../../stores";
import {
  ChevronUp,
  ChevronDown,
  Database,
  Sliders,
  Wifi,
  Volume2,
  MessageSquare,
  Users,
  Activity,
  X,
} from "lucide-react";
import "./DebugPanel.css";

function DebugPanel({ isOpen, onClose, toneEffectsData }) {
  const [activeTab, setActiveTab] = useState("pattern");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [messageLog, setMessageLog] = useState([]);

  // Get all the data we want to monitor
  const patternData = useAppStore((state) => state.pattern.data);
  const storeEffects = useAppStore((state) => state.effects.trackEffects);
  const websocketState = useAppStore((state) => state.websocket);
  const tracks = useAppStore((state) => state.tracks.list);
  const transport = useAppStore((state) => state.transport);

  // Message log management
  const addMessageToLog = (direction, type, data, timestamp = null) => {
    const time = timestamp || new Date().toLocaleTimeString();
    setMessageLog((prev) => [
      ...prev.slice(-99),
      {
        // Keep last 100 messages
        timestamp: time,
        direction,
        type,
        data: typeof data === "string" ? data : JSON.stringify(data, null, 2),
        id: Date.now() + Math.random(),
      },
    ]);
  };

  // Expose method to add messages from parent components
  useEffect(() => {
    if (isOpen && window) {
      window.debugPanel = { addMessageToLog };
    }
    return () => {
      if (window.debugPanel) {
        delete window.debugPanel;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const formatJson = (obj) => {
    try {
      // Handle circular references by replacing them with a string
      const seen = new WeakSet();
      return JSON.stringify(
        obj,
        (key, value) => {
          if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
              return "[Circular Reference]";
            }
            seen.add(value);

            // Handle Tone.js objects specifically
            if (value.constructor && value.constructor.name) {
              // If it's a Tone.js object, just show its type
              if (value.constructor.name.startsWith("Tone")) {
                return `[${value.constructor.name} Instance]`;
              }
            }
          }
          return value;
        },
        2
      );
    } catch (error) {
      return `Error formatting JSON: ${error.message}`;
    }
  };

  const getEnabledEffects = (trackId) => {
    const effects = storeEffects[trackId];
    if (!effects) return [];

    const enabled = [];
    Object.entries(effects).forEach(([effectType, settings]) => {
      let isEnabled = false;
      switch (effectType) {
        case "eq":
          isEnabled =
            settings.high !== 0 || settings.mid !== 0 || settings.low !== 0;
          break;
        case "filter":
          isEnabled = settings.frequency !== 20000 || settings.Q !== 1;
          break;
        case "reverb":
        case "delay":
        case "chorus":
        case "vibrato":
          isEnabled = settings.wet > 0;
          break;
        case "distortion":
          isEnabled = settings.amount > 0;
          break;
        case "pitchShift":
          isEnabled = settings.wet > 0 || settings.pitch !== 0;
          break;
        case "compressor":
          isEnabled =
            settings.threshold !== -24 ||
            settings.ratio !== 4 ||
            settings.attack !== 0.01 ||
            settings.release !== 0.1;
          break;
      }

      if (isEnabled) {
        enabled.push({ effectType, settings });
      }
    });

    return enabled;
  };

  const getTotalNotes = () => {
    return Object.values(patternData).reduce(
      (sum, notes) => sum + notes.length,
      0
    );
  };

  const getActiveTracksCount = () => {
    return Object.keys(patternData).filter(
      (trackId) => patternData[trackId].length > 0
    ).length;
  };

  const getTotalActiveEffects = () => {
    return tracks.reduce((total, track) => {
      return total + getEnabledEffects(track.id).length;
    }, 0);
  };

  return (
    <div className="floating-card debug-card">
      <div
        className="debug-header"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="debug-title">
          <Activity size={20} />
          Debug Panel
          <span className="debug-summary">
            {getTotalNotes()} notes • {getTotalActiveEffects()} effects •{" "}
            {websocketState.users.length} users
          </span>
        </div>
        <div className="debug-controls">
          <button className="collapse-btn">
            {isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
          </button>
          <button
            className="close-btn"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="debug-content">
          <div className="debug-tabs">
            <button
              className={`debug-tab ${activeTab === "pattern" ? "active" : ""}`}
              onClick={() => setActiveTab("pattern")}
            >
              <Database size={16} />
              Pattern Data
            </button>
            <button
              className={`debug-tab ${activeTab === "effects" ? "active" : ""}`}
              onClick={() => setActiveTab("effects")}
            >
              <Sliders size={16} />
              Effects
            </button>
            <button
              className={`debug-tab ${
                activeTab === "websocket" ? "active" : ""
              }`}
              onClick={() => setActiveTab("websocket")}
            >
              <Wifi size={16} />
              WebSocket
            </button>
            <button
              className={`debug-tab ${activeTab === "tone" ? "active" : ""}`}
              onClick={() => setActiveTab("tone")}
            >
              <Volume2 size={16} />
              Audio Engine
            </button>
            <button
              className={`debug-tab ${
                activeTab === "messages" ? "active" : ""
              }`}
              onClick={() => setActiveTab("messages")}
            >
              <MessageSquare size={16} />
              Messages ({messageLog.length})
            </button>
          </div>

          <div className="debug-body">
            {activeTab === "pattern" && (
              <div>
                <h3>Pattern Overview</h3>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">Total Notes:</span>
                    <span className="stat-value">{getTotalNotes()}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Active Tracks:</span>
                    <span className="stat-value">
                      {getActiveTracksCount()} / {tracks.length}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Current Tick:</span>
                    <span className="stat-value">{transport.currentTick}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">BPM:</span>
                    <span className="stat-value">{transport.bpm}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Measures:</span>
                    <span className="stat-value">{transport.measureCount}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Playing:</span>
                    <span className="stat-value">
                      {transport.isPlaying ? "Yes" : "No"}
                    </span>
                  </div>
                </div>

                <h4>Track Details</h4>
                {tracks.map((track) => (
                  <div key={track.id} className="track-info">
                    <div className="track-header">
                      <span
                        className="track-name"
                        style={{ color: track.color }}
                      >
                        {track.name}
                      </span>
                      <span className="note-count">
                        {patternData[track.id]?.length || 0} notes
                      </span>
                    </div>
                    {patternData[track.id]?.length > 0 && (
                      <div className="note-list">
                        {patternData[track.id].map((note, i) => (
                          <span key={i} className="note-item">
                            Tick {typeof note === "object" ? note.tick : note}
                            {typeof note === "object" && ` (v${note.velocity})`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                <details className="raw-data">
                  <summary>Raw Pattern Data</summary>
                  <pre className="json-display">{formatJson(patternData)}</pre>
                </details>
              </div>
            )}

            {activeTab === "effects" && (
              <div>
                <h3>Effects Overview</h3>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">Total Active Effects:</span>
                    <span className="stat-value">
                      {getTotalActiveEffects()}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Tracks with Effects:</span>
                    <span className="stat-value">
                      {
                        tracks.filter(
                          (track) => getEnabledEffects(track.id).length > 0
                        ).length
                      }
                    </span>
                  </div>
                </div>

                <h4>Effects by Track</h4>
                {tracks.map((track) => {
                  const enabledEffects = getEnabledEffects(track.id);
                  return (
                    <div key={track.id} className="effect-track">
                      <div className="track-header">
                        <span
                          className="track-name"
                          style={{ color: track.color }}
                        >
                          {track.name}
                        </span>
                        <span className="effect-count">
                          {enabledEffects.length} active effects
                        </span>
                      </div>

                      {enabledEffects.length > 0 ? (
                        <div className="effects-list">
                          {enabledEffects.map(({ effectType, settings }) => (
                            <div key={effectType} className="effect-item">
                              <strong>{effectType.toUpperCase()}</strong>
                              <div className="effect-params">
                                {Object.entries(settings).map(
                                  ([param, value]) => (
                                    <span key={param}>
                                      {param}:{" "}
                                      {typeof value === "number"
                                        ? value.toFixed(2)
                                        : value}
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="no-effects">No active effects</div>
                      )}
                    </div>
                  );
                })}

                <details className="raw-data">
                  <summary>Raw Effects Data</summary>
                  <pre className="json-display">{formatJson(storeEffects)}</pre>
                </details>
              </div>
            )}

            {activeTab === "websocket" && (
              <div>
                <h3>Connection Status</h3>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">Connection:</span>
                    <span
                      className={`stat-value status-${websocketState.connectionState}`}
                    >
                      {websocketState.connectionState}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Socket Connected:</span>
                    <span className="stat-value">
                      {websocketState.isConnected ? "Yes" : "No"}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">In Room:</span>
                    <span className="stat-value">
                      {websocketState.isInRoom ? "Yes" : "No"}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Room ID:</span>
                    <span className="stat-value">
                      {websocketState.roomId || "None"}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Users Online:</span>
                    <span className="stat-value">
                      {websocketState.users.length}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Reconnect Attempts:</span>
                    <span className="stat-value">
                      {websocketState.reconnectAttempts}
                    </span>
                  </div>
                </div>

                {websocketState.error && (
                  <div className="error-message">
                    <strong>Error:</strong> {websocketState.error}
                  </div>
                )}

                <h4>Users in Room</h4>
                {websocketState.users.length > 0 ? (
                  <div className="users-list">
                    {websocketState.users.map((userId) => (
                      <div key={userId} className="user-item">
                        <Users size={14} />
                        {userId}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-users">No other users in room</div>
                )}

                <details className="raw-data">
                  <summary>Raw WebSocket Data</summary>
                  <pre className="json-display">
                    {formatJson({
                      isConnected: websocketState.isConnected,
                      connectionState: websocketState.connectionState,
                      isInRoom: websocketState.isInRoom,
                      roomId: websocketState.roomId,
                      users: websocketState.users,
                      error: websocketState.error,
                      reconnectAttempts: websocketState.reconnectAttempts,
                    })}
                  </pre>
                </details>
              </div>
            )}

            {activeTab === "tone" && (
              <div>
                <h3>Audio Engine Status</h3>
                {toneEffectsData ? (
                  <>
                    <div className="stats-grid">
                      <div className="stat-item">
                        <span className="stat-label">Loaded Players:</span>
                        <span className="stat-value">
                          {
                            Object.keys(toneEffectsData.tonePlayers || {})
                              .length
                          }
                        </span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Effect Chains:</span>
                        <span className="stat-value">
                          {
                            Object.keys(toneEffectsData.trackEffects || {})
                              .length
                          }
                        </span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Audio Context:</span>
                        <span className="stat-value">
                          {toneEffectsData.toneContextState || "Unknown"}
                        </span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Scheduler:</span>
                        <span className="stat-value">
                          {toneEffectsData.isPlaying ? "Playing" : "Stopped"}
                        </span>
                      </div>
                    </div>

                    <h4>Loaded Audio Files</h4>
                    {Object.keys(toneEffectsData.tonePlayers || {}).length >
                    0 ? (
                      <div className="audio-files">
                        {Object.keys(toneEffectsData.tonePlayers || {}).map(
                          (soundFile) => (
                            <div key={soundFile} className="audio-file">
                              {soundFile}
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <div className="no-data">No audio files loaded</div>
                    )}

                    <details className="raw-data">
                      <summary>Raw Audio Engine Data (Safe)</summary>
                      <pre className="json-display">
                        {formatJson({
                          tonePlayers: Object.keys(
                            toneEffectsData.tonePlayers || {}
                          ).reduce((acc, key) => {
                            acc[key] = `[Tone.Player Instance for ${key}]`;
                            return acc;
                          }, {}),
                          trackEffects: Object.keys(
                            toneEffectsData.trackEffects || {}
                          ).reduce((acc, trackId) => {
                            const effects =
                              toneEffectsData.trackEffects[trackId];
                            acc[trackId] = Object.keys(effects).reduce(
                              (effectAcc, effectType) => {
                                effectAcc[effectType] = effects[effectType]
                                  ? `[${
                                      effects[effectType].constructor?.name ||
                                      "Effect"
                                    } Instance]`
                                  : "null";
                                return effectAcc;
                              },
                              {}
                            );
                            return acc;
                          }, {}),
                          audioContext: toneEffectsData.toneContextState,
                          isPlaying: toneEffectsData.isPlaying,
                          currentTick: toneEffectsData.currentTick,
                          bpm: toneEffectsData.bpm,
                          soundsLoaded: toneEffectsData.soundsLoaded,
                          trackSounds: toneEffectsData.trackSounds || {},
                        })}
                      </pre>
                    </details>
                  </>
                ) : (
                  <div className="no-data">
                    No audio engine data available. Make sure the scheduler is
                    running.
                  </div>
                )}
              </div>
            )}

            {activeTab === "messages" && (
              <div>
                <div className="message-header">
                  <h3>WebSocket Messages ({messageLog.length})</h3>
                  <button
                    className="clear-btn"
                    onClick={() => setMessageLog([])}
                  >
                    Clear Log
                  </button>
                </div>

                <div className="message-log">
                  {messageLog.length > 0 ? (
                    messageLog.map((msg) => (
                      <div key={msg.id} className="message-item">
                        <div className="message-meta">
                          <span className="message-time">{msg.timestamp}</span>
                          <span
                            className={`message-direction ${msg.direction}`}
                          >
                            {msg.direction === "out" ? "OUT" : "IN"}
                          </span>
                          <span className="message-type">{msg.type}</span>
                        </div>
                        <div className="message-data">{msg.data}</div>
                      </div>
                    ))
                  ) : (
                    <div className="no-messages">
                      No messages logged yet. WebSocket activity will appear
                      here.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DebugPanel;
