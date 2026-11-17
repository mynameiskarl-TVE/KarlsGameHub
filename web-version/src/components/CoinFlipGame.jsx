import React from "react";
import { flipCoin } from "../games/coin-flip/engine.js";

export default function CoinFlipGame({ balance, onEarnPoints, onGameResult }) {
  const [guess, setGuess] = React.useState("Heads");
  const [last, setLast] = React.useState(null);
  const [flipping, setFlipping] = React.useState(false);
  const [played, setPlayed] = React.useState(0);
  const timer = React.useRef(null);

  React.useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  function play() {
    if (flipping) return;
    setFlipping(true);
    setLast(null);
    timer.current = window.setTimeout(() => {
      const result = flipCoin(guess);
      setLast(result);
      setPlayed((value) => value + 1);
      setFlipping(false);
      timer.current = null;
      if (result.reward) onEarnPoints(result.reward);
      onGameResult?.({ game: "coinFlip", outcome: result.won ? "win" : "loss" });
    }, 650);
  }

  return (
    <section className="coin-flip-page" aria-labelledby="coin-flip-title">
      <div className="skill-game-heading">
        <div>
          <span className="eyebrow">ARCADE MINI-GAME</span>
          <h1 id="coin-flip-title">Coin Flip</h1>
          <p className="muted">Call Heads or Tails, then flip. A correct guess earns 10 points.</p>
        </div>
        <div className="number-hunt-balance">
          <span>YOUR POINTS</span>
          <strong>{new Intl.NumberFormat("en-US").format(balance)} pts</strong>
        </div>
      </div>

      <div className="coin-flip-card">
        <div className={"coin-art " + (flipping ? "is-flipping" : "")}>
          <span>{flipping ? "?" : last?.result || "?"}</span>
        </div>
        <div className="coin-choice-row">
          {["Heads", "Tails"].map((side) => (
            <button
              type="button"
              key={side}
              className={guess === side ? "coin-choice selected" : "coin-choice"}
              onClick={() => setGuess(side)}
              disabled={flipping}
            >
              {side}
            </button>
          ))}
        </div>
        <button className="arcade-primary-button" type="button" onClick={play} disabled={flipping}>
          {flipping ? "Flipping…" : "Flip coin"}
        </button>
        <p className="skill-game-status" role="status" aria-live="polite">
          {flipping ? "The coin is in the air…" : last ? last.won ? "Correct call! +10 points." : "It landed on " + last.result + ". No points lost." : "Choose a side and flip."}
        </p>
        <div className="skill-game-meta">
          <span>Flips: <strong>{played}</strong></span>
          <span>Reward: <strong>10 pts</strong></span>
          <span>No entry cost</span>
        </div>
      </div>
    </section>
  );
}
