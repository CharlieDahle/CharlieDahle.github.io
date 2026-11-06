import { useState } from "react";
import { useAppStore } from "../../stores";
import "./Budget.css";

// Sign-in for private pages. `allowed` is the usernames that can open the page;
// the server checks this too.
export default function SignIn({ title, allowed, signedInAs, onSwitch }) {
  const login = useAppStore((s) => s.auth.login);
  const logout = useAppStore((s) => s.auth.logout);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await login(username.trim(), password);
      if (!allowed.includes(u.username)) {
        logout();
        setError("This account can't open this page.");
      }
    } catch (err) {
      setError(err.message === "Invalid credentials" ? "Wrong username or password." : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-page bg-signin">
      <a href="https://charliedahle.me" className="bg-back">
        ← charliedahle.me
      </a>
      <form className="bg-signin-form" onSubmit={submit}>
        <h1 className="bg-title">{title}</h1>

        {signedInAs && (
          <p className="bg-note">
            Signed in as {signedInAs}, which can't open this page.{" "}
            <button type="button" className="bg-link" onClick={onSwitch}>
              Sign out
            </button>
          </p>
        )}

        <label className="bg-field">
          <span>Username</span>
          <input
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label className="bg-field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className="bg-error">{error}</p>}

        <button className="bg-btn" disabled={busy || !username || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
