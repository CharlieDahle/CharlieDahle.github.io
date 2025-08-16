// src/stores/websocketInterceptor.js
// WebSocket message interceptor for debug panel logging

export function interceptWebSocketMessages(socket) {
  if (!socket || !window.debugPanel) return;

  // Store original emit function
  const originalEmit = socket.emit.bind(socket);

  // Override emit to log outgoing messages
  socket.emit = function (event, data, callback) {
    // Log outgoing message
    if (window.debugPanel) {
      window.debugPanel.addMessageToLog("out", event, data);
    }

    // Call original emit
    if (callback) {
      return originalEmit(event, data, callback);
    } else {
      return originalEmit(event, data);
    }
  };

  // List of events to intercept for incoming messages
  const eventsToIntercept = [
    "connect",
    "disconnect",
    "connect_error",
    "user-joined",
    "user-left",
    "pattern-update",
    "transport-sync",
    "bpm-change",
    "measure-count-change",
    "track-added",
    "track-removed",
    "track-sound-updated",
    "effect-chain-update",
    "effect-change",
    "effect-reset",
  ];

  // Intercept incoming messages
  eventsToIntercept.forEach((eventName) => {
    // Store existing listeners
    const existingListeners = socket.listeners(eventName);

    // Remove existing listeners
    socket.removeAllListeners(eventName);

    // Add our interceptor
    socket.on(eventName, (data) => {
      // Log incoming message
      if (window.debugPanel) {
        window.debugPanel.addMessageToLog("in", eventName, data || "No data");
      }

      // Call original listeners
      existingListeners.forEach((listener) => {
        listener(data);
      });
    });
  });

  console.log("🔍 WebSocket message interceptor activated");
}

// Helper to add manual debug logs
export function debugLog(direction, type, data) {
  if (window.debugPanel) {
    window.debugPanel.addMessageToLog(direction, type, data);
  }
}
