import React from "react";
import { createRoot } from "react-dom/client";
import NumberHuntGame from "./components/NumberHuntGame.jsx";
import RockPaperScissorsGame from "./components/RockPaperScissorsGame.jsx";
import TriviaGame from "./components/TriviaGame.jsx";
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

function App() {
  const [active, setActive] = React.useState("Home");
  const [balance, setBalance] = React.useState(500);

  function awardPoints(amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0) return;
    setBalance((current) => current + amount);
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
          <span className="balance">{formatPoints(balance)} pts</span>
          <button
            className="small-button"
            type="button"
            disabled
            title="Account sign-in will be added in a later migration step."
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
            <h1>Welcome to Mini Arcade</h1>
            <p className="muted">Your games, stats and rewards — all in one place.</p>
            <div className="cards">
              <article className="card">
                <h2>YOUR BALANCE</h2>
                <p>Your current arcade balance is {formatPoints(balance)} points.</p>
                <span className="pill">Fictional points</span>
              </article>
              <article className="card">
                <h2>ARCADE PROGRESS</h2>
                <p>Number Hunt, Rock Paper Scissors and Trivia are now playable in the web edition.</p>
                <span className="pill">3 games available</span>
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
          <NumberHuntGame balance={balance} onEarnPoints={awardPoints} />
        </div>
        <div hidden={active !== "Rock Paper Scissors"}>
          <RockPaperScissorsGame balance={balance} onEarnPoints={awardPoints} />
        </div>
        <div hidden={active !== "Trivia"}>
          <TriviaGame balance={balance} onEarnPoints={awardPoints} />
        </div>

        {active === "Profile & stats" && (
          <div className="placeholder card">
            <span className="pill">Coming in a later step</span>
            <h1>Profile &amp; Stats</h1>
            <p>Your current session balance is {formatPoints(balance)} points. Account-based profiles, game statistics, and save backup are part of the next migration stage.</p>
          </div>
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
