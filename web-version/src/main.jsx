import React from "react";
import { createRoot } from "react-dom/client";
import AuthPanel from "./components/AuthPanel.jsx";
import AudioSettingsPanel from "./components/AudioSettingsPanel.jsx";
import PrankOverlay from "./components/PrankOverlay.jsx";
import AdminPanel from "./components/AdminPanel.jsx";
import NumberHuntGame from "./components/NumberHuntGame.jsx";
import RockPaperScissorsGame from "./components/RockPaperScissorsGame.jsx";
import TriviaGame from "./components/TriviaGame.jsx";
import BlackjackGame from "./components/BlackjackGame.jsx";
import SlotMachineGame from "./components/SlotMachineGame.jsx";
import CoinFlipGame from "./components/CoinFlipGame.jsx";
import MemoryMatchGame from "./components/MemoryMatchGame.jsx";
import PatternRecallGame from "./components/PatternRecallGame.jsx";
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
import { DEFAULT_SUPABASE_CONFIG } from "./lib/defaultSupabaseConfig.js";
import {
  fetchPlayerCloudSave,
  fetchPlayerModerationStatus,
  syncPlayerLeaderboard,
  uploadPlayerCloudSave,
} from "./lib/cloudSaves.js";
import { getLegacyUsername, profileFromLegacySave } from "./profile/legacy.js";
import { fetchLeaderboard } from "./lib/leaderboard.js";
import {
  fetchAdminRole,
  fetchFreePlayAccess,
  registerPrankPresence,
  pollPrankEvents,
  leavePrankPresence,
} from "./lib/admin.js";
import "./style.css";

const tabs = [
  "Home",
  "Blackjack",
  "Arcade games",
  "Profile & stats",
  "Leaderboard",
];

const formatPoints = (value) => new Intl.NumberFormat("en-US").format(value);
const accountStorageKey = (userId) => `${PROFILE_STORAGE_KEY}.account.${userId}`;

