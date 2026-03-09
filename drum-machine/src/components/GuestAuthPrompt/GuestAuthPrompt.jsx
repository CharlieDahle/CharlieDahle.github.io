// src/components/GuestAuthPrompt/GuestAuthPrompt.jsx
import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import './GuestAuthPrompt.css';

/**
 * GuestAuthPrompt - Phase 6: Guest User Flow
 *
 * Warning banner that appears when a guest user makes their first edit.
 * Prompts them to sign in to save their work.
 * Displays as a tasteful banner at the top of the drum machine interface.
 */
const GuestAuthPrompt = ({ onSignIn, onDismiss }) => {
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = () => {
    setDismissed(true);
    if (onDismiss) {
      onDismiss();
    }
  };

  // Don't render if dismissed
  if (dismissed) return null;

  return (
    <div className="guest-auth-prompt">
      <div className="guest-auth-prompt-content">
        <div className="guest-auth-prompt-icon">
          <AlertTriangle size={20} />
        </div>
        <div className="guest-auth-prompt-text">
          <strong>Sign in to save your work</strong>
          <span className="guest-auth-prompt-message">
            Your beat will be lost when you leave unless you create an account
          </span>
        </div>
        <div className="guest-auth-prompt-actions">
          <button
            className="guest-auth-prompt-signin"
            onClick={onSignIn}
          >
            Sign In or Sign Up
          </button>
          <button
            className="guest-auth-prompt-dismiss"
            onClick={handleDismiss}
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuestAuthPrompt;
