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

  // Track which request has dropdown open
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

  const toggleDropdown = (requestId) => {
    setExpandedRequest(expandedRequest === requestId ? null : requestId);
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
                  {/* Left side - User info */}
                  <div className="queue-modal-item-left">
                    <span className="queue-modal-username">
                      {request.username || 'Guest User'}
                    </span>
                    <div className="queue-modal-info-row">
                      <span className="queue-modal-time">
                        <Clock size={11} />
                        {getTimeAgo(request.requestedAt)}
                      </span>
                      {request.message && (
                        <span className="queue-modal-message">
                          "{request.message}"
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right side - Actions */}
                  <div className="queue-modal-actions">
                    {/* For guests: Simple accept button (temporary only) */}
                    {!request.userId ? (
                      <button
                        className="queue-accept-main queue-accept-guest"
                        onClick={() => handleApprove(request.requestId, 'temporary')}
                      >
                        <Check size={14} />
                        Accept
                      </button>
                    ) : (
                      /* For authenticated users: Split button with dropdown */
                      <div className="queue-accept-btn-group">
                        <button
                          className="queue-accept-main"
                          onClick={() => handleApprove(request.requestId, 'temporary')}
                        >
                          <Check size={14} />
                          Accept
                        </button>
                        <button
                          className="queue-accept-dropdown-toggle"
                          onClick={() => toggleDropdown(request.requestId)}
                        >
                          <ChevronDown size={14} />
                        </button>

                        {/* Dropdown menu */}
                        {expandedRequest === request.requestId && (
                          <div className="queue-accept-dropdown">
                            <button
                              className="queue-accept-dropdown-item"
                              onClick={() => handleApprove(request.requestId, 'temporary')}
                            >
                              <span className="queue-dropdown-item-title">
                                Temporary Editor
                              </span>
                              <span className="queue-dropdown-item-desc">
                                Can edit during this session only
                              </span>
                            </button>
                            <button
                              className="queue-accept-dropdown-item"
                              onClick={() => handleApprove(request.requestId, 'collaborator')}
                            >
                              <span className="queue-dropdown-item-title">
                                Collaborator
                              </span>
                              <span className="queue-dropdown-item-desc">
                                Can edit anytime, no ownership
                              </span>
                            </button>
                            <button
                              className="queue-accept-dropdown-item"
                              onClick={() => handleApprove(request.requestId, 'co-owner')}
                            >
                              <span className="queue-dropdown-item-title">
                                Co-Owner
                              </span>
                              <span className="queue-dropdown-item-desc">
                                Full permissions including delete
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Deny button */}
                    <button
                      className="queue-deny"
                      onClick={() => handleDeny(request.requestId)}
                    >
                      <XIcon size={14} />
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
