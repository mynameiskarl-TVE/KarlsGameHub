import React from "react";
import { spinSlots } from "../games/slots/engine.js";

export default function SlotMachineGame({ balance, onEarnPoints, onGameResult }) {
  const [spinning, setSpinning] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [spins, setSpins] = React.useState(0);
  const timer = React.useRef(null);

  React.useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  function handleSpin() {
    if (spinning) return;
    setSpinning(true);
    setResult(null);
    timer.current = window.setTimeout(() => {
      const next = spinSlots();
      setResult(next);
      setSpins((value) => value + 1);
      setSpinning(false);
      timer.current = null;
      if (next.reward > 0) onEarnPoints(next.reward);
      onGameResult?.({ game: "slots", outcome: next.outcome });
    }, 850);
  }

  return (
    <section className="slots-page" aria-labelledby="slots-title">
      <div className="skill-game-heading">
        <div>
          <span className="eyebrow">ARCADE REEL GAME</span>
          <h1 id="slots-title">Slot Machine</h1>
          <p className="muted">Spin the reels and see what lines up. Every spin is free.</p>
        </div>
        <div className="number-hunt-balance">
          <span>YOUR POINTS</span>
          <strong>{new Intl.NumberFormat("en-US").format(balance)} pts</strong>
        </div>
      </div>

      <div className="slots-cabinet">
        <div className="slots-marquee">MINI ARCADE</div>
        <div className="slot-reels" aria-live="polite" aria-label={spinning ? "Reels spinning" : "Slot result"}>
          {(result?.reels || (spinning ? ["?", "?", "?"] : ["7", "BAR", "♦"])).map((symbol, index) => (
            <div className={"slot-reel " + (spinning ? "is-spinning" : "")} key={index}>{symbol}</div>
          ))}
        </div>
        <div className="slots-paytable">
          <div><strong>777</strong><span>100 points</span></div>
          <div><strong>BAR BAR BAR</strong><span>40 points</span></div>
          <div><strong>Three matching suits</strong><span>9–20 points</span></div>
          <div><strong>Any pair</strong><span>5 points</span></div>
        </div>
        <p className="slot-result-message" role="status" aria-live="polite">
          {spinning ? "Spinning…" : result ? (result.reward ? result.outcome === "jackpot" ? "JACKPOT — +" + result.reward + " points!" : "Matching pair — +" + result.reward + " points!" : "No match this time. Try another free spin.") : "Ready when you are. Spins never cost points."}
        </p>
        <button className="arcade-primary-button slot-spin-button" type="button" onClick={handleSpin} disabled={spinning}>
          {spinning ? "Spinning…" : "Spin for free"}
        </button>
        <div className="blackjack-round-note">Free spins: {spins} · No points are spent or lost</div>
      </div>
    </section>
  );
}
