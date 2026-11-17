import React from "react";
import {
  createDeck,
  getControls,
  handValue,
  hit,
  split,
  stand,
  doubleDown,
  startRound,
} from "../games/blackjack/engine.js";

const points = (value) => new Intl.NumberFormat("en-US").format(value);

function PlayingCard({ card, hidden = false }) {
  if (hidden) {
    return (
      <div className="playing-card card-back" aria-label="Face-down dealer card">
        <span aria-hidden="true">✦</span>
      </div>
    );
  }

  if (!card) return null;
  const [rank, suit] = card;
  const red = suit === "♥" || suit === "♦";

  return (
    <div
      className={`playing-card ${red ? "card-red" : "card-black"}`}
      aria-label={`${rank} of ${suit}`}
    >
      <span className="card-rank">{rank}</span>
      <span className="card-suit" aria-hidden="true">{suit}</span>
    </div>
  );
}

function HandCards({ cards, hideDealerCard = false }) {
  return (
    <div className="blackjack-cards">
      {cards.map((card, index) => (
        <PlayingCard
          key={`${card[0]}-${card[1]}-${index}`}
          card={card}
          hidden={hideDealerCard && index === 1}
        />
      ))}
    </div>
  );
}

export default function BlackjackGame({ balance, onBalanceChange }) {
  const [round, setRound] = React.useState(null);
  const [betInput, setBetInput] = React.useState("25");
  const [message, setMessage] = React.useState(
    "Place a bet and choose Deal when you are ready."
  );

  const controls = getControls(round);

  function acceptRound(nextRound, fallbackMessage) {
    setRound(nextRound);
    onBalanceChange(nextRound.balance);

    if (nextRound.result) {
      setMessage(nextRound.result.message);
    } else if (
      round &&
      nextRound.roundActive &&
      nextRound.activeHandIndex !== round.activeHandIndex
    ) {
      setMessage(`Now playing Hand ${nextRound.activeHandIndex + 1}.`);
    } else {
      setMessage(fallbackMessage);
    }
  }

  function deal() {
    try {
      const bet = Number(betInput);
      const nextRound = startRound({
        balance,
        bet,
        deck: createDeck(),
      });
      setRound(nextRound);
      onBalanceChange(nextRound.balance);
      setMessage(
        nextRound.result
          ? nextRound.result.message
          : "Your turn — choose Hit, Stand, Split, or Double Down."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start the round.");
    }
  }

  function perform(action, fallbackMessage) {
    if (!round) return;
    try {
      const nextRound = action(round);
      acceptRound(nextRound, fallbackMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That move could not be completed.");
    }
  }

  function clearTable() {
    if (round?.roundActive) return;
    setRound(null);
    setMessage("Table cleared. Place a bet and deal when you are ready.");
  }

  const dealerTotal =
    round && !round.roundActive ? handValue(round.dealer) : null;

  return (
    <section className="blackjack-page" aria-labelledby="blackjack-title">
      <div className="blackjack-heading">
        <div>
          <span className="eyebrow">CARD TABLE</span>
          <h1 id="blackjack-title">Blackjack</h1>
          <p className="muted">Get closer to 21 than the dealer without going over.</p>
        </div>
        <div className="blackjack-balance" aria-live="polite">
          <span>YOUR BALANCE</span>
          <strong>{points(balance)} pts</strong>
        </div>
      </div>

      <div className="blackjack-table">
        <div className="table-brand">MINI ARCADE <span>♠ ♦ ♥ ♣</span></div>

        <section className="table-hand dealer-hand" aria-label="Dealer hand">
          <div className="hand-heading">
            <h2>Dealer</h2>
            <span>{dealerTotal === null ? "Second card hidden" : `Total: ${dealerTotal}`}</span>
          </div>
          {round ? (
            <HandCards cards={round.dealer} hideDealerCard={round.roundActive} />
          ) : (
            <div className="empty-hand">The dealer's cards will appear here.</div>
          )}
        </section>

        <div className="table-divider" aria-hidden="true"><span>✦</span></div>

        <section className="table-hand player-hand" aria-label="Player hands">
          <div className="hand-heading">
            <h2>You</h2>
            <span>{round?.roundActive ? "Your turn" : round ? "Round complete" : "Waiting to deal"}</span>
          </div>

          {round ? (
            <div className="player-hands">
              {round.playerHands.map((hand, index) => (
                <article
                  key={index}
                  className={[
                    "player-hand-panel",
                    round.roundActive && round.activeHandIndex === index ? "is-active-hand" : "",
                  ].join(" ")}
                >
                  <div className="hand-heading hand-subheading">
                    <strong>Hand {index + 1}</strong>
                    <span>
                      Total: {handValue(hand)} · Bet: {points(round.handBets[index])} pts ·{" "}
                      {round.handStatuses[index].toUpperCase()}
                    </span>
                  </div>
                  <HandCards cards={hand} />
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-hand">Your dealt cards will appear here.</div>
          )}
        </section>

        <div className="blackjack-message" role="status" aria-live="polite">
          {message}
        </div>
      </div>

      <div className="blackjack-controls">
        <label className="bet-control">
          <span>Bet amount</span>
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={betInput}
            onChange={(event) => setBetInput(event.target.value)}
            disabled={Boolean(round?.roundActive)}
            aria-label="Bet amount in points"
          />
        </label>
        <div className="blackjack-action-grid">
          <button className="action-button action-primary" onClick={deal} disabled={!controls.canDeal || balance < 1}>
            Deal
          </button>
          <button className="action-button" onClick={() => perform(hit, "You drew a card. Hit again or stand.")} disabled={!controls.canHit}>
            Hit
          </button>
          <button className="action-button" onClick={() => perform(stand, "You stood.")} disabled={!controls.canStand}>
            Stand
          </button>
          <button className="action-button" onClick={() => perform(split, "Your hand was split. Play the highlighted hand.")} disabled={!controls.canSplit}>
            Split
          </button>
          <button className="action-button" onClick={() => perform(doubleDown, "Double Down — one final card was dealt.")} disabled={!controls.canDouble}>
            Double Down
          </button>
          <button className="action-button action-quiet" onClick={clearTable} disabled={!controls.canClear}>
            Clear table
          </button>
        </div>
      </div>

      <details className="blackjack-rules">
        <summary>How to play · Rules and payouts</summary>
        <div className="rules-content">
          <p><strong>Goal:</strong> Finish closer to 21 than the dealer without going over. Number cards count as shown, face cards count as 10, and Aces count as 1 or 11.</p>
          <p><strong>Hit / Stand:</strong> Hit draws one card. Stand keeps your current total. A hand that reaches 21 stands automatically; going over 21 is a bust.</p>
          <p><strong>Split:</strong> Matching point values can be split once per round by matching the original bet. Each hand is then played separately. Split Aces receive one card each and stand. A 21 after splitting is a regular win, not a natural Blackjack.</p>
          <p><strong>Double Down:</strong> On a two-card hand, add a second bet equal to that hand's current bet, receive one final card, and stand automatically. This also works on a split hand.</p>
          <p><strong>Dealer and payouts:</strong> The dealer draws until reaching 17 or more. Regular wins return 2× the hand bet; ties return the bet; an original, unsplit two-card natural Blackjack returns 2.5× the bet. Busts and losses forfeit that hand's bet.</p>
          <p className="rules-note">All Mini Arcade points are fictional and have no cash value. Cards are randomly shuffled in standard mode.</p>
        </div>
      </details>
    </section>
  );
}
