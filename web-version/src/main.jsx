import React from "react";
import { createRoot } from "react-dom/client";
import AuthPanel from "./components/AuthPanel.jsx";
import NumberHuntGame from "./components/NumberHuntGame.jsx";
import RockPaperScissorsGame from "./components/RockPaperScissorsGame.jsx";
import TriviaGame from "./components/TriviaGame.jsx";
import {
  claimDailyReward,
  defaultProfile,
  getLocalDateKey,
  loadProfile,
  MAX_BALANCE,
  MAX_NICKNAME_LENGTH,
  PROFILE_STORAGE_KEY,
  saveProfile,
} from "./profile/storage.js";
import {
  createSupabaseBrowserClient,
  loadSupabaseConfig,
  saveSupabaseConfig,
} from "./lib/supabase.js";
import {
  fetchPlayerCloudSave,
  fetchPlayerModerationStatus,
  syncPlayerLeaderboard,
  uploadPlayerCloudSave,
} from "./lib/cloudSaves.js";
import { getLegacyUsername, profileFromLegacySave } from "./profile/legacy.js";
import { fetchLeaderboard } from "./lib/leaderboard.js";
import "./style.css";

const tabs = [
  "Home",
  "Arcade games",
  "Number Hunt",
  "Rock Paper Scissors",
  "Trivia",
  "Profile & stats",
  "Leaderboard",
  "Account",
];

const formatPoints = (value) => new Intl.NumberFormat("en-US").format(value);
const accountStorageKey = (userId) => `${PROFILE_STORAGE_KEY}.account.${userId}`;

function readStoredSupabaseConfig() {
  try {
    return loadSupabaseConfig(window.localStorage);
  } catch {
    return null;
  }
}

function makeInitialSupabaseClient() {
  const config = readStoredSupabaseConfig();
  if (!config) return null;
  try {
    return createSupabaseBrowserClient(config);
  } catch {
    return null;
  }
}

function readProfileForKey(key = PROFILE_STORAGE_KEY) {
  try {
    return loadProfile(window.localStorage, key);
  } catch {
    return defaultProfile();
  }
}

