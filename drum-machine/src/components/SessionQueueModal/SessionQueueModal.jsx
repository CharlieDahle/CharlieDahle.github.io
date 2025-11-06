import React, { useState } from 'react';
import { X, Clock, Check, XIcon, ChevronDown } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import './SessionQueueModal.css';

/**
 * SessionQueueModal - Phase 5: Queue management popup
 *
 * Modal for reviewing and responding to edit access requests.
 * Owners/collaborators can approve with role selection or deny requests.
 */
const SessionQueueModal = ({ isOpen, onClose }) => {
  const queueRequests = useAppStore((state) => state.websocket.queueRequests);
  const respondToQueueRequest = useAppStore(
    (state) => state.websocket.respondToQueueRequest
  );

  // Track dropdown state for each request
  const [expandedRequest, setExpandedRequest] = useState(null);

  if (!isOpen) return null;

  const handleApprove = (requestId, role) => {
    respondToQueueRequest(requestId, true, role);
    setExpandedRequest(null);
  };

  const handleDeny = (requestId) => {
    respondToQueueRequest(requestId, false);
    setExpandedRequest(null);
  };

  const getTimeAgo = (timestamp) => {
    const now = Date.now();
    const diff = now - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    return `${hours} hours ago`;
  };

  const toggleDropdown = (requestId) => {
    setExpandedRequest(expandedRequest === requestId ? null : requestId);
  };

  return (
    <div className="queue-modal-overlay" onClick={onClose}>
      <div className="queue-modal" onClick={(e) => e.stopPropagation()}>
        <div className="queue-modal-header">
          <h2 className="queue-modal-title">
            Edit Requests ({queueRequests.length})
          </h2>
          <button className="queue-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="queue-modal-content">
          {queueRequests.length === 0 ? (
            <p className="queue-modal-empty">No pending requests</p>
          ) : (
            <div className="queue-modal-list">
              {queueRequests.map((request) => (
                <div key={request.requestId} className="queue-modal-item">
                  <div className="queue-modal-item-header">
                    <div className="queue-modal-item-info">
                      <span className="queue-modal-username">
                        {request.username || 'Guest User'}
                      </span>
                      <span className="queue-modal-time">
                        <Clock size={12} />
                        {getTimeAgo(request.requestedAt)}
                      </span>
                    </div>
                  </div>

                  {request.message && (
                    <p className="queue-modal-message">{request.message}</p>
                  )}

                  <div className="queue-modal-actions">
                    {/* Accept dropdown button */}
                    <div className="queue-accept-dropdown">
                      <button
                        className="queue-modal-button queue-accept-toggle"
                        onClick={() => toggleDropdown(request.requestId)}
                      >
                        <Check size={16} />
                        Accept
                        <ChevronDown size={14} />
                      </button>

                      {expandedRequest === request.requestId && (
                        <div className="queue-accept-menu">
                          <button
                            className="queue-accept-option"
                            onClick={() =>
                              handleApprove(request.requestId, 'temporary')
                            }
                          >
                            <div className="queue-accept-option-content">
                              <span className="queue-accept-option-title">
                                Temporary Editor
                              </span>
                              <span className="queue-accept-option-desc">
                                Can edit during this session only
                              </span>
                            </div>
                          </button>
                          <button
                            className="queue-accept-option"
                            onClick={() =>
                              handleApprove(request.requestId, 'collaborator')
                            }
                          >
                            <div className="queue-accept-option-content">
                              <span className="queue-accept-option-title">
                                Collaborator
                              </span>
                              <span className="queue-accept-option-desc">
                                Can edit anytime, no ownership
                              </span>
                            </div>
                          </button>
                          <button
                            className="queue-accept-option"
                            onClick={() =>
                              handleApprove(request.requestId, 'co-owner')
                            }
                          >
                            <div className="queue-accept-option-content">
                              <span className="queue-accept-option-title">
                                Co-Owner
                              </span>
                              <span className="queue-accept-option-desc">
                                Full permissions including delete
                              </span>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Deny button */}
                    <button
                      className="queue-modal-button queue-deny"
                      onClick={() => handleDeny(request.requestId)}
                    >
                      <XIcon size={16} />
                      Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionQueueModal;
