import React from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const tabs = ["Home", "Blackjack", "Arcade games", "Profile & stats", "Leaderboard"];

function App() {
  const [active, setActive] = React.useState("Home");
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">MINI ARCADE</div>
        <div className="account-area">
          <span className="balance">500 pts</span>
          <button className="small-button">Sign in</button>
        </div>
      </header>
      <div className="announcement">Welcome to Mini Arcade! Have fun and enjoy the games.</div>
      <nav className="tabs" aria-label="Main navigation">
        {tabs.map((tab) => (
          <button key={tab} className={active === tab ? "tab active" : "tab"} onClick={() => setActive(tab)}>
            {tab}
          </button>
        ))}
      </nav>
      <section className="content">
        {active === "Home" ? (
          <>
            <h1>Welcome to Mini Arcade</h1>
            <p className="muted">Your games, stats and rewards — all in one place.</p>
            <div className="cards">
              <article className="card"><h2>DAILY LOGIN</h2><p>Collect your daily reward and keep your streak going.</p><span className="pill">Daily reward</span></article>
              <article className="card"><h2>YOUR ARCADE</h2><p>Your personal balance, game wins and progress.</p><span className="pill">Player profile</span></article>
            </div>
            <h2 className="section-heading">Jump back in</h2>
            <div className="game-grid">
              <button className="game-card" onClick={() => setActive("Blackjack")}><span className="game-icon">♠</span><strong>Blackjack</strong><small>Play cards</small></button>
              <button className="game-card" onClick={() => setActive("Arcade games")}><span className="game-icon">🎮</span><strong>Arcade games</strong><small>More games to explore</small></button>
              <button className="game-card" onClick={() => setActive("Leaderboard")}><span className="game-icon">🏆</span><strong>Leaderboard</strong><small>See the standings</small></button>
            </div>
          </>
        ) : (
          <div className="placeholder card">
            <span className="pill">Web migration scaffold</span>
            <h1>{active}</h1>
            <p>This section is being rebuilt for the web version. The original Python game remains unchanged.</p>
          </div>
        )}
      </section>
      <footer><span>Mini Arcade Hub</span><span>Web edition · Early development</span></footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