function App() {
  const [active, setActive] = React.useState("Home");
  const [profile, setProfile] = React.useState(() => readProfileForKey());
  const [nicknameInput, setNicknameInput] = React.useState(profile.nickname);
  const [nicknameMessage, setNicknameMessage] = React.useState("");
  const [dailyRewardMessage, setDailyRewardMessage] = React.useState("");
  const [storageStatus, setStorageStatus] = React.useState("Checking browser storage…");

  const [supabaseConfig, setSupabaseConfig] = React.useState(readStoredSupabaseConfig);
  const [supabaseClient, setSupabaseClient] = React.useState(makeInitialSupabaseClient);
  const [session, setSession] = React.useState(null);
  const [authReady, setAuthReady] = React.useState(false);
  const [profileLoadedForUser, setProfileLoadedForUser] = React.useState("");
  const [cloudStatus, setCloudStatus] = React.useState("Sign in to enable cloud saves.");
  const [cloudRetryNonce, setCloudRetryNonce] = React.useState(0);
  const [moderationStatus, setModerationStatus] = React.useState({
    checked: false,
    suspended: false,
    reason: "",
  });
  const [leaderboardRows, setLeaderboardRows] = React.useState([]);
  const [leaderboardStatus, setLeaderboardStatus] = React.useState("Sign in to view the leaderboard.");
  const [leaderboardRetry, setLeaderboardRetry] = React.useState(0);

  const sessionRef = React.useRef(null);
  const cloudSaveBaseRef = React.useRef({});
  const cloudSyncQueueRef = React.useRef(Promise.resolve());

  const activeProfileKey = session?.user?.id
    ? accountStorageKey(session.user.id)
    : PROFILE_STORAGE_KEY;

  React.useEffect(() => {
    let saved = false;
    try {
      saved = saveProfile(profile, window.localStorage, activeProfileKey);
    } catch {
      saved = false;
    }
    setStorageStatus(
      saved
        ? session?.user?.id
          ? "A local copy of this account's progress is saved on this device."
          : "Offline progress is saved on this device."
        : "Browser storage is unavailable. Progress may not persist after closing the page."
    );
  }, [profile, activeProfileKey, session?.user?.id]);

  React.useEffect(() => {
    setNicknameInput(profile.nickname);
  }, [profile.nickname]);

  React.useEffect(() => {
    if (!supabaseClient) {
      sessionRef.current = null;
      setSession(null);
      setAuthReady(true);
      setCloudStatus("Connect your Supabase project to enable account saves.");
      setProfileLoadedForUser("");
      setModerationStatus({ checked: false, suspended: false, reason: "" });
      return undefined;
    }

    let activeEffect = true;
    setAuthReady(false);

    const applySession = (nextSession) => {
      const previousUserId = sessionRef.current?.user?.id || "";
      const nextUserId = nextSession?.user?.id || "";

      sessionRef.current = nextSession;
      setSession(nextSession);
      setAuthReady(true);

      if (nextUserId && nextUserId !== previousUserId) {
        setProfile(readProfileForKey(accountStorageKey(nextUserId)));
        setProfileLoadedForUser("");
        setModerationStatus({ checked: false, suspended: false, reason: "" });
        cloudSaveBaseRef.current = {};
        setCloudStatus("Loading this account's cloud save…");
      } else if (!nextUserId && previousUserId) {
        setProfile(readProfileForKey(PROFILE_STORAGE_KEY));
        setProfileLoadedForUser("");
        setModerationStatus({ checked: false, suspended: false, reason: "" });
        cloudSaveBaseRef.current = {};
        setCloudStatus("Signed out. Offline progress remains available.");
      }
    };

    const { data } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });

    supabaseClient.auth.getSession().then(({ data: sessionData, error }) => {
      if (!activeEffect) return;
      if (error) {
        setCloudStatus("Could not restore the saved sign-in session. Please sign in again.");
      }
      applySession(sessionData?.session || null);
    }).catch(() => {
      if (activeEffect) {
        setCloudStatus("Could not restore the saved sign-in session. Please sign in again.");
        applySession(null);
      }
    });

    return () => {
      activeEffect = false;
      data.subscription.unsubscribe();
    };
  }, [supabaseClient]);

  React.useEffect(() => {
    const userId = session?.user?.id;
    if (!authReady || !supabaseClient || !userId) {
      setProfileLoadedForUser("");
      if (!userId && authReady) {
        setCloudStatus(supabaseClient ? "Sign in to enable cloud saves." : "Connect your Supabase project to enable cloud saves.");
      }
      return undefined;
    }

    let cancelled = false;
    setProfileLoadedForUser("");
    setCloudStatus("Checking account status and loading cloud save…");

    async function loadAccountSave() {
      try {
        const status = await fetchPlayerModerationStatus(supabaseClient);
        if (cancelled) return;

        setModerationStatus({
          checked: true,
          suspended: status.suspended,
          reason: status.reason,
        });

        if (status.suspended) {
          setCloudStatus(
            status.reason
              ? `This account is suspended: ${status.reason}`
              : "This account is suspended. Cloud saving is disabled."
          );
          return;
        }

        const remote = await fetchPlayerCloudSave(supabaseClient, userId);
        if (cancelled) return;

        const localAccountProfile = readProfileForKey(accountStorageKey(userId));
        if (remote.exists) {
          cloudSaveBaseRef.current =
            remote.saveData && typeof remote.saveData === "object" && !Array.isArray(remote.saveData)
              ? remote.saveData
              : {};
          const username = getLegacyUsername(session.user);
          const cloudProfile = profileFromLegacySave(
            cloudSaveBaseRef.current,
            localAccountProfile,
            username
          );
          setProfile(cloudProfile);
          setCloudStatus("Existing cloud save loaded. Changes will sync automatically.");
        } else {
          // New account on this device: do not copy the shared offline profile or another
          // account's local data into a new account automatically.
          cloudSaveBaseRef.current = {};
          setProfile(localAccountProfile);
          setCloudStatus("No cloud save exists yet. This account will create its first save.");
        }

        setProfileLoadedForUser(userId);
      } catch (error) {
        if (cancelled) return;
        setModerationStatus({ checked: false, suspended: false, reason: "" });
        const message = error instanceof Error ? error.message : "Unknown error";
        setCloudStatus(`Cloud save paused because the server check failed: ${message.slice(0, 160)}`);
      }
    }

    loadAccountSave();
    return () => {
      cancelled = true;
    };
  }, [authReady, supabaseClient, session?.user?.id, cloudRetryNonce]);

  React.useEffect(() => {
    const userId = session?.user?.id;
    if (
      !supabaseClient ||
      !userId ||
      profileLoadedForUser !== userId ||
      !moderationStatus.checked ||
      moderationStatus.suspended
    ) {
      return undefined;
    }

    let cancelled = false;
    const profileSnapshot = profile;
    const baseSnapshot =
      cloudSaveBaseRef.current && typeof cloudSaveBaseRef.current === "object"
        ? { ...cloudSaveBaseRef.current }
        : {};
    const timer = window.setTimeout(() => {
      cloudSyncQueueRef.current = cloudSyncQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (cancelled) return;
          const latestProfile = profileSnapshot;
          setCloudStatus("Saving your progress to Supabase…");

          try {
            const updatedBase = await uploadPlayerCloudSave(
              supabaseClient,
              userId,
              latestProfile,
              baseSnapshot
            );
            if (sessionRef.current?.user?.id === userId) {
              cloudSaveBaseRef.current = updatedBase;
            }

            await syncPlayerLeaderboard(
              supabaseClient,
              userId,
              latestProfile
            );

            if (!cancelled) {
              setCloudStatus("Cloud save and leaderboard profile are up to date.");
            }
          } catch (error) {
            if (!cancelled) {
              const message = error instanceof Error ? error.message : "Unknown error";
              setCloudStatus(`Cloud save failed: ${message.slice(0, 160)}`);
            }
          }
        });
    }, 900);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    supabaseClient,
    session?.user?.id,
    profileLoadedForUser,
    profile,
    moderationStatus.checked,
    moderationStatus.suspended,
  ]);

  React.useEffect(() => {
    if (active !== "Leaderboard") return undefined;

    if (!supabaseClient) {
      setLeaderboardRows([]);
      setLeaderboardStatus("Connect your Supabase project in Account, then sign in to view the leaderboard.");
      return undefined;
    }
    if (!session?.user?.id) {
      setLeaderboardRows([]);
      setLeaderboardStatus("Sign in to view the shared leaderboard.");
      return undefined;
    }
    if (moderationStatus.checked && moderationStatus.suspended) {
      setLeaderboardRows([]);
      setLeaderboardStatus("Leaderboard access is unavailable for this suspended account.");
      return undefined;
    }
    if (
      !authReady ||
      !moderationStatus.checked ||
      profileLoadedForUser !== session.user.id
    ) {
      setLeaderboardStatus(cloudStatus || "Checking your account before loading the leaderboard…");
      return undefined;
    }

    let cancelled = false;
    setLeaderboardStatus("Loading the leaderboard…");

    fetchLeaderboard(supabaseClient, 50)
      .then((rows) => {
        if (cancelled) return;
        setLeaderboardRows(rows);
        setLeaderboardStatus(rows.length ? "" : "There are no leaderboard entries yet.");
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Unknown error";
        setLeaderboardStatus(`Could not load the leaderboard: ${message.slice(0, 180)}`);
      });

    return () => {
      cancelled = true;
    };
  }, [
    active,
    supabaseClient,
    session?.user?.id,
    authReady,
    moderationStatus.checked,
    moderationStatus.suspended,
    profileLoadedForUser,
    cloudRetryNonce,
    leaderboardRetry,
    cloudStatus,
  ]);

  const balance = profile.balance;
  const today = getLocalDateKey();
  const dailyRewardClaimed = profile.lastDailyReward === today;
  const stats = profile.stats;
  const totalGamesPlayed =
    stats.numberHuntGames + stats.rpsGames + stats.triviaGames;

  function awardPoints(amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0) return;
    setProfile((current) => ({
      ...current,
      balance: Math.min(MAX_BALANCE, current.balance + amount),
    }));
  }

  function recordGameResult(result) {
    if (!result || typeof result !== "object") return;

    setProfile((current) => {
      const nextStats = { ...current.stats };
      const increment = (key, amount = 1) => {
        nextStats[key] = Math.min(MAX_BALANCE, nextStats[key] + amount);
      };

      if (result.game === "numberHunt") {
        increment("numberHuntGames");
        if (result.outcome === "win") increment("numberHuntWins");
      } else if (result.game === "rps") {
        increment("rpsGames");
        if (result.outcome === "win") increment("rpsWins");
        if (result.outcome === "tie") increment("rpsTies");
      } else if (result.game === "trivia") {
        increment("triviaGames");
        if (Number.isSafeInteger(result.correctAnswers) && result.correctAnswers >= 0) {
          increment("triviaCorrect", Math.min(5, result.correctAnswers));
        }
      } else {
        return current;
      }

      return { ...current, stats: nextStats };
    });
  }

  function collectDailyReward() {
    const result = claimDailyReward(profile, today);
    if (!result.claimed) {
      setDailyRewardMessage("Today's reward has already been collected.");
      return;
    }

    setProfile(result.profile);
    setDailyRewardMessage(`Daily reward collected: +${formatPoints(result.reward)} points.`);
  }

  function saveNickname(event) {
    event.preventDefault();
    const nickname = nicknameInput.trim().slice(0, MAX_NICKNAME_LENGTH);
    if (!nickname) {
      setNicknameMessage("Enter a display name before saving.");
      return;
    }

    setProfile((current) => ({ ...current, nickname }));
    setNicknameMessage("Display name updated.");
  }

  function saveConnection(config) {
    const saved = saveSupabaseConfig(config, window.localStorage);
    const client = createSupabaseBrowserClient(saved);
    setSupabaseConfig(saved);
    setSupabaseClient(client);
    setCloudStatus("Supabase connection saved. Sign in to load your cloud progress.");
  }

  async function signOut() {
    if (!supabaseClient) return;
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
  }

  function retryCloudSync() {
    setCloudRetryNonce((value) => value + 1);
  }

  function gameCard(title, description, icon, tab) {
    return (
      <button className="game-card" type="button" key={title} onClick={() => setActive(tab)}>
        <span className="game-icon" aria-hidden="true">{icon}</span>
        <strong>{title}</strong>
        <small>{description}</small>
      </button>
    );
  }

  function statCard(label, value, detail) {
    return (
      <article className="profile-stat-card" key={label}>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </article>
    );
  }

  const signedInUsername = getLegacyUsername(session?.user) || "Player";
  const isCloudLoading =
    Boolean(supabaseClient) &&
    (!authReady ||
      (Boolean(session?.user?.id) &&
        (profileLoadedForUser !== session.user.id || moderationStatus.suspended)));

  return (
    <main className="app-shell">
      <header className="topbar">
        <button
          className="brand brand-button"
          type="button"
          onClick={() => setActive("Home")}
          aria-label="Go to home"
        >
          MINI ARCADE
        </button>
        <div className="account-area">
          {session?.user ? (
            <>
              <span className="profile-name">{signedInUsername}</span>
              <span className="balance">{formatPoints(balance)} pts</span>
            </>
          ) : (
            <>
              <span className="profile-name">{profile.nickname}</span>
              <span className="balance">{formatPoints(balance)} pts</span>
            </>
          )}
          <button className="small-button" type="button" onClick={() => setActive("Account")}>
            {session?.user ? "Account" : "Sign in"}
          </button>
        </div>
      </header>

      <div className="announcement">
        Welcome to Mini Arcade! Have fun and enjoy the games.
      </div>

      <nav className="tabs" aria-label="Main navigation">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={active === tab ? "tab active" : "tab"}
            onClick={() => setActive(tab)}
            aria-current={active === tab ? "page" : undefined}
          >
            {tab}
          </button>
        ))}
      </nav>

      <section className="content">
        {active === "Home" && (
          <>
            <h1>Welcome back, {session?.user ? signedInUsername : profile.nickname}</h1>
            <p className="muted">Your games, stats and rewards — all in one place.</p>
            <div className="cards">
              <article className="card">
                <h2>YOUR BALANCE</h2>
                <p>Your current arcade balance is {formatPoints(balance)} points.</p>
                <span className="pill">Fictional points</span>
              </article>
              <article className="card">
                <h2>DAILY REWARD</h2>
                <p>{`Collect ${formatPoints(profile.dailyReward)} points once per local calendar day.`}</p>
                <button
                  className="profile-action-button"
                  type="button"
                  onClick={collectDailyReward}
                  disabled={dailyRewardClaimed || (Boolean(session?.user) && isCloudLoading)}
                >
                  {dailyRewardClaimed ? "Collected today" : "Claim +100 points"}
                </button>
                <p className="daily-reward-message" role="status" aria-live="polite">
                  {dailyRewardMessage || (dailyRewardClaimed ? "Today's reward has already been collected." : "Your daily reward is ready.")}
                </p>
              </article>
              <article className="card">
                <h2>YOUR PROGRESS</h2>
                <p>{formatPoints(totalGamesPlayed)} completed games across the web arcade.</p>
                <span className="pill">{session?.user ? "Cloud account" : "Offline profile"}</span>
              </article>
            </div>
            <h2 className="section-heading">Jump back in</h2>
            <div className="game-grid">
              {gameCard("Number Hunt", "Find the secret number", "🔎", "Number Hunt")}
              {gameCard("Rock Paper Scissors", "Choose your move", "✊", "Rock Paper Scissors")}
              {gameCard("Quick Trivia", "Try five questions", "❔", "Trivia")}
            </div>
          </>
        )}

        {active === "Arcade games" && (
          <>
            <h1>Arcade Games</h1>
            <p className="muted">Choose a game to play. More of the original collection will be added here.</p>
            <div className="game-grid arcade-game-grid">
              {gameCard("Number Hunt", "Find the secret number in five guesses", "🔎", "Number Hunt")}
              {gameCard("Rock Paper Scissors", "Play against the computer", "✊", "Rock Paper Scissors")}
              {gameCard("Quick Trivia", "Answer five randomly selected questions", "❔", "Trivia")}
            </div>
            <p className="session-note">Games with entry bets or point-loss mechanics are not included in this web migration.</p>
          </>
        )}

        {/* Keep games mounted when switching tabs, so active rounds are preserved. */}
        <div hidden={active !== "Number Hunt"}>
          {isCloudLoading ? (
            <div className="cloud-loading-screen" role="status">{cloudStatus}</div>
          ) : (
            <NumberHuntGame balance={balance} onEarnPoints={awardPoints} onGameResult={recordGameResult} rewardAmount={profile.numberReward} />
          )}
        </div>
        <div hidden={active !== "Rock Paper Scissors"}>
          {isCloudLoading ? (
            <div className="cloud-loading-screen" role="status">{cloudStatus}</div>
          ) : (
            <RockPaperScissorsGame balance={balance} onEarnPoints={awardPoints} onGameResult={recordGameResult} rewardAmount={profile.rpsReward} />
          )}
        </div>
        <div hidden={active !== "Trivia"}>
          {isCloudLoading ? (
            <div className="cloud-loading-screen" role="status">{cloudStatus}</div>
          ) : (
            <TriviaGame balance={balance} onEarnPoints={awardPoints} onGameResult={recordGameResult} rewardPerCorrect={profile.triviaReward} />
          )}
        </div>

        {active === "Profile & stats" && (
          <section className="profile-page" aria-labelledby="profile-title">
            <div className="profile-heading">
              <span className="eyebrow">PLAYER ACCOUNT</span>
              <h1 id="profile-title">Profile &amp; Stats</h1>
              <p className="muted">
                {session?.user
                  ? "Your account progress is saved to Supabase and cached on this device."
                  : "Your offline profile is stored locally in this browser."}
              </p>
            </div>

            <form className="profile-card" onSubmit={saveNickname}>
              <label htmlFor="profile-nickname">Display name</label>
              <div className="profile-name-row">
                <input
                  id="profile-nickname"
                  type="text"
                  maxLength={MAX_NICKNAME_LENGTH}
                  value={nicknameInput}
                  onChange={(event) => setNicknameInput(event.target.value)}
                  placeholder="Choose a display name"
                />
                <button className="profile-action-button" type="submit">Save name</button>
              </div>
              <p className="profile-help">Up to {MAX_NICKNAME_LENGTH} characters. {session?.user ? "The change syncs to your account." : "This name is saved on this device only."}</p>
              {nicknameMessage && <p className="profile-message" role="status">{nicknameMessage}</p>}
            </form>

            <div className="profile-stats-grid">
              {statCard("POINT BALANCE", formatPoints(balance), "Fictional arcade points")}
              {statCard("TOTAL GAMES", formatPoints(totalGamesPlayed), "Completed games")}
              {statCard("NUMBER HUNT", `${stats.numberHuntWins} / ${stats.numberHuntGames}`, "Wins / completed games")}
              {statCard("RPS WINS", formatPoints(stats.rpsWins), `${stats.rpsGames} games · ${stats.rpsTies} ties`)}
              {statCard("TRIVIA", formatPoints(stats.triviaCorrect), `Correct answers across ${stats.triviaGames} quizzes`)}
              {statCard("DAILY REWARDS", formatPoints(stats.dailyLogins), "Days claimed on this device")}
              {statCard("DAILY BONUS", `${formatPoints(profile.dailyReward)} pts`, "Reward amount from your save")}
              {statCard("GAME REWARDS", `${profile.numberReward} / ${profile.rpsReward} / ${profile.triviaReward}`, "Number Hunt / RPS / Trivia")}
            </div>

            <div className="profile-save-status" role="status" aria-live="polite">
              <span className="save-indicator" aria-hidden="true" />
              {storageStatus}
            </div>
            <p className="profile-storage-note">
              {session?.user
                ? "Your cloud save is the account copy. This browser also keeps a local cache. Signing out does not delete either save."
                : "This offline save is stored in this browser only. Clearing this browser's site data can erase it. Sign in to link a separate account save."}
            </p>
          </section>
        )}

        {active === "Leaderboard" && (
          <section className="leaderboard-page" aria-labelledby="leaderboard-title">
            <div className="leaderboard-heading">
              <div>
                <span className="eyebrow">ARCADE STANDINGS</span>
                <h1 id="leaderboard-title">Leaderboard</h1>
                <p className="muted">Top 50 players, ranked by points and then Trivia correct answers.</p>
              </div>
              <button
                className="leaderboard-refresh"
                type="button"
                onClick={() => setLeaderboardRetry((value) => value + 1)}
                disabled={!session?.user || !supabaseClient}
              >
                Refresh
              </button>
            </div>

            {!session?.user ? (
              <div className="leaderboard-empty card">
                <h2>Sign in to view the leaderboard</h2>
                <p>The shared standings are only available to signed-in players.</p>
                <button className="profile-action-button" type="button" onClick={() => setActive("Account")}>
                  Open account
                </button>
              </div>
            ) : (
              <>
                {leaderboardStatus && (
                  <div className="leaderboard-status" role="status" aria-live="polite">
                    {leaderboardStatus}
                    {leaderboardStatus.startsWith("Could not load") && (
                      <button type="button" onClick={() => setLeaderboardRetry((value) => value + 1)}>
                        Try again
                      </button>
                    )}
                  </div>
                )}

                {leaderboardRows.length > 0 && (
                  <div className="leaderboard-table-wrap">
                    <table className="leaderboard-table">
                      <thead>
                        <tr>
                          <th scope="col">Rank</th>
                          <th scope="col">Player</th>
                          <th scope="col">Points</th>
                          <th scope="col">Trivia correct</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboardRows.map((row, index) => (
                          <tr key={`${row.username}-${index}`}>
                            <td className="leaderboard-rank">{index + 1}</td>
                            <td>
                              <strong>{row.nickname}</strong>
                              <small>@{row.username}</small>
                            </td>
                            <td className="leaderboard-number">{formatPoints(row.points)}</td>
                            <td className="leaderboard-number">{formatPoints(row.triviaCorrect)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="leaderboard-disclaimer">
                  Points and Trivia results are currently player-reported through game saves, not independently verified by a server-side scoring system.
                  They are suitable for casual standings, not a cheat-proof competition.
                </p>
              </>
            )}
          </section>
        )}

        {active === "Account" && (
          <AuthPanel
            client={supabaseClient}
            config={supabaseConfig}
            session={session}
            cloudStatus={cloudStatus}
            onSaveConfig={saveConnection}
            onSignOut={signOut}
            onRetryCloud={retryCloudSync}
          />
        )}
      </section>

      <footer>
        <span>Mini Arcade Hub</span>
        <span>Web edition · Early development</span>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
