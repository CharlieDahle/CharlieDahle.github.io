import React from 'react';
import { UserPlus } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import './QueueNotificationBadge.css';

/**
 * QueueNotificationBadge - Phase 5: Non-obtrusive queue notification
 *
 * Shows a small floating badge when there are pending edit requests.
 * Clicking opens the SessionQueueModal.
 */
const QueueNotificationBadge = ({ onClick }) => {
  const queueRequests = useAppStore((state) => state.websocket.queueRequests);

  if (!queueRequests || queueRequests.length === 0) {
    return null; // Don't show if no requests
  }

  return (
    <button
      className="queue-notification-badge"
      onClick={onClick}
      title={`${queueRequests.length} pending edit request${queueRequests.length !== 1 ? 's' : ''}`}
    >
      <UserPlus size={20} />
      <span className="queue-badge-count">{queueRequests.length}</span>
    </button>
  );
};

export default QueueNotificationBadge;
