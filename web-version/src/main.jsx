import React from "react";
import { createRoot } from "react-dom/client";
import NumberHuntGame from "./components/NumberHuntGame.jsx";
import "./style.css";

const tabs = ["Home", "Number Hunt", "Arcade games", "Profile & stats", "Leaderboard"];

function App() {
  const [active, setActive] = React.useState("Home");
  const [balance, setBalance] = React.useState(500);

  function awardPoints(amount) {
    setBalance((current) => current + amount);
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
          <span className="balance">{new Intl.NumberFormat("en-US").format(balance)} pts</span>
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
                <p>Your current arcade balance is {new Intl.NumberFormat("en-US").format(balance)} points.</p>
                <span className="pill">Fictional points</span>
              </article>
              <article className="card">
                <h2>ARCADE PROGRESS</h2>
                <p>Number Hunt is now playable. More games, profiles and cloud saves are being migrated.</p>
                <span className="pill">Web edition</span>
              </article>
            </div>
            <h2 className="section-heading">Jump back in</h2>
            <div className="game-grid">
              <button className="game-card" onClick={() => setActive("Number Hunt")}>
                <span className="game-icon">🔎</span>
                <strong>Number Hunt</strong>
                <small>Find the secret number</small>
              </button>
              <button className="game-card" onClick={() => setActive("Arcade games")}>
                <span className="game-icon">🎮</span>
                <strong>Arcade games</strong>
                <small>More games to explore</small>
              </button>
              <button className="game-card" onClick={() => setActive("Leaderboard")}>
                <span className="game-icon">🏆</span>
                <strong>Leaderboard</strong>
                <small>See the standings</small>
              </button>
            </div>
            <p className="session-note">Points are temporary in this early web version and will reset when the page reloads. Account saves are a later migration step.</p>
          </>
        )}

        {/* Keep the game mounted while changing tabs so an active round is preserved. */}
        <div hidden={active !== "Number Hunt"}>
          <NumberHuntGame balance={balance} onEarnPoints={awardPoints} />
        </div>

        {active !== "Home" && active !== "Number Hunt" && (
          <div className="placeholder card">
            <span className="pill">Web migration in progress</span>
            <h1>{active}</h1>
            <p>
              This section has not been migrated yet. The original Python game remains
              unchanged while the web edition is rebuilt feature by feature.
            </p>
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
