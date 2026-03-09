import React from 'react';
import { UserPlus, Check, X, Clock } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import './SessionQueue.css';

/**
 * SessionQueue - Phase 5: Admittance Queue
 *
 * Displays pending edit access requests and allows owners/collaborators
 * to approve or deny requests. Only visible to users with edit permissions.
 */
const SessionQueue = () => {
  const queueRequests = useAppStore((state) => state.websocket.queueRequests);
  const respondToQueueRequest = useAppStore(
    (state) => state.websocket.respondToQueueRequest
  );

  if (!queueRequests || queueRequests.length === 0) {
    return null; // Don't show empty queue
  }

  const handleApprove = (requestId) => {
    respondToQueueRequest(requestId, true);
  };

  const handleDeny = (requestId) => {
    respondToQueueRequest(requestId, false);
  };

  const getTimeAgo = (timestamp) => {
    const now = Date.now();
    const diff = now - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'just now';
    if (minutes === 1) return '1 minute ago';
    return `${minutes} minutes ago`;
  };

  return (
    <div className="session-queue">
      <div className="session-queue-header">
        <UserPlus size={18} />
        <span className="session-queue-title">
          Edit Requests ({queueRequests.length})
        </span>
      </div>

      <div className="session-queue-list">
        {queueRequests.map((request) => (
          <div key={request.requestId} className="session-queue-item">
            <div className="session-queue-item-info">
              <span className="session-queue-username">
                {request.username || 'Guest User'}
              </span>
              <span className="session-queue-time">
                <Clock size={12} />
                {getTimeAgo(request.requestedAt)}
              </span>
            </div>

            {request.message && (
              <p className="session-queue-message">{request.message}</p>
            )}

            <div className="session-queue-actions">
              <button
                className="session-queue-button session-queue-approve"
                onClick={() => handleApprove(request.requestId)}
                title="Approve request"
              >
                <Check size={16} />
                Approve
              </button>
              <button
                className="session-queue-button session-queue-deny"
                onClick={() => handleDeny(request.requestId)}
                title="Deny request"
              >
                <X size={16} />
                Deny
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SessionQueue;
