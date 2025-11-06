import React, { useState } from 'react';
import { Eye, UserPlus } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import './SpectatorBanner.css';

/**
 * SpectatorBanner - Phase 4: Spectator Mode + Phase 5: Request to Edit
 *
 * Displays a prominent banner when user is in spectator mode,
 * indicating they are viewing a live session but cannot edit.
 * Includes a "Request to Edit" button for Phase 5 queue system.
 */
const SpectatorBanner = () => {
  const { users, spectators } = useAppStore((state) => state.websocket);
  const requestEditAccess = useAppStore(
    (state) => state.websocket.requestEditAccess
  );

  const [hasRequested, setHasRequested] = useState(false);

  const editorCount = users.length;
  const spectatorCount = spectators.length;

  const handleRequestEdit = () => {
    requestEditAccess();
    setHasRequested(true);
  };

  return (
    <div className="spectator-banner">
      <div className="spectator-banner-content">
        <Eye className="spectator-icon" size={20} />
        <div className="spectator-text">
          <span className="spectator-title">Spectating - View Only</span>
          <span className="spectator-description">
            You are watching this beat session in real-time
          </span>
        </div>
        <div className="spectator-stats">
          {editorCount > 0 && (
            <span className="spectator-stat">
              {editorCount} {editorCount === 1 ? 'editor' : 'editors'}
            </span>
          )}
          {spectatorCount > 1 && (
            <span className="spectator-stat">
              {spectatorCount} {spectatorCount === 1 ? 'spectator' : 'spectators'}
            </span>
          )}
        </div>
        <button
          className={`spectator-request-button ${hasRequested ? 'requested' : ''}`}
          onClick={handleRequestEdit}
          disabled={hasRequested}
        >
          <UserPlus size={16} />
          {hasRequested ? 'Request Sent' : 'Request to Edit'}
        </button>
      </div>
    </div>
  );
};

export default SpectatorBanner;
