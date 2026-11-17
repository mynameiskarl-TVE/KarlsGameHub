import React from "react";
import { spinSlots } from "../games/slots/engine.js";

const formatPoints = (value) => new Intl.NumberFormat("en-US").format(value);

export default function SlotMachineGame({ balance, freePlay = false, onSpendPoints, onEarnPoints, onGameResult }) {
  const [spinning, setSpinning] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [spins, setSpins] = React.useState(0);
  const [bet, setBet] = React.useState("10");
  const timer = React.useRef(null);

  React.useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  function handleSpin() {
    if (spinning) return;
    const stake = Number(bet);
    if (!freePlay && (!Number.isSafeInteger(stake) || stake < 1 || stake > balance)) {
      setResult({ error: "Choose a whole-number stake within your available coin balance." });
      return;
    }
    if (!freePlay && !onSpendPoints?.(stake)) {
      setResult({ error: "You do not have enough coins for that stake." });
      return;
    }
    setSpinning(true);
    setResult(null);
    timer.current = window.setTimeout(() => {
      const next = spinSlots();
      const payout = freePlay ? 0 : Math.floor(stake * next.payoutMultiplier);
      setResult({ ...next, payout, stake: freePlay ? 0 : stake });
      setSpins((value) => value + 1);
      setSpinning(false);
      timer.current = null;
      if (payout > 0) onEarnPoints(payout);
      onGameResult?.({ game: "slots", outcome: next.outcome });
    }, 850);
  }

  const numericBet = Number(bet);
  const canAffordBet = freePlay || (Number.isSafeInteger(numericBet) && numericBet >= 1 && numericBet <= balance);

  return <section className="slots-page" aria-labelledby="slots-title">
    <div className="skill-game-heading">
      <div><span className="eyebrow">ARCADE REEL GAME</span><h1 id="slots-title">Slot Machine</h1><p className="muted">Choose your stake, spin the reels and see what lines up.</p></div>
      <div className="number-hunt-balance"><span>YOUR COINS</span><strong>{formatPoints(balance)} pts</strong></div>
    </div>
    <div className="slots-cabinet">
      <div className="slots-marquee">MINI ARCADE</div>
      {!freePlay && <div className="arcade-bet-controls">
        <label htmlFor="slots-bet">Stake per spin</label>
        <input id="slots-bet" type="number" min="1" max={balance} step="1" value={bet} onChange={(event) => setBet(event.target.value)} />
        <span>Available: {formatPoints(balance)} coins</span>
      </div>}
      {freePlay && <p className="tester-freeplay-note">TESTER MODE · No coins are spent or awarded</p>}
      <div className="slot-reels" aria-live="polite" aria-label={spinning ? "Reels spinning" : "Slot result"}>
        {(result?.reels || (spinning ? ["?", "?", "?"] : ["7", "BAR", "♦"])).map((symbol, index) => <div className={"slot-reel " + (spinning ? "is-spinning" : "")} key={index}>{symbol}</div>)}
      </div>
      <div className="slots-paytable">
        <div><strong>777</strong><span>10× stake</span></div><div><strong>BAR BAR BAR</strong><span>5× stake</span></div>
        <div><strong>Three matching suits</strong><span>1.25–2× stake</span></div><div><strong>Any pair</strong><span>0.5× stake</span></div>
      </div>
      <p className="slot-result-message" role="status" aria-live="polite">
        {spinning ? "Spinning…" : result?.error || (result ? (result.payout ? result.outcome === "jackpot" ? "JACKPOT — returned " + formatPoints(result.payout) + " coins!" : "Matching symbols — returned " + formatPoints(result.payout) + " coins!" : "No match — your " + formatPoints(result.stake) + " coin stake was lost.") : "Ready when you are. Choose a stake to spin.")}
      </p>
      <button className="arcade-primary-button slot-spin-button" type="button" onClick={handleSpin} disabled={spinning || !canAffordBet}>{spinning ? "Spinning…" : freePlay ? "Spin (tester free play)" : "Spin"}</button>
      <div className="blackjack-round-note">Spins: {spins} · {freePlay ? "Tester free play" : "Stake-based play"}</div>
    </div>
  </section>;
}
