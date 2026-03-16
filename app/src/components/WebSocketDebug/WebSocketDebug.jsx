// Temporary debugging component to diagnose WebSocket sync issues
import React, { useEffect, useState } from "react";
import { useAppStore } from "../../stores";
import "./WebSocketDebug.css";

function WebSocketDebug() {
  const [logs, setLogs] = useState([]);
  const [isVisible, setIsVisible] = useState(true);

  // Get WebSocket state
  const beatId = useAppStore((state) => state.websocket.beatId);
  const isConnected = useAppStore((state) => state.websocket.isConnected);
  const connectionState = useAppStore((state) => state.websocket.connectionState);
  const isInSession = useAppStore((state) => state.websocket.isInSession);
  const socket = useAppStore((state) => state.websocket.socket);
  const users = useAppStore((state) => state.websocket.users);
  const spectators = useAppStore((state) => state.websocket.spectators);

  const addLog = (message, type = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-20), { message, type, timestamp }]);
  };

  // Monitor pattern changes
  useEffect(() => {
    const unsubscribe = useAppStore.subscribe(
      (state) => state.pattern.data,
      (newPattern, oldPattern) => {
        // Check if pattern actually changed
        if (JSON.stringify(newPattern) !== JSON.stringify(oldPattern)) {
          addLog(`Pattern updated locally`, "success");
        }
      }
    );
    return unsubscribe;
  }, []);

  // Test send pattern change
  const testPatternChange = () => {
    addLog(`🧪 Testing pattern change...`, "info");
    addLog(`  - beatId: ${beatId}`, "info");
    addLog(`  - connectionState: ${connectionState}`, "info");
    addLog(`  - socket exists: ${!!socket}`, "info");

    if (!beatId) {
      addLog(`❌ FAIL: beatId is null/undefined!`, "error");
      return;
    }

    if (connectionState !== "connected") {
      addLog(`❌ FAIL: connectionState is "${connectionState}", not "connected"`, "error");
      return;
    }

    if (!socket) {
      addLog(`❌ FAIL: socket is null`, "error");
      return;
    }

    addLog(`✅ All checks passed, emitting pattern-change...`, "success");

    // Emit test pattern change
    const testChange = {
      type: "add-note",
      trackId: "test-track",
      tick: 0,
      velocity: 4
    };

    socket.emit("pattern-change", { roomId: beatId, change: testChange }, (ack) => {
      if (ack) {
        addLog(`✅ Server acknowledged pattern-change`, "success");
      } else {
        addLog(`⚠️ No acknowledgment from server`, "warning");
      }
    });
  };

  // Test transport command
  const testTransportCommand = () => {
    addLog(`🧪 Testing transport command (play)...`, "info");

    if (!socket || !beatId || connectionState !== "connected") {
      addLog(`❌ Cannot send: socket=${!!socket}, beatId=${beatId}, state=${connectionState}`, "error");
      return;
    }

    socket.emit("transport-command", {
      roomId: beatId,
      command: { command: "play" }
    });

    addLog(`✅ Sent transport command`, "success");
  };

  // Check if socket is in the Socket.io room
  const checkSocketRooms = () => {
    if (!socket) {
      addLog(`❌ No socket to check`, "error");
      return;
    }

    addLog(`🔍 Socket ID: ${socket.id}`, "info");
    addLog(`🔍 BeatId: ${beatId}`, "info");

    // Socket.io stores rooms in socket.rooms (Set)
    if (socket.rooms) {
      const rooms = Array.from(socket.rooms);
      addLog(`🔍 Socket is in ${rooms.length} room(s): ${rooms.join(", ")}`, "info");

      if (beatId && rooms.includes(beatId)) {
        addLog(`✅ Socket IS in the correct room (${beatId})`, "success");
      } else if (beatId) {
        addLog(`❌ Socket NOT in beat room! Expected: ${beatId}`, "error");
      }
    } else {
      addLog(`⚠️ socket.rooms not available (might be private)`, "warning");
    }
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        style={{
          position: "fixed",
          bottom: "10px",
          right: "10px",
          zIndex: 10000,
          padding: "10px",
          background: "#007bff",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer"
        }}
      >
        Show WebSocket Debug
      </button>
    );
  }

  return (
    <div className="websocket-debug">
      <div className="websocket-debug-header">
        <h3>🔍 WebSocket Debug Panel</h3>
        <button onClick={() => setIsVisible(false)}>Minimize</button>
      </div>

      <div className="websocket-debug-state">
        <h4>Connection State</h4>
        <table>
          <tbody>
            <tr>
              <td>Socket Connected:</td>
              <td className={isConnected ? "success" : "error"}>
                {isConnected ? "✅ Yes" : "❌ No"}
              </td>
            </tr>
            <tr>
              <td>Connection State:</td>
              <td className={connectionState === "connected" ? "success" : "warning"}>
                {connectionState}
              </td>
            </tr>
            <tr>
              <td>In Session:</td>
              <td className={isInSession ? "success" : "error"}>
                {isInSession ? "✅ Yes" : "❌ No"}
              </td>
            </tr>
            <tr>
              <td>Beat ID:</td>
              <td className={beatId ? "success" : "error"}>
                {beatId || "❌ NULL"}
              </td>
            </tr>
            <tr>
              <td>Socket ID:</td>
              <td>{socket?.id || "N/A"}</td>
            </tr>
            <tr>
              <td>Users:</td>
              <td>{users?.length || 0}</td>
            </tr>
            <tr>
              <td>Spectators:</td>
              <td>{spectators?.length || 0}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="websocket-debug-actions">
        <h4>Test Actions</h4>
        <button onClick={testPatternChange}>Test Pattern Change</button>
        <button onClick={testTransportCommand}>Test Transport (Play)</button>
        <button onClick={checkSocketRooms}>Check Socket Rooms</button>
        <button onClick={() => setLogs([])}>Clear Logs</button>
      </div>

      <div className="websocket-debug-logs">
        <h4>Logs (last 20)</h4>
        <div className="log-container">
          {logs.map((log, i) => (
            <div key={i} className={`log-entry log-${log.type}`}>
              <span className="log-time">[{log.timestamp}]</span>
              <span className="log-message">{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default WebSocketDebug;
