import React from "react";
import { createRoot } from "react-dom/client";
import BlackjackGame from "./components/BlackjackGame.jsx";
import "./style.css";

const tabs = ["Home", "Blackjack", "Arcade games", "Profile & stats", "Leaderboard"];

function App() {
  const [active, setActive] = React.useState("Home");
  const [balance, setBalance] = React.useState(500);

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand brand-button" onClick={() => setActive("Home")} aria-label="Go to home">
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
                <p>Blackjack is the first playable web game. More games and profile features are being migrated.</p>
                <span className="pill">Web edition</span>
              </article>
            </div>
            <h2 className="section-heading">Jump back in</h2>
            <div className="game-grid">
              <button className="game-card" onClick={() => setActive("Blackjack")}>
                <span className="game-icon">♠</span>
                <strong>Blackjack</strong>
                <small>Play cards</small>
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
          </>
        )}

        {/* Keep Blackjack mounted while another tab is open, so a live hand is not lost. */}
        <div hidden={active !== "Blackjack"}>
          <BlackjackGame balance={balance} onBalanceChange={setBalance} />
        </div>

        {active !== "Home" && active !== "Blackjack" && (
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
