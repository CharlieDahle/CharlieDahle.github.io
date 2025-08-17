// src/pages/Login/Login.jsx - Fixed with React Router navigation
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../../stores";
import AnimatedBackground from "../../components/AnimatedBackground/AnimatedBackground";
import "./Login.css";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const navigate = useNavigate();

  const { isAuthenticated, isLoading, error, login, register, clearError } =
    useAppStore((state) => state.auth);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/beats", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Clear errors when switching between login/register
  useEffect(() => {
    clearError();
  }, [isRegistering, clearError]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      return;
    }

    try {
      if (isRegistering) {
        await register(username.trim(), password);
        navigate("/beats", { replace: true });
      } else {
        await login(username.trim(), password);
        navigate("/beats", { replace: true });
      }
    } catch (err) {
      // Error is handled by the store
      console.error("Auth error:", err);
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setUsername("");
    setPassword("");
    clearError();
  };

  const goToGuest = () => {
    navigate("/DrumMachine");
  };

  return (
    <div className="login-page">
      <AnimatedBackground blobCount={[2, 4]} />

      <div className="login-layout">
        <div className="login-content">
          <div className="login-card">
            <div className="login-header">
              <img src="/pablo.png" alt="Drum Machine" className="login-logo" />
              <h1 className="login-title">
                {isRegistering ? "Create Account" : "Welcome Back"}
              </h1>
              <p className="login-subtitle">
                {isRegistering
                  ? "Create an account to save your beats"
                  : "Sign in to access your saved beats"}
              </p>
            </div>

            <div className="login-body">
              <div className="login-form" onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="username" className="form-label">
                    Username
                  </label>
                  <input
                    type="text"
                    id="username"
                    className="form-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password" className="form-label">
                    Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    className="form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    disabled={isLoading}
                    minLength={6}
                  />
                  {isRegistering && (
                    <small className="form-help">
                      Password must be at least 6 characters long
                    </small>
                  )}
                </div>

                {error && <div className="error-message">{error}</div>}

                <button
                  type="button"
                  className="submit-btn"
                  onClick={handleSubmit}
                  disabled={isLoading || !username.trim() || !password.trim()}
                >
                  {isLoading ? (
                    <span>
                      <span className="loading-spinner"></span>
                      {isRegistering ? "Creating Account..." : "Signing In..."}
                    </span>
                  ) : isRegistering ? (
                    "Create Account"
                  ) : (
                    "Sign In"
                  )}
                </button>
              </div>

              <div className="login-divider">
                <span className="divider-text">or</span>
              </div>

              <div className="mode-switch">
                <p className="mode-text">
                  {isRegistering
                    ? "Already have an account?"
                    : "Don't have an account?"}
                </p>
                <button
                  type="button"
                  className="mode-btn"
                  onClick={toggleMode}
                  disabled={isLoading}
                >
                  {isRegistering ? "Sign In" : "Create Account"}
                </button>
              </div>

              <div className="guest-option">
                <p className="guest-text">Just want to try it out?</p>
                <button type="button" className="guest-btn" onClick={goToGuest}>
                  Continue as Guest
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
