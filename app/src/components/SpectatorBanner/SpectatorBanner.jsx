import React, { useState, useEffect } from 'react';
import { Eye, UserPlus } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import './SpectatorBanner.css';

const SpectatorBanner = () => {
  const { users, spectators } = useAppStore((state) => state.websocket);
  const beatId = useAppStore((state) => state.websocket.beatId);
  const requestEditAccess = useAppStore(
    (state) => state.websocket.requestEditAccess
  );

  const [hasRequested, setHasRequested] = useState(false);

  // Initialize from localStorage when beatId is known
  useEffect(() => {
    if (beatId) {
      setHasRequested(localStorage.getItem(`requestedAccess_${beatId}`) === 'true');
    }
  }, [beatId]);

  const editorCount = users.length;
  const spectatorCount = spectators.length;

  const handleRequestEdit = () => {
    requestEditAccess();
    setHasRequested(true);
    if (beatId) localStorage.setItem(`requestedAccess_${beatId}`, 'true');
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
