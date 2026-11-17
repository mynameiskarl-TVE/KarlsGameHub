import React from "react";
import {
  fetchAdminSnapshot,
  setAdminRole,
  setFreePlayTester,
  suspendPlayer,
  unsuspendPlayer,
  sendOnlinePrank,
  PRANK_EVENT_TYPES,
} from "../lib/admin.js";

function formatTimestamp(value) {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime())
    ? date.toLocaleString()
    : "Time unavailable";
}

function safeError(error) {
  const message = error instanceof Error ? error.message : String(error || "Unknown error.");
  return message.replace(/\s+/g, " ").slice(0, 220);
}

export default function AdminPanel({ client, role }) {
  const [snapshot, setSnapshot] = React.useState({ roles: [], suspended: [], audit: [], onlinePlayers: [] });
  const [status, setStatus] = React.useState("Loading protected admin information…");
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [moderationUsername, setModerationUsername] = React.useState("");
  const [moderationReason, setModerationReason] = React.useState("");
  const [roleUsername, setRoleUsername] = React.useState("");
  const [roleAction, setRoleAction] = React.useState("admin");
  const [testerUsername, setTesterUsername] = React.useState("");
  const [testerAction, setTesterAction] = React.useState("grant");
  const [selectedOnlinePlayer, setSelectedOnlinePlayer] = React.useState("");
  const [selectedPrank, setSelectedPrank] = React.useState("confetti");

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setStatus("Loading protected admin information…");

    fetchAdminSnapshot(client)
      .then((data) => {
        if (cancelled) return;
        setSnapshot(data);
        setStatus("");
      })
      .catch((error) => {
        if (cancelled) return;
        setStatus(`Could not load admin information: ${safeError(error)}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, refreshKey]);

  async function runAdminAction(action, successMessage) {
    setBusy(true);
    setStatus("");
    try {
      await action();
      const next = await fetchAdminSnapshot(client);
      setSnapshot(next);
      setModerationReason("");
      setStatus(successMessage);
    } catch (error) {
      setStatus(`Action was rejected: ${safeError(error)}`);
    } finally {
      setBusy(false);
    }
  }

  function submitModeration(event) {
    event.preventDefault();
    const username = moderationUsername.trim();
    if (!username) {
      setStatus("Enter a player username first.");
      return;
    }

    runAdminAction(
      () => suspendPlayer(client, username, moderationReason),
      `Suspended ${username.toLowerCase()}. Their account and saved data were not deleted or reset.`
    );
  }

  function submitRoleChange(event) {
    event.preventDefault();
    const username = roleUsername.trim();
    if (!username) {
      setStatus("Enter a username first.");
      return;
    }

    runAdminAction(
      () => setAdminRole(client, username, roleAction),
      roleAction === "admin"
        ? `Granted administrator access to ${username.toLowerCase()}.`
        : `Removed administrator access from ${username.toLowerCase()}.`
    );
  }

  function submitTesterAccess(event) {
    event.preventDefault();
    const username = testerUsername.trim();
    if (!username) { setStatus("Enter a player username first."); return; }
    const enabled = testerAction === "grant";
    runAdminAction(
      () => setFreePlayTester(client, username, enabled),
      enabled ? "Granted free-play tester access to " + username.toLowerCase() + "." : "Revoked free-play tester access from " + username.toLowerCase() + "."
    );
  }

  function performUnsuspend(username) {
    runAdminAction(
      () => unsuspendPlayer(client, username),
      `Unsuspended ${username}.`
    );
  }

  const isOwner = role === "owner";
  const prankLabels = {
    confetti: "Confetti celebration",
    reality_glitch: "Reality glitch",
    nickname_swap: "Temporary nickname mix-up",
    fake_announcement: "Fake system announcement",
    duck_invasion: "Duck invasion",
    fortune: "Fortune message",
    jumpscare: "Mild spooky surprise",
  };

  function submitPrank(event) {
    event.preventDefault();
    const player = snapshot.onlinePlayers.find((row) => row.userId === selectedOnlinePlayer);
    if (!player) {
      setStatus("Select a player who is currently online.");
      return;
    }

    runAdminAction(
      () => sendOnlinePrank(client, player.userId, selectedPrank),
      `Sent ${prankLabels[selectedPrank] || "surprise"} to ${player.username}. The server enforces the online check and cooldown.`
    );
  }

  return (
    <section className="admin-page" aria-labelledby="admin-title">
      <div className="admin-heading">
        <div>
          <span className="eyebrow">SERVER-AUTHORIZED TOOLS</span>
          <h1 id="admin-title">Admin Console</h1>
          <p className="muted">Management actions are checked by Supabase on every request.</p>
        </div>
        <span className={isOwner ? "admin-role-pill owner" : "admin-role-pill"}>{isOwner ? "OWNER" : "ADMIN"}</span>
      </div>

      <div className="admin-safety-note">
        This console does not access private admin tables directly. It uses server-side RPC functions.
        The web console does not reset player balances or old game statistics when suspending an account.
      </div>

      <div className="admin-toolbar">
        <span>{loading ? "Refreshing protected data…" : "Protected data loaded"}</span>
        <button type="button" className="admin-secondary-button" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading || busy}>
          Refresh data
        </button>
      </div>

      {status && <div className="admin-status" role="status" aria-live="polite">{status}</div>}

      <div className="admin-grid">
        <section className="admin-card">
          <h2>Player moderation</h2>
          <p>Suspend a username to hide it from the shared leaderboard and block web gameplay/cloud syncing for that account.</p>
          <form className="admin-form" onSubmit={submitModeration}>
            <label htmlFor="admin-moderation-username">Player username</label>
            <input
              id="admin-moderation-username"
              value={moderationUsername}
              onChange={(event) => setModerationUsername(event.target.value)}
              minLength={3}
              maxLength={20}
              pattern="[A-Za-z0-9_]{3,20}"
              autoComplete="off"
              required
            />
            <label htmlFor="admin-moderation-reason">Reason (optional, up to 200 characters)</label>
            <textarea
              id="admin-moderation-reason"
              value={moderationReason}
              onChange={(event) => setModerationReason(event.target.value.slice(0, 200))}
              rows={3}
              maxLength={200}
              placeholder="Brief moderation reason"
            />
            <button className="admin-danger-button" type="submit" disabled={busy}>
              {busy ? "Please wait…" : "Suspend player"}
            </button>
          </form>
          <p className="admin-small-note">
            Suspensions do not delete accounts or reset saved progress. The permanent owner cannot be suspended.
            Only the owner can suspend another administrator.
          </p>
        </section>

        <section className="admin-card">
          <h2>Online player surprises</h2>
          <p>Send a temporary, harmless visual effect to a player whose signed-in session has checked in recently. The server enforces permissions and cooldowns.</p>
          <form className="admin-form" onSubmit={submitPrank}>
            <label htmlFor="admin-online-player">Online player</label>
            <select
              id="admin-online-player"
              value={selectedOnlinePlayer}
              onChange={(event) => setSelectedOnlinePlayer(event.target.value)}
              required
            >
              <option value="">Choose a player…</option>
              {snapshot.onlinePlayers.map((row) => (
                <option key={row.userId} value={row.userId}>
                  {row.username} · seen {formatTimestamp(row.lastSeenAt)}
                </option>
              ))}
            </select>
            <label htmlFor="admin-prank-type">Surprise type</label>
            <select
              id="admin-prank-type"
              value={selectedPrank}
              onChange={(event) => setSelectedPrank(event.target.value)}
            >
              {PRANK_EVENT_TYPES.map((eventType) => (
                <option value={eventType} key={eventType}>
                  {prankLabels[eventType] || eventType}
                </option>
              ))}
            </select>
            <button className="admin-primary-button" type="submit" disabled={busy || !snapshot.onlinePlayers.length}>
              {busy ? "Please wait…" : "Send surprise"}
            </button>
          </form>
          <p className="admin-small-note">
            Online presence refreshes approximately every 25 seconds. The receiving player can dismiss the effect, and it closes automatically after a short time.
          </p>
          {snapshot.onlinePlayers.length === 0 && (
            <p className="admin-empty">No online players are currently available. Ask signed-in players to open the web game and refresh this list.</p>
          )}
        </section>

        <section className="admin-card">
          <h2>Suspended accounts</h2>
          {snapshot.suspended.length === 0 ? (
            <p className="admin-empty">No suspended accounts are currently listed.</p>
          ) : (
            <div className="admin-list">
              {snapshot.suspended.map((row) => (
                <article className="admin-list-row" key={row.username}>
                  <div>
                    <strong>{row.username}</strong>
                    <span>{row.reason || "No reason provided"}</span>
                    <small>{formatTimestamp(row.suspendedAt)}</small>
                  </div>
                  <button
                    type="button"
                    className="admin-secondary-button"
                    onClick={() => performUnsuspend(row.username)}
                    disabled={busy}
                  >
                    Unsuspend
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="admin-card">
          <h2>Administrator roles</h2>
          {isOwner && (
            <form className="admin-form admin-role-form" onSubmit={submitRoleChange}>
              <label htmlFor="admin-role-username">Account username</label>
              <input
                id="admin-role-username"
                value={roleUsername}
                onChange={(event) => setRoleUsername(event.target.value)}
                minLength={3}
                maxLength={20}
                pattern="[A-Za-z0-9_]{3,20}"
                autoComplete="off"
                required
              />
              <label htmlFor="admin-role-action">Role action</label>
              <select id="admin-role-action" value={roleAction} onChange={(event) => setRoleAction(event.target.value)}>
                <option value="admin">Grant admin</option>
                <option value="none">Remove admin</option>
              </select>
              <button className="admin-primary-button" type="submit" disabled={busy}>
                Apply role change
              </button>
            </form>
          )}
          {!isOwner && <p className="admin-small-note">Only the permanent owner can grant or revoke administrator roles.</p>}
          {snapshot.roles.length === 0 ? (
            <p className="admin-empty">No administrator records returned.</p>
          ) : (
            <div className="admin-list">
              {snapshot.roles.map((row) => (
                <article className="admin-list-row" key={row.username}>
                  <div>
                    <strong>{row.username}</strong>
                    <span>{row.role.toUpperCase()}</span>
                  </div>
                  <small>{formatTimestamp(row.createdAt)}</small>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="admin-card">
          <h2>Free-play tester access</h2>
          <p>Grant selected accounts tester mode for Blackjack and Slots. Tester mode does not spend or award arcade coins.</p>
          {isOwner ? (
            <form className="admin-form admin-role-form" onSubmit={submitTesterAccess}>
              <label htmlFor="admin-tester-username">Account username</label>
              <input id="admin-tester-username" value={testerUsername} onChange={(event) => setTesterUsername(event.target.value)} minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" autoComplete="off" required />
              <label htmlFor="admin-tester-action">Tester access</label>
              <select id="admin-tester-action" value={testerAction} onChange={(event) => setTesterAction(event.target.value)}>
                <option value="grant">Grant free play</option>
                <option value="revoke">Remove free play</option>
              </select>
              <button className="admin-primary-button" type="submit" disabled={busy}>{testerAction === "grant" ? "Grant tester access" : "Revoke tester access"}</button>
            </form>
          ) : <p className="admin-small-note">Only the permanent owner can grant or revoke tester free-play access.</p>}
          {!snapshot.freePlayTesters?.length ? <p className="admin-empty">No free-play testers have been added.</p> : (
            <div className="admin-list">
              {snapshot.freePlayTesters.map((row) => (
                <article className="admin-list-row" key={row.username}>
                  <div><strong>{row.username}</strong><span>FREE-PLAY TESTER</span></div>
                  <small>{formatTimestamp(row.createdAt)}</small>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="admin-card">
          <h2>Recent admin activity</h2>
          {snapshot.audit.length === 0 ? (
            <p className="admin-empty">No recent admin actions.</p>
          ) : (
            <div className="admin-list">
              {snapshot.audit.map((row, index) => (
                <article className="admin-list-row audit-row" key={`${row.createdAt}-${row.action}-${index}`}>
                  <div>
                    <strong>{row.action.replaceAll("_", " ")}</strong>
                    <span>{row.targetUsername ? `Target: ${row.targetUsername}` : "No target"}</span>
                  </div>
                  <small>{formatTimestamp(row.createdAt)}</small>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
