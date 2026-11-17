import React from "react";

function makeSequence() {
  const sequence = [];
  while (sequence.length < 4) {
    const next = Math.floor(Math.random() * 9) + 1;
    if (!sequence.includes(next)) sequence.push(next);
  }
  return sequence;
}

export default function PatternRecallGame({ balance, onSpendPoints, onEarnPoints, onGameResult }) {
  const [sequence, setSequence] = React.useState([]);
  const [phase, setPhase] = React.useState("ready");
  const [progress, setProgress] = React.useState(0);
  const [message, setMessage] = React.useState("Memorize a four-number pattern, then repeat it.");
  const startTimer = React.useRef(null);

  React.useEffect(() => () => {
    if (startTimer.current) window.clearTimeout(startTimer.current);
  }, []);

  function startRound() {
    if (balance < 5 || !onSpendPoints?.(5)) { setMessage("You need 5 points to start a pattern challenge."); return; }
    if (startTimer.current) window.clearTimeout(startTimer.current);
    const next = makeSequence();
    setSequence(next);
    setProgress(0);
    setPhase("showing");
    setMessage("Remember this sequence.");
    startTimer.current = window.setTimeout(() => {
      setPhase("input");
      setMessage("Repeat the sequence in the same order.");
      startTimer.current = null;
    }, 2200);
  }

  function chooseNumber(number) {
    if (phase !== "input") return;

    if (sequence[progress] !== number) {
      setPhase("failed");
      setMessage("That sequence did not match. Start another round to try again.");
      onGameResult?.({ game: "pattern", outcome: "loss" });
      return;
    }

    const nextProgress = progress + 1;
    setProgress(nextProgress);
    if (nextProgress === sequence.length) {
      setPhase("complete");
      setMessage("Perfect recall. You earned 20 points.");
      onEarnPoints(20);
      onGameResult?.({ game: "pattern", outcome: "win" });
    }
  }

  const visibleSequence = phase === "showing" ? sequence.join("  ·  ") : "•  •  •  •";

  return (
    <section className="pattern-page" aria-labelledby="pattern-title">
      <div className="skill-game-heading">
        <div>
          <span className="eyebrow">ARCADE MINI-GAME</span>
          <h1 id="pattern-title">Pattern Recall</h1>
          <p className="muted">Remember the four-number pattern and repeat it in order.</p>
        </div>
        <div className="number-hunt-balance">
          <span>YOUR BALANCE</span>
          <strong>{new Intl.NumberFormat("en-US").format(balance)} pts</strong>
        </div>
      </div>

      <div className="skill-game-card">
        <h2>{phase === "complete" ? "Challenge complete" : phase === "failed" ? "Try again" : "Sequence challenge"}</h2>
        <p>Complete the sequence to earn 20 points. A failed challenge loses its 5-point entry fee.</p>
        <div className="pattern-display" aria-live="polite" aria-label={phase === "showing" ? "Memorize the displayed sequence" : "Sequence hidden"}>
          {visibleSequence}
        </div>
        <div className="pattern-pad">
          {Array.from({ length: 9 }, (_, index) => index + 1).map((number) => (
            <button key={number} type="button" onClick={() => chooseNumber(number)} disabled={phase !== "input"}>
              {number}
            </button>
          ))}
        </div>
        <div className="skill-game-status" role="status" aria-live="polite">{message}</div>
        <div className="skill-game-meta">
          <span>Correct steps: <strong>{progress} / 4</strong></span>
          <span>Reward: <strong>20 pts</strong></span>
        </div>
        {(phase === "ready" || phase === "complete" || phase === "failed") && (
          <button className="number-hunt-button" type="button" onClick={startRound}>
            {phase === "ready" ? "Start challenge" : "Play again"}
          </button>
        )}
      </div>
    </section>
  );
}
