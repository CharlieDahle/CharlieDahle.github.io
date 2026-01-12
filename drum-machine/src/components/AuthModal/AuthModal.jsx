// src/components/AuthModal/AuthModal.jsx
import React, { useState } from 'react';
import { X, LogIn, UserPlus, AlertCircle } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import './AuthModal.css';

/**
 * AuthModal - Phase 6: Guest User Flow
 *
 * In-place authentication modal for guest users to sign in or register
 * without leaving the drum machine interface.
 * Updates auth state and triggers guest-to-owner promotion on success.
 */
const AuthModal = ({ isOpen, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState('signin'); // 'signin' or 'signup'
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [formError, setFormError] = useState(null);

  const login = useAppStore((state) => state.auth.login);
  const register = useAppStore((state) => state.auth.register);
  const isLoading = useAppStore((state) => state.auth.isLoading);

  if (!isOpen) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormError(null); // Clear error on input change
  };

  const validateForm = () => {
    if (!formData.username || formData.username.length < 3) {
      setFormError('Username must be at least 3 characters');
      return false;
    }

    if (!formData.password || formData.password.length < 6) {
      setFormError('Password must be at least 6 characters');
      return false;
    }

    if (activeTab === 'signup' && formData.password !== formData.confirmPassword) {
      setFormError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!validateForm()) {
      return;
    }

    try {
      if (activeTab === 'signin') {
        await login(formData.username, formData.password);
      } else {
        await register(formData.username, formData.password);
      }

      // Success! Close modal and trigger success callback
      if (onSuccess) {
        onSuccess();
      }
      handleClose();
    } catch (error) {
      console.error('Auth error:', error);
      setFormError(error.message || 'Authentication failed. Please try again.');
    }
  };

  const handleClose = () => {
    setFormData({ username: '', password: '', confirmPassword: '' });
    setFormError(null);
    setActiveTab('signin');
    onClose();
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    setFormError(null);
  };

  return (
    <div className="auth-modal-overlay" onClick={handleClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-header">
          <h2 className="auth-modal-title">
            {activeTab === 'signin' ? 'Sign In' : 'Create Account'}
          </h2>
          <button className="auth-modal-close" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <div className="auth-modal-tabs">
          <button
            className={`auth-tab ${activeTab === 'signin' ? 'auth-tab-active' : ''}`}
            onClick={() => switchTab('signin')}
          >
            <LogIn size={16} />
            Sign In
          </button>
          <button
            className={`auth-tab ${activeTab === 'signup' ? 'auth-tab-active' : ''}`}
            onClick={() => switchTab('signup')}
          >
            <UserPlus size={16} />
            Sign Up
          </button>
        </div>

        <form className="auth-modal-form" onSubmit={handleSubmit}>
          {formError && (
            <div className="auth-modal-error">
              <AlertCircle size={16} />
              {formError}
            </div>
          )}

          <div className="auth-form-group">
            <label htmlFor="username" className="auth-form-label">
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              className="auth-form-input"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="Enter your username"
              autoComplete="username"
              disabled={isLoading}
              required
            />
          </div>

          <div className="auth-form-group">
            <label htmlFor="password" className="auth-form-label">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              className="auth-form-input"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Enter your password"
              autoComplete={activeTab === 'signin' ? 'current-password' : 'new-password'}
              disabled={isLoading}
              required
            />
          </div>

          {activeTab === 'signup' && (
            <div className="auth-form-group">
              <label htmlFor="confirmPassword" className="auth-form-label">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                className="auth-form-input"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Confirm your password"
                autoComplete="new-password"
                disabled={isLoading}
                required
              />
            </div>
          )}

          <button
            type="submit"
            className="auth-submit-button"
            disabled={isLoading}
          >
            {isLoading
              ? 'Please wait...'
              : activeTab === 'signin'
              ? 'Sign In'
              : 'Create Account'}
          </button>
        </form>

        {activeTab === 'signin' && (
          <p className="auth-modal-footer">
            Don't have an account?{' '}
            <button
              className="auth-modal-link"
              onClick={() => switchTab('signup')}
            >
              Sign up
            </button>
          </p>
        )}

        {activeTab === 'signup' && (
          <p className="auth-modal-footer">
            Already have an account?{' '}
            <button
              className="auth-modal-link"
              onClick={() => switchTab('signin')}
            >
              Sign in
            </button>
          </p>
        )}
      </div>
    </div>
  );
};

export default AuthModal;
