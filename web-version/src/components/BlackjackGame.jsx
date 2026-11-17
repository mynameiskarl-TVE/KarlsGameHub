import React from "react";
import {
  startBlackjackRound,
  handValue,
  cardPoints,
  hitBlackjack,
  standBlackjack,
  doubleBlackjack,
  splitBlackjack,
} from "../games/blackjack/engine.js";

const suitColor = (suit) => suit === "♥" || suit === "♦" ? "red" : "black";

function PlayingCard({ card, hidden = false }) {
  if (hidden) return <div className="playing-card playing-card-hidden" aria-label="Hidden dealer card"><span>MAH</span></div>;
  return (
    <div className={"playing-card " + (suitColor(card.suit) === "red" ? "card-red" : "card-black")}>
      <span className="card-corner">{card.rank}<br />{card.suit}</span>
      <strong>{card.suit}</strong>
      <span className="card-corner card-corner-bottom">{card.rank}<br />{card.suit}</span>
    </div>
  );
}

export default function BlackjackGame({ balance, onEarnPoints, onGameResult }) {
  const [round, setRound] = React.useState(null);
  const [message, setMessage] = React.useState("Start a free round. No points are required to play.");
  const [roundNumber, setRoundNumber] = React.useState(0);

  function publishFinished(next) {
    if (next.phase !== "complete" || !next.result) return;
    if (next.reward > 0) onEarnPoints(next.reward);
    onGameResult?.({
      game: "blackjack",
      wins: next.result.wins,
      losses: next.result.losses,
      pushes: next.result.pushes,
    });
    const summary = next.outcomes.map((item, index) => "Hand " + (index + 1) + ": " + item.outcome).join(" · ");
    setMessage(summary + (next.reward ? " — +" + next.reward + " points." : ". No points lost."));
  }

  function startRound() {
    const next = startBlackjackRound();
    setRound(next);
    setRoundNumber((value) => value + 1);
    if (next.phase === "complete") {
      setMessage("Opening deal: " + next.outcomes[0].outcome + ". +" + next.reward + " points.");
      publishFinished(next);
    } else {
      setMessage("Your turn. Hit, stand, double, or split a matching pair.");
    }
  }

  function perform(action) {
    if (!round || round.phase !== "playing") return;
    try {
      const next = action(round);
      setRound(next);
      if (next.phase === "complete") publishFinished(next);
      else if (next.activeHand !== round.activeHand) setMessage("Hand " + (next.activeHand + 1) + " is now active.");
      else setMessage("Your turn. Choose your next move.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That move is unavailable.");
    }
  }

  const activeHand = round?.hands?.[round.activeHand] || [];
  const canSplit = Boolean(
    round?.phase === "playing" &&
    !round.splitUsed &&
    round.hands.length === 1 &&
    activeHand.length === 2 &&
    cardPoints(activeHand[0]) === cardPoints(activeHand[1])
  );
  const canDouble = Boolean(round?.phase === "playing" && activeHand.length === 2);

  return (
    <section className="blackjack-page" aria-labelledby="blackjack-title">
      <div className="skill-game-heading">
        <div>
          <span className="eyebrow">CLASSIC CARD GAME</span>
          <h1 id="blackjack-title">Blackjack</h1>
          <p className="muted">Try to finish closer to 21 than the dealer without going over.</p>
        </div>
        <div className="number-hunt-balance">
          <span>YOUR POINTS</span>
          <strong>{new Intl.NumberFormat("en-US").format(balance)} pts</strong>
        </div>
      </div>

      <div className="blackjack-table">
        <div className="blackjack-table-title">MINI ARCADE CARD ROOM</div>
        <section className="blackjack-hand-area" aria-label="Dealer hand">
          <div className="blackjack-hand-heading">
            <strong>DEALER</strong>
            <span>{round ? (round.phase === "playing" ? "Showing " + handValue(round.dealer.slice(0, 1)) : "Total " + handValue(round.dealer)) : "Waiting for deal"}</span>
          </div>
          <div className="playing-cards">
            {round?.dealer.map((card, index) => (
              <PlayingCard key={"dealer-" + index} card={card} hidden={round.phase === "playing" && index === 1} />
            ))}
            {!round && <span className="blackjack-empty-hand">Cards will appear here.</span>}
          </div>
        </section>

        <div className="blackjack-divider" />

        <section className="blackjack-hand-area" aria-label="Player hands">
          <div className="blackjack-hand-heading">
            <strong>YOUR HAND{round?.hands.length > 1 ? "S" : ""}</strong>
            <span>{round ? "Hand " + (round.activeHand + 1) + " of " + round.hands.length : "Your turn"}</span>
          </div>
          {round?.hands.map((hand, index) => (
            <div className={"blackjack-player-hand " + (round.phase === "playing" && round.activeHand === index ? "active" : "")} key={"player-" + index}>
              <div className="playing-cards">
                {hand.map((card, cardIndex) => <PlayingCard key={index + "-" + cardIndex} card={card} />)}
                <span className="blackjack-hand-total">{handValue(hand)}</span>
              </div>
              <small>{round.handStatus[index] === "playing" ? "IN PLAY" : round.phase === "complete" ? round.outcomes[index]?.outcome?.toUpperCase() : round.handStatus[index]?.toUpperCase()}</small>
            </div>
          ))}
          {!round && <span className="blackjack-empty-hand">Deal to start your round.</span>}
        </section>

        <div className="blackjack-message" role="status" aria-live="polite">{message}</div>

        <div className="blackjack-controls">
          {!round || round.phase === "complete" ? (
            <button className="arcade-primary-button" type="button" onClick={startRound}>{round ? "Deal again" : "Deal cards"}</button>
          ) : (
            <>
              <button className="arcade-primary-button" type="button" onClick={() => perform(hitBlackjack)}>Hit</button>
              <button className="arcade-secondary-button" type="button" onClick={() => perform(standBlackjack)}>Stand</button>
              <button className="arcade-secondary-button" type="button" onClick={() => perform(doubleBlackjack)} disabled={!canDouble}>Double</button>
              <button className="arcade-secondary-button" type="button" onClick={() => perform(splitBlackjack)} disabled={!canSplit}>Split</button>
            </>
          )}
        </div>
        <div className="blackjack-round-note">
          Round {roundNumber} · Free play · No points are spent or lost
        </div>
      </div>

      <div className="blackjack-rules">
        <div><strong>Card values</strong><p>Number cards count as shown. Face cards count as 10. Aces count as 1 or 11.</p></div>
        <div><strong>Dealer rules</strong><p>The dealer reveals the hidden card and draws until reaching 17 or higher.</p></div>
        <div><strong>Moves</strong><p>Double takes one final card. Split separates matching opening cards into two hands. Split aces receive one card each.</p></div>
        <div><strong>Points</strong><p>Win: 25 points. Natural blackjack: 35 points. Push: 5 points. A loss never removes points.</p></div>
      </div>
    </section>
  );
}
