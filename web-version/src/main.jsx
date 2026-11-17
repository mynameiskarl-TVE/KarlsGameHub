import React from "react";
import { createRoot } from "react-dom/client";
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
  saveProfile,
} from "./profile/storage.js";
import "./style.css";

const tabs = [
  "Home",
  "Arcade games",
  "Number Hunt",
  "Rock Paper Scissors",
  "Trivia",
  "Profile & stats",
  "Leaderboard",
];

const formatPoints = (value) => new Intl.NumberFormat("en-US").format(value);

function readInitialProfile() {
  try {
    return loadProfile(window.localStorage);
  } catch {
    return defaultProfile();
  }
}

function App() {
  const [active, setActive] = React.useState("Home");
  const [profile, setProfile] = React.useState(readInitialProfile);
  const [nicknameInput, setNicknameInput] = React.useState(profile.nickname);
  const [nicknameMessage, setNicknameMessage] = React.useState("");
  const [dailyRewardMessage, setDailyRewardMessage] = React.useState("");
  const [storageStatus, setStorageStatus] = React.useState("Checking browser storage…");

  React.useEffect(() => {
    let saved = false;
    try {
      saved = saveProfile(profile, window.localStorage);
    } catch {
      saved = false;
    }
    setStorageStatus(
      saved
        ? "Progress is saved on this device."
        : "Browser storage is unavailable. Progress may not persist after closing the page."
    );
  }, [profile]);

  React.useEffect(() => {
    setNicknameInput(profile.nickname);
  }, [profile.nickname]);

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
          <span className="profile-name">{profile.nickname}</span>
          <span className="balance">{formatPoints(balance)} pts</span>
          <button
            className="small-button"
            type="button"
            disabled
            title="Online account sign-in will be added in a later migration step."
          >
            Accounts soon
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
            <h1>Welcome back, {profile.nickname}</h1>
            <p className="muted">Your games, stats and rewards — all in one place.</p>
            <div className="cards">
              <article className="card">
                <h2>YOUR BALANCE</h2>
                <p>Your current arcade balance is {formatPoints(balance)} points.</p>
                <span className="pill">Fictional points</span>
              </article>
              <article className="card">
                <h2>DAILY REWARD</h2>
                <p>Collect 100 points once per local calendar day.</p>
                <button
                  className="profile-action-button"
                  type="button"
                  onClick={collectDailyReward}
                  disabled={dailyRewardClaimed}
                >
                  {dailyRewardClaimed ? "Collected today" : "Claim +100 points"}
                </button>
                <p className="daily-reward-message" role="status" aria-live="polite">
                  {dailyRewardMessage || (dailyRewardClaimed ? "Today's reward has already been collected." : "Your daily reward is ready.") }
                </p>
              </article>
              <article className="card">
                <h2>YOUR PROGRESS</h2>
                <p>{formatPoints(totalGamesPlayed)} completed games across the web arcade.</p>
                <span className="pill">Local profile</span>
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

        {/* Keep each game mounted while switching tabs, so active rounds are preserved. */}
        <div hidden={active !== "Number Hunt"}>
          <NumberHuntGame balance={balance} onEarnPoints={awardPoints} onGameResult={recordGameResult} />
        </div>
        <div hidden={active !== "Rock Paper Scissors"}>
          <RockPaperScissorsGame balance={balance} onEarnPoints={awardPoints} onGameResult={recordGameResult} />
        </div>
        <div hidden={active !== "Trivia"}>
          <TriviaGame balance={balance} onEarnPoints={awardPoints} onGameResult={recordGameResult} />
        </div>

        {active === "Profile & stats" && (
          <section className="profile-page" aria-labelledby="profile-title">
            <div className="profile-heading">
              <span className="eyebrow">PLAYER ACCOUNT</span>
              <h1 id="profile-title">Profile &amp; Stats</h1>
              <p className="muted">Your current web profile is stored locally in this browser.</p>
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
              <p className="profile-help">Up to {MAX_NICKNAME_LENGTH} characters. This name is only saved on this device for now.</p>
              {nicknameMessage && <p className="profile-message" role="status">{nicknameMessage}</p>}
            </form>

            <div className="profile-stats-grid">
              {statCard("POINT BALANCE", formatPoints(balance), "Fictional arcade points")}
              {statCard("TOTAL GAMES", formatPoints(totalGamesPlayed), "Completed games")}
              {statCard("NUMBER HUNT", `${stats.numberHuntWins} / ${stats.numberHuntGames}`, "Wins / completed games")}
              {statCard("RPS WINS", formatPoints(stats.rpsWins), `${stats.rpsGames} games · ${stats.rpsTies} ties`)}
              {statCard("TRIVIA", formatPoints(stats.triviaCorrect), `Correct answers across ${stats.triviaGames} quizzes`)}
              {statCard("DAILY REWARDS", formatPoints(stats.dailyLogins), "Days claimed on this device")}
            </div>

            <div className="profile-save-status" role="status" aria-live="polite">
              <span className="save-indicator" aria-hidden="true" />
              {storageStatus}
            </div>
            <p className="profile-storage-note">
              This is an offline browser save, not an online account. Clearing this browser's site data can erase it.
              Supabase sign-in and cloud synchronization are the next account-system stage.
            </p>
          </section>
        )}

        {active === "Leaderboard" && (
          <div className="placeholder card">
            <span className="pill">Coming in a later step</span>
            <h1>Leaderboard</h1>
            <p>The online leaderboard will be connected after the account system and Supabase security checks are migrated.</p>
          </div>
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
