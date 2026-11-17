import React from "react";
import { usernameToAuthEmail } from "../lib/supabase.js";

const errorText = (error) => {
  const message = error instanceof Error ? error.message : String(error || "Something went wrong.");
  return message.replace(/\s+/g, " ").slice(0, 220);
};

export default function AuthPanel({
  client,
  config,
  session,
  cloudStatus,
  onSaveConfig,
  onSignOut,
  onRetryCloud,
  onGuestMode,
}) {
  const [mode, setMode] = React.useState("login");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [projectUrl, setProjectUrl] = React.useState(config?.url || "https://rekltkovitixcqstvceo.supabase.co");
  const [publishableKey, setPublishableKey] = React.useState(config?.publishableKey || "");
  const [showConnectionForm, setShowConnectionForm] = React.useState(!client);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    setProjectUrl(config?.url || "https://rekltkovitixcqstvceo.supabase.co");
    setPublishableKey(config?.publishableKey || "");
    if (!client) setShowConnectionForm(true);
  }, [config?.url, config?.publishableKey, client]);

  async function saveConnection(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await onSaveConfig({ url: projectUrl, publishableKey });
      setShowConnectionForm(false);
      setMessage("Supabase connection settings saved on this device.");
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function submitAuth(event) {
    event.preventDefault();
    if (!client) {
      setMessage("Set up the Supabase connection first.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const normalizedUsername = username.trim().toLowerCase();
      const email = usernameToAuthEmail(normalizedUsername);

      if (mode === "register") {
        if (password.length < 12) {
          throw new Error("New passwords must be at least 12 characters long.");
        }

        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            data: { username: normalizedUsername },
          },
        });

        if (error) throw error;

        if (!data.session) {
          setMessage(
            "The account was created, but Supabase did not start a session. For this username-only setup, Email Confirmations must be OFF in Supabase Authentication settings. The internal account address cannot receive email."
          );
        } else {
          setMessage("Account created and signed in.");
        }
      } else {
        const { error } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setMessage("Signed in successfully.");
      }

      setPassword("");
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setMessage("");
    try {
      await onSignOut();
      setPassword("");
      setMessage("Signed out. Your local offline profile is still available on this device.");
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="account-page" aria-labelledby="account-title">
      <div className="account-page-heading">
        <span className="eyebrow">PLAYER ACCOUNT</span>
        <h1 id="account-title">Account &amp; Cloud Saves</h1>
        <p className="muted">
          Sign in with the same username and password used by the original Mini Arcade desktop game.
        </p>
      </div>

      <div className="account-panel">
        {session?.user ? (
          <div className="account-signed-in">
            <div className="account-status-icon" aria-hidden="true">✓</div>
            <span className="eyebrow">SIGNED IN</span>
            <h2>{session.user.email?.split("@")[0] || "Player"}</h2>
            <p>Your Mini Arcade account is connected.</p>
            <div className="cloud-status" role="status" aria-live="polite">
              <span className="cloud-status-dot" aria-hidden="true" />
              {cloudStatus}
            </div>
            <div className="account-button-row">
              <button className="account-primary-button" type="button" onClick={onRetryCloud} disabled={busy}>
                Retry cloud sync
              </button>
              <button className="account-secondary-button" type="button" onClick={signOut} disabled={busy}>
                {busy ? "Please wait…" : "Sign out"}
              </button>
            </div>
          </div>
        ) : (
          <>
            {!client || showConnectionForm ? (
              <form className="connection-form" onSubmit={saveConnection}>
                <h2>Connect your Supabase project</h2>
                <p>
                  Use the Project URL and <strong>publishable key</strong> from Supabase Project Settings → API Keys.
                  These settings are saved in this browser only.
                </p>
                <label htmlFor="supabase-project-url">Project URL</label>
                <input
                  id="supabase-project-url"
                  type="url"
                  autoComplete="url"
                  placeholder="https://your-project.supabase.co"
                  value={projectUrl}
                  onChange={(event) => setProjectUrl(event.target.value)}
                  required
                />
                <label htmlFor="supabase-publishable-key">Publishable key (or legacy anon key)</label>
                <input
                  id="supabase-publishable-key"
                  type="password"
                  autoComplete="off"
                  placeholder="sb_publishable_…"
                  value={publishableKey}
                  onChange={(event) => setPublishableKey(event.target.value)}
                  required
                />
                <button className="account-primary-button" type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Save connection"}
                </button>
                {client && (
                  <button
                    className="account-text-button"
                    type="button"
                    onClick={() => setShowConnectionForm(false)}
                  >
                    Cancel
                  </button>
                )}
              </form>
            ) : (
              <div className="connection-saved">
                <span className="eyebrow">PROJECT CONNECTED</span>
                <strong>{config?.url}</strong>
                <p>The browser uses the publishable key only. No service-role or secret key is stored here.</p>
                <button className="account-text-button" type="button" onClick={() => setShowConnectionForm(true)}>
                  Change connection settings
                </button>
              </div>
            )}

            {client && (
              <div className="auth-form-wrap">
                <div className="auth-mode-tabs" role="group" aria-label="Account action">
                  <button
                    type="button"
                    className={mode === "login" ? "auth-mode active" : "auth-mode"}
                    onClick={() => { setMode("login"); setMessage(""); }}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    className={mode === "register" ? "auth-mode active" : "auth-mode"}
                    onClick={() => { setMode("register"); setMessage(""); }}
                  >
                    Create account
                  </button>
                </div>
                <form onSubmit={submitAuth}>
                  <label htmlFor="auth-username">Username</label>
                  <input
                    id="auth-username"
                    type="text"
                    autoComplete="username"
                    minLength={3}
                    maxLength={20}
                    pattern="[A-Za-z0-9_]{3,20}"
                    placeholder="letters, numbers, underscores"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    required
                  />
                  <label htmlFor="auth-password">Password</label>
                  <input
                    id="auth-password"
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    minLength={mode === "register" ? 12 : undefined}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  <button className="account-primary-button" type="submit" disabled={busy}>
                    {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
                  </button>
                </form>
                <p className="account-security-note">
                  Usernames use 3–20 letters, numbers or underscores. New passwords must be at least 12 characters.
                  This username-only setup does not have email-based password recovery.
                </p>
              </div>
            )}
          </>
        )}

        {message && <p className="account-message" role="status" aria-live="polite">{message}</p>}
      </div>
      {!session?.user && onGuestMode && (
        <div className="guest-mode-footer">
          <span>Just looking around?</span>
          <button type="button" className="guest-mode-button" onClick={onGuestMode}>
            Continue as guest
          </button>
        </div>
      )}
    </section>
  );
}