function readStoredSupabaseConfig() {
  try {
    const stored = loadSupabaseConfig(window.localStorage);
    if (!stored) return DEFAULT_SUPABASE_CONFIG;

    // Prefer the current publishable key if this device still has the project's old anon key.
    const sameProject = stored.url === DEFAULT_SUPABASE_CONFIG.url;
    const isModernKey = stored.publishableKey.startsWith("sb_publishable_");
    return sameProject && !isModernKey ? DEFAULT_SUPABASE_CONFIG : stored;
  } catch {
    return DEFAULT_SUPABASE_CONFIG;
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
  const [storageStatus, setStorageStatus] = React.useState("Checking browser storage…");

  const [supabaseConfig, setSupabaseConfig] = React.useState(readStoredSupabaseConfig);
  const [supabaseClient, setSupabaseClient] = React.useState(makeInitialSupabaseClient);
  const [session, setSession] = React.useState(null);
  const [guestMode, setGuestMode] = React.useState(false);
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
  const [adminRole, setAdminRole] = React.useState(null);
  const [freePlayAccess, setFreePlayAccess] = React.useState(false);
  const [freePlayCheckedForUser, setFreePlayCheckedForUser] = React.useState("");
  const [adminVerifiedForUser, setAdminVerifiedForUser] = React.useState("");
  const [prankQueue, setPrankQueue] = React.useState([]);

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
      if (nextUserId) setGuestMode(false);
      setAuthReady(true);

      if (nextUserId && nextUserId !== previousUserId) {
        setProfile(readProfileForKey(accountStorageKey(nextUserId)));
        setProfileLoadedForUser("");
        setModerationStatus({ checked: false, suspended: false, reason: "" });
        setFreePlayAccess(false);
        setFreePlayCheckedForUser("");
        cloudSaveBaseRef.current = {};
        setCloudStatus("Loading this account's cloud save…");
      } else if (!nextUserId && previousUserId) {
        setProfile(readProfileForKey(PROFILE_STORAGE_KEY));
        setProfileLoadedForUser("");
        setModerationStatus({ checked: false, suspended: false, reason: "" });
        setFreePlayAccess(false);
        setFreePlayCheckedForUser("");
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
    const userId = session?.user?.id;
    const username = getLegacyUsername(session?.user);

    if (
      !supabaseClient ||
      !userId ||
      !authReady ||
      !moderationStatus.checked ||
      moderationStatus.suspended ||
      profileLoadedForUser !== userId ||
      !username
    ) {
      setPrankQueue([]);
      return undefined;
    }

    let cancelled = false;
    let cycleBusy = false;
    let lastHeartbeatAt = 0;
    const seenEventIds = new Set();

    async function runPrankCycle() {
      if (cancelled || cycleBusy) return;
      cycleBusy = true;

      try {
        const now = Date.now();
        if (now - lastHeartbeatAt >= 25_000) {
          try {
            await registerPrankPresence(supabaseClient, username);
            lastHeartbeatAt = Date.now();
          } catch {
            // The next cycle retries. Polling remains account-scoped by auth.uid().
          }
        }

        if (document.visibilityState !== "hidden") {
          try {
            const events = await pollPrankEvents(supabaseClient);
            if (!cancelled && events.length) {
              const freshEvents = events.filter((event) => {
                if (!event.eventId || seenEventIds.has(event.eventId)) return false;
                seenEventIds.add(event.eventId);
                return true;
              });
              if (freshEvents.length) {
                setPrankQueue((current) => [...current, ...freshEvents].slice(0, 10));
              }
              if (seenEventIds.size > 100) {
                const keep = [...seenEventIds].slice(-50);
                seenEventIds.clear();
                keep.forEach((id) => seenEventIds.add(id));
              }
            }
          } catch {
            // Prank polling is best-effort and never interrupts gameplay.
          }
        }
      } finally {
        cycleBusy = false;
      }
    }

    // Delay the first poll slightly so development StrictMode's setup/cleanup
    // cycle cannot claim and discard a one-time server-delivered event.
    const initialTimer = window.setTimeout(runPrankCycle, 500);
    const interval = window.setInterval(runPrankCycle, 3_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") runPrankCycle();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [
    supabaseClient,
    session?.user?.id,
    session?.user?.email,
    authReady,
    moderationStatus.checked,
    moderationStatus.suspended,
    profileLoadedForUser,
  ]);

  React.useEffect(() => {
    const userId = session?.user?.id;
    if (!supabaseClient || !userId || !authReady || !moderationStatus.checked || moderationStatus.suspended) {
      setFreePlayAccess(false);
      setFreePlayCheckedForUser(userId && moderationStatus.suspended ? userId : "");
      return undefined;
    }
    let cancelled = false;
    setFreePlayAccess(false);
    setFreePlayCheckedForUser("");
    fetchFreePlayAccess(supabaseClient)
      .then((enabled) => {
        if (!cancelled) {
          setFreePlayAccess(enabled);
          setFreePlayCheckedForUser(userId);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFreePlayAccess(false);
          setFreePlayCheckedForUser(userId);
        }
      });
    return () => { cancelled = true; };
  }, [supabaseClient, session?.user?.id, authReady, moderationStatus.checked, moderationStatus.suspended, cloudRetryNonce]);

  React.useEffect(() => {
    const userId = session?.user?.id;

    if (!supabaseClient || !userId || !authReady) {
      setAdminRole(null);
      setAdminVerifiedForUser("");
      return undefined;
    }
    if (!moderationStatus.checked) {
      setAdminRole(null);
      setAdminVerifiedForUser("");
      return undefined;
    }
    if (moderationStatus.suspended) {
      setAdminRole(null);
      setAdminVerifiedForUser(userId);
      return undefined;
    }

    let cancelled = false;
    setAdminRole(null);
    setAdminVerifiedForUser("");

    fetchAdminRole(supabaseClient)
      .then((role) => {
        if (cancelled) return;
        setAdminRole(role);
        setAdminVerifiedForUser(userId);
      })
      .catch(() => {
        if (cancelled) return;
        // Fail closed: an unavailable role check never grants admin UI access.
        setAdminRole(null);
        setAdminVerifiedForUser(userId);
      });

    return () => {
      cancelled = true;
    };
  }, [
    supabaseClient,
    session?.user?.id,
    authReady,
    moderationStatus.checked,
    moderationStatus.suspended,
    cloudRetryNonce,
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
  const stats = profile.stats;

  // Match the original desktop game: one daily reward is granted automatically.
  // The functional update makes this safe under StrictMode and cloud-save hydration.
  React.useEffect(() => {
    if (profile.lastDailyReward === today) return;
    setProfile((current) => {
      if (current.lastDailyReward === today) return current;
      return claimDailyReward(current, today).profile;
    });
  }, [today, profile.lastDailyReward]);
  const totalGamesPlayed =
    stats.blackjackGames + stats.coinFlips + stats.slotSpins + stats.numberHuntGames +
    stats.rpsGames + stats.triviaGames + stats.memoryGames + stats.patternGames;

  function awardPoints(amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0) return;
    setProfile((current) => ({
      ...current,
      balance: Math.min(MAX_BALANCE, current.balance + amount),
    }));
  }

  function spendPoints(amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0 || balance < amount) return false;
    setProfile((current) => {
      if (current.balance < amount) return current;
      return { ...current, balance: current.balance - amount };
    });
    return true;
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
      } else if (result.game === "memory") {
        increment("memoryGames");
        if (result.outcome === "win") increment("memoryWins");
      } else if (result.game === "pattern") {
        increment("patternGames");
        if (result.outcome === "win") increment("patternWins");
      } else if (result.game === "blackjack") {
        increment("blackjackGames");
        increment("blackjackWins", Number.isSafeInteger(result.wins) ? Math.min(10, result.wins) : 0);
        increment("blackjackLosses", Number.isSafeInteger(result.losses) ? Math.min(10, result.losses) : 0);
        increment("blackjackPushes", Number.isSafeInteger(result.pushes) ? Math.min(10, result.pushes) : 0);
      } else if (result.game === "slots") {
        increment("slotSpins");
        if (result.outcome === "jackpot") increment("slotWins");
      } else if (result.game === "coinFlip") {
        increment("coinFlips");
        if (result.outcome === "win") increment("coinFlipWins");
      } else {
        return current;
      }

      return { ...current, stats: nextStats };
    });
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
    try {
      await leavePrankPresence(supabaseClient);
    } catch {
      // Presence expires automatically after the server's 90-second timeout.
    }
    setPrankQueue([]);
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
  }

  function retryCloudSync() {
    setCloudRetryNonce((value) => value + 1);
  }

  function dismissPrank(eventId) {
    setPrankQueue((current) => {
      if (!current.length) return current;
      if (!eventId || current[0].eventId === eventId) return current.slice(1);
      return current.filter((event) => event.eventId !== eventId);
    });
  }

  function gameCard(title, description, tab) {
    return (
      <button className="game-card" type="button" key={title} onClick={() => setActive(tab)}>
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
  const isAdminForCurrentUser =
    Boolean(session?.user?.id) &&
    adminVerifiedForUser === session.user.id &&
    (adminRole === "owner" || adminRole === "admin");
  const visibleTabs = tabs;
  const primaryActiveTab = ["Number Hunt", "Rock Paper Scissors", "Trivia", "Memory Match", "Pattern Recall", "Coin Flip", "Slot Machine"].includes(active)
    ? "Arcade games"
    : active;

  React.useEffect(() => {
    if (active === "Admin" && !isAdminForCurrentUser) {
      setActive("Home");
    }
  }, [active, isAdminForCurrentUser]);

  if (!authReady) {
    return (
      <main className="app-shell entry-shell">
        <header className="topbar">
          <div className="brand">MINI ARCADE</div>
          <span className="entry-status">Account access</span>
        </header>
        <div className="announcement">Restoring your saved sign-in session…</div>
        <section className="content entry-content">
          <div className="entry-loading" role="status">Please wait while your account is checked.</div>
        </section>
      </main>
    );
  }

  if (!session?.user && !guestMode) {
    return (
      <main className="app-shell entry-shell">
        <header className="topbar">
          <div className="brand">MINI ARCADE</div>
          <span className="entry-status">Account access</span>
        </header>
        <div className="announcement">Welcome to Mini Arcade. Sign in to sync your progress, or continue as a guest.</div>
        <section className="content entry-content">
          <AuthPanel
            client={supabaseClient}
            config={supabaseConfig}
            session={null}
            cloudStatus={cloudStatus}
            onSaveConfig={saveConnection}
            onSignOut={signOut}
            onRetryCloud={retryCloudSync}
            onGuestMode={() => setGuestMode(true)}
          />
        </section>
        <footer><span>Guest progress stays on this device and does not appear on the shared leaderboard.</span></footer>
      </main>
    );
  }

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
        <button
          className="account-area account-area-button"
          type="button"
          onClick={() => setActive("Account")}
          aria-label="Open account settings"
        >
          <span className="balance">{formatPoints(balance)} pts</span>
          <span className="profile-name">{session?.user ? "Signed in as " + signedInUsername : "Guest mode"}</span>
        </button>
      </header>

      <div className="announcement">
        Welcome to Mini Arcade! Have fun and enjoy the games.
      </div>

      <nav className="tabs" aria-label="Main navigation">
        {visibleTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={primaryActiveTab === tab ? "tab active" : "tab"}
            onClick={() => setActive(tab)}
            aria-current={primaryActiveTab === tab ? "page" : undefined}
          >
            {tab}
          </button>
        ))}
      </nav>

      <section className="content">

        {active === "Home" && (
          <section className="home-page" aria-labelledby="home-title">
            <h1 id="home-title">Welcome to the arcade, {session?.user ? signedInUsername : profile.nickname}!</h1>
            <p className="home-intro">Welcome to Mini Arcade! Have fun and enjoy the games.</p>

            <div className="home-summary-grid">
              <article className="classic-panel daily-login-panel">
                <h2>DAILY LOGIN</h2>
                <p>Collect {formatPoints(profile.dailyReward)} points once per calendar day.</p>
                <p>Your daily reward is handled automatically when you open the game.</p>
              </article>
              <article className="classic-panel arcade-summary-panel">
                <h2>YOUR ARCADE</h2>
                <p>Your personal {session?.user ? "cloud-synced" : "guest"} progress.</p>
                <ul className="arcade-summary-list">
                  <li>Blackjack wins: {formatPoints(stats.blackjackWins || 0)}</li>
                  <li>Mini-game wins: {formatPoints(stats.numberHuntWins + stats.rpsWins + stats.memoryWins + stats.patternWins)}</li>
                  <li>Slot machine jackpots: {formatPoints(stats.slotWins)}</li>
                  <li>Trivia answers correct: {formatPoints(stats.triviaCorrect)}</li>
                  <li>Daily logins: {formatPoints(stats.dailyLogins)}</li>
                </ul>
              </article>
            </div>

            <section className="classic-panel quick-launch-panel" aria-labelledby="quick-launch-title">
              <h2 id="quick-launch-title">QUICK LAUNCH</h2>
              <p>Pick a game and jump right in.</p>
              <div className="quick-launch-actions">
                <button className="quick-launch-button quick-launch-primary" type="button" onClick={() => setActive("Blackjack")}>Blackjack</button>
                <button className="quick-launch-button" type="button" onClick={() => setActive("Slot Machine")}>Slot Machine</button>
                <button className="quick-launch-button" type="button" onClick={() => setActive("Arcade games")}>Mini-games</button>
                <button className="quick-launch-button" type="button" onClick={() => setActive("Profile & stats")}>Profile &amp; stats</button>
                <button className="quick-launch-button" type="button" onClick={() => setActive("Leaderboard")}>Leaderboard</button>
              </div>
            </section>

            <section className="classic-panel trophy-shelf-panel" aria-labelledby="trophy-shelf-title">
              <h2 id="trophy-shelf-title">TROPHY SHELF</h2>
              <p>A few milestones to chase.</p>
              <ul className="trophy-list">
                <li>First victory</li>
                <li>Arcade regular</li>
                <li>Quiz whiz</li>
                <li>Mini-game explorer</li>
                <li>Point collector</li>
              </ul>
            </section>
          </section>
        )}

        {active === "Blackjack" && (
          isCloudLoading
            ? <div className="cloud-loading-screen" role="status">{cloudStatus}</div>
            : <BlackjackGame balance={balance} freePlay={Boolean(session?.user?.id && freePlayCheckedForUser === session.user.id && freePlayAccess)} cosmetics={profile.blackjackCosmetics} onCosmeticsChange={(blackjackCosmetics) => setProfile((current) => ({ ...current, blackjackCosmetics }))} onSpendPoints={spendPoints} onEarnPoints={awardPoints} onGameResult={recordGameResult} />
        )}

        {active === "Arcade games" && (
          <>
            <h1>Arcade Games</h1>
            <p className="muted">Choose a mini-game to play.</p>
            <div className="game-grid arcade-game-grid">
              {gameCard("Number Hunt", "Find the secret number in five guesses", "Number Hunt")}
              {gameCard("Rock Paper Scissors", "Play against the computer", "Rock Paper Scissors")}
              {gameCard("Quick Trivia", "One quiz a day: five random questions, with an optional bet", "Trivia")}
              {gameCard("Memory Match", "Find all matching pairs", "Memory Match")}
              {gameCard("Pattern Recall", "Remember and repeat the sequence", "Pattern Recall")}
              {gameCard("Coin Flip", "Call Heads or Tails", "Coin Flip")}
              {gameCard("Slot Machine", "Spin the classic three reels for free", "Slot Machine")}
            </div>
          </>
        )}

        {/* Keep games mounted when switching tabs, so active rounds are preserved. */}
        <div hidden={active !== "Number Hunt"}>
          {active === "Number Hunt" && <button className="classic-back-button" type="button" onClick={() => setActive("Arcade games")}>Back to Arcade Games</button>}
          {isCloudLoading ? (
            <div className="cloud-loading-screen" role="status">{cloudStatus}</div>
          ) : (
            <NumberHuntGame balance={balance} onSpendPoints={spendPoints} onEarnPoints={awardPoints} onGameResult={recordGameResult} rewardAmount={profile.numberReward} />
          )}
        </div>
        <div hidden={active !== "Rock Paper Scissors"}>
          {active === "Rock Paper Scissors" && <button className="classic-back-button" type="button" onClick={() => setActive("Arcade games")}>Back to Arcade Games</button>}
          {isCloudLoading ? (
            <div className="cloud-loading-screen" role="status">{cloudStatus}</div>
          ) : (
            <RockPaperScissorsGame balance={balance} onSpendPoints={spendPoints} onEarnPoints={awardPoints} onGameResult={recordGameResult} rewardAmount={profile.rpsReward} />
          )}
        </div>
        <div hidden={active !== "Trivia"}>
          {active === "Trivia" && <button className="classic-back-button" type="button" onClick={() => setActive("Arcade games")}>Back to Arcade Games</button>}
          {isCloudLoading ? (
            <div className="cloud-loading-screen" role="status">{cloudStatus}</div>
          ) : (
            <TriviaGame balance={balance} onSpendPoints={spendPoints} onEarnPoints={awardPoints} onGameResult={recordGameResult} rewardPerCorrect={profile.triviaReward} client={supabaseClient} signedIn={Boolean(session?.user?.id) && !moderationStatus.suspended} visible={active === "Trivia"} />
          )}
        </div>
        <div hidden={active !== "Memory Match"}>
          {active === "Memory Match" && <button className="classic-back-button" type="button" onClick={() => setActive("Arcade games")}>Back to Arcade Games</button>}
          {isCloudLoading ? <div className="cloud-loading-screen" role="status">{cloudStatus}</div> : <MemoryMatchGame balance={balance} onSpendPoints={spendPoints} onEarnPoints={awardPoints} onGameResult={recordGameResult} />}
        </div>
        <div hidden={active !== "Pattern Recall"}>
          {active === "Pattern Recall" && <button className="classic-back-button" type="button" onClick={() => setActive("Arcade games")}>Back to Arcade Games</button>}
          {isCloudLoading ? <div className="cloud-loading-screen" role="status">{cloudStatus}</div> : <PatternRecallGame balance={balance} onSpendPoints={spendPoints} onEarnPoints={awardPoints} onGameResult={recordGameResult} />}
        </div>
        <div hidden={active !== "Coin Flip"}>
          {active === "Coin Flip" && <button className="classic-back-button" type="button" onClick={() => setActive("Arcade games")}>Back to Arcade Games</button>}
          {isCloudLoading ? <div className="cloud-loading-screen" role="status">{cloudStatus}</div> : <CoinFlipGame balance={balance} onSpendPoints={spendPoints} onEarnPoints={awardPoints} onGameResult={recordGameResult} />}
        </div>
        <div hidden={active !== "Slot Machine"}>
          {active === "Slot Machine" && <button className="classic-back-button" type="button" onClick={() => setActive("Arcade games")}>Back to Arcade Games</button>}
          {isCloudLoading ? <div className="cloud-loading-screen" role="status">{cloudStatus}</div> : <SlotMachineGame balance={balance} freePlay={Boolean(session?.user?.id && freePlayCheckedForUser === session.user.id && freePlayAccess)} onSpendPoints={spendPoints} onEarnPoints={awardPoints} onGameResult={recordGameResult} />}
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
              {statCard("MEMORY MATCH", formatPoints(stats.memoryWins), `Wins across ${stats.memoryGames} rounds`)}
              {statCard("PATTERN RECALL", formatPoints(stats.patternWins), `Wins across ${stats.patternGames} rounds`)}
              {statCard("BLACKJACK", formatPoints(stats.blackjackWins), `${stats.blackjackGames} rounds · ${stats.blackjackLosses} losses`)}
              {statCard("SLOT MACHINE", formatPoints(stats.slotWins), `${stats.slotSpins} free spins`)}
              {statCard("COIN FLIP", formatPoints(stats.coinFlipWins), `${stats.coinFlips} flips`)}
              {statCard("DAILY REWARDS", formatPoints(stats.dailyLogins), "Days claimed on this device")}
              {statCard("DAILY BONUS", `${formatPoints(profile.dailyReward)} pts`, "Reward amount from your save")}
              {statCard("GAME REWARDS", `${profile.numberReward} / ${profile.rpsReward} / ${profile.triviaReward}`, "Number Hunt / RPS / Trivia")}
            </div>

            <div className="profile-save-status" role="status" aria-live="polite">
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
                          <th scope="col">Blackjack wins</th>
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
                            <td className="leaderboard-number">{formatPoints(row.blackjackWins)}</td>
                            <td className="leaderboard-number">{formatPoints(row.triviaCorrect)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="leaderboard-disclaimer">
                  Leaderboard score fields are protected from direct browser updates. Personal progress is saved to your account, but scores are not accepted as competitive rankings until server-verified scoring is added.
                </p>
              </>
            )}
          </section>
        )}

        {active === "Admin" && isAdminForCurrentUser && (
          <AdminPanel client={supabaseClient} role={adminRole} />
        )}

        <div hidden={active !== "Settings"}>
          <AudioSettingsPanel />
        </div>

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
        <span>Daily login reward: +{formatPoints(profile.dailyReward)} points. Welcome back!</span>
        <div className="footer-actions">
          <button type="button" onClick={() => setActive("Settings")}>Settings</button>
          <button type="button" onClick={() => setActive("Account")}>Account</button>
          {isAdminForCurrentUser && (
            <button type="button" className="owner-console-button" onClick={() => setActive("Admin")}>Owner console</button>
          )}
        </div>
      </footer>
      {prankQueue.length > 0 && (
        <PrankOverlay event={prankQueue[0]} onDismiss={dismissPrank} />
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
