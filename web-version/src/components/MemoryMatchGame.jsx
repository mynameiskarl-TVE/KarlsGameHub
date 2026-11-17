import React from "react";

const PAIRS = ["MOON", "STAR", "LEAF", "WAVE", "CLOUD", "STONE"];

function makeDeck() {
  const cards = PAIRS.flatMap((label, pairId) => [
    { id: pairId + "-a", pairId, label },
    { id: pairId + "-b", pairId, label },
  ]);
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [cards[index], cards[swap]] = [cards[swap], cards[index]];
  }
  return cards;
}

export default function MemoryMatchGame({ balance, onSpendPoints, onEarnPoints, onGameResult }) {
  const [cards, setCards] = React.useState(makeDeck);
  const [flipped, setFlipped] = React.useState([]);
  const [matched, setMatched] = React.useState([]);
  const [moves, setMoves] = React.useState(0);
  const [locked, setLocked] = React.useState(false);
  const [complete, setComplete] = React.useState(false);
  const [message, setMessage] = React.useState("Turn over two cards and find every matching pair.");
  const hideTimer = React.useRef(null);

  React.useEffect(() => () => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
  }, []);

  function turnCard(index) {
    if (locked || complete || matched.includes(index) || flipped.includes(index)) return;

    if (flipped.length === 1 && (balance < 2 || !onSpendPoints?.(2))) { setMessage("You need 2 points to turn over another pair."); return; }
    const nextFlipped = flipped.concat(index);
    setFlipped(nextFlipped);
    if (nextFlipped.length !== 2) return;

    setMoves((value) => value + 1);
    const first = nextFlipped[0];
    const second = nextFlipped[1];

    if (cards[first].pairId === cards[second].pairId) {
      const nextMatched = matched.concat([first, second]);
      setMatched(nextMatched);
      setFlipped([]);
      setMessage("Match found.");

      if (nextMatched.length === cards.length) {
        setComplete(true);
        setMessage("All pairs found. Well done!");
        onEarnPoints(25);
        onGameResult?.({ game: "memory", outcome: "win" });
      }
    } else {
      setLocked(true);
      setMessage("Not a match. Try to remember their positions.");
      hideTimer.current = window.setTimeout(() => {
        setFlipped([]);
        setLocked(false);
        hideTimer.current = null;
      }, 750);
    }
  }

  function restart() {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    setCards(makeDeck());
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setLocked(false);
    setComplete(false);
    setMessage("Turn over two cards and find every matching pair.");
  }

  return (
    <section className="memory-page" aria-labelledby="memory-title">
      <div className="skill-game-heading">
        <div>
          <span className="eyebrow">ARCADE MINI-GAME</span>
          <h1 id="memory-title">Memory Match</h1>
          <p className="muted">Find all six matching pairs using as few moves as possible.</p>
        </div>
        <div className="number-hunt-balance">
          <span>YOUR BALANCE</span>
          <strong>{new Intl.NumberFormat("en-US").format(balance)} pts</strong>
        </div>
      </div>

      <div className="skill-game-card">
        <h2>{complete ? "Round complete" : "Find the pairs"}</h2>
        <p>Each completed round earns 25 points. Every two-card attempt costs 2 points.</p>
        <div className="memory-grid">
          {cards.map((card, index) => {
            const visible = flipped.includes(index) || matched.includes(index);
            const isMatched = matched.includes(index);
            return (
              <button
                key={card.id}
                type="button"
                className={"memory-card" + (visible ? " is-visible" : "") + (isMatched ? " is-matched" : "")}
                onClick={() => turnCard(index)}
                disabled={isMatched || locked || complete}
                aria-label={visible ? "Card " + (index + 1) + ": " + card.label : "Reveal card " + (index + 1)}
              >
                {visible ? card.label : "?"}
              </button>
            );
          })}
        </div>
        <div className="skill-game-status" role="status" aria-live="polite">{message}</div>
        <div className="skill-game-meta">
          <span>Moves: <strong>{moves}</strong></span>
          <span>Pairs: <strong>{matched.length / 2} / 6</strong></span>
          <span>Reward: <strong>25 pts</strong></span>
        </div>
        {complete && <button className="number-hunt-button" type="button" onClick={restart}>Play again</button>}
      </div>
    </section>
  );
}
