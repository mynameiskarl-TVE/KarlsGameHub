import React from "react";
import { startBlackjackRound, handValue, cardPoints, hitBlackjack, standBlackjack, doubleBlackjack, splitBlackjack } from "../games/blackjack/engine.js";

const suitColor = (suit) => suit === "♥" || suit === "♦" ? "red" : "black";
const formatPoints = (value) => new Intl.NumberFormat("en-US").format(value);

function PlayingCard({ card, hidden = false, deckTheme = "classic" }) {
  if (hidden) return <div className={"playing-card playing-card-hidden deck-" + deckTheme} aria-label="Hidden dealer card"><span>MAH</span></div>;
  return <div className={"playing-card deck-" + deckTheme + " " + (suitColor(card.suit) === "red" ? "card-red" : "card-black")}>
    <span className="card-corner">{card.rank}<br />{card.suit}</span><strong>{card.suit}</strong>
    <span className="card-corner card-corner-bottom">{card.rank}<br />{card.suit}</span>
  </div>;
}

function calculatePayout(outcomes, stakes) {
  return outcomes.reduce((total, item, index) => {
    const stake = stakes[index] || 0;
    if (item.outcome === "natural") return total + Math.floor(stake * 2.5);
    if (item.outcome === "win") return total + stake * 2;
    if (item.outcome === "push") return total + stake;
    return total;
  }, 0);
}

export default function BlackjackGame({ balance, freePlay = false, cosmetics, onCosmeticsChange, onSpendPoints, onEarnPoints, onGameResult }) {
  const [freePlayMode, setFreePlayMode] = React.useState(false);
  const [round, setRound] = React.useState(null);
  const [message, setMessage] = React.useState("Choose a stake and deal your first hand.");
  const [roundNumber, setRoundNumber] = React.useState(0);
  const [bet, setBet] = React.useState("25");
  const [handStakes, setHandStakes] = React.useState([]);
  const [shopMessage, setShopMessage] = React.useState("");
  const currentCosmetics = cosmetics || { ownedTablecloths: ["classic-green"], ownedDecks: ["classic"], selectedTablecloth: "classic-green", selectedDeck: "classic" };
  const tablecloths = [
    { id: "classic-green", name: "Classic Felt", price: 0 },
    { id: "midnight-blue", name: "Midnight Blue", price: 650 },
    { id: "burgundy", name: "Burgundy Club", price: 900 },
    { id: "royal-purple", name: "Royal Purple", price: 1250 },
  ];
  const decks = [
    { id: "classic", name: "Ivory Classic", price: 0 },
    { id: "blue", name: "Blue Edition", price: 500 },
    { id: "red", name: "Crimson Edition", price: 500 },
    { id: "emerald", name: "Emerald Edition", price: 750 },
    { id: "violet", name: "Violet Edition", price: 1000 },
  ];
  function buyOrSelect(kind, item) {
    const ownedKey = kind === "tablecloth" ? "ownedTablecloths" : "ownedDecks";
    const selectedKey = kind === "tablecloth" ? "selectedTablecloth" : "selectedDeck";
    const owned = currentCosmetics[ownedKey] || [];
    if (owned.includes(item.id)) {
      onCosmeticsChange?.({ ...currentCosmetics, [selectedKey]: item.id });
      setShopMessage(item.name + " equipped.");
      return;
    }
    if (balance < item.price || !onSpendPoints?.(item.price)) {
      setShopMessage("You need " + formatPoints(item.price) + " points to buy " + item.name + ".");
      return;
    }
    onCosmeticsChange?.({ ...currentCosmetics, [ownedKey]: [...owned, item.id], [selectedKey]: item.id });
    setShopMessage(item.name + " purchased and equipped.");
  }

  function publishFinished(next, stakes) {
    if (next.phase !== "complete" || !next.result) return;
    const payout = freePlayMode ? 0 : calculatePayout(next.outcomes, stakes);
    if (payout > 0) onEarnPoints(payout);
    onGameResult?.({ game: "blackjack", wins: next.result.wins, losses: next.result.losses, pushes: next.result.pushes });
    const summary = next.outcomes.map((item, index) => "Hand " + (index + 1) + ": " + item.outcome).join(" · ");
    setMessage(summary + (freePlayMode ? " — tester free play: balance unchanged." : payout ? " — returned " + formatPoints(payout) + " coins." : " — stake lost."));
  }

  function startRound() {
    const stake = Number(bet);
    if (!freePlayMode && (!Number.isSafeInteger(stake) || stake < 1 || stake > balance)) {
      setMessage("Choose a whole-number stake within your available coin balance.");
      return;
    }
    if (!freePlayMode && !onSpendPoints?.(stake)) {
      setMessage("You do not have enough coins for that stake.");
      return;
    }
    const next = startBlackjackRound();
    const stakes = [freePlayMode ? 0 : stake];
    setRound(next);
    setHandStakes(stakes);
    setRoundNumber((value) => value + 1);
    if (next.phase === "complete") publishFinished(next, stakes);
    else setMessage("Your turn. Hit, stand, double, or split a matching pair.");
  }

  function perform(action) {
    if (!round || round.phase !== "playing") return;
    const index = round.activeHand;
    const extraStake = action === splitBlackjack ? (handStakes[0] || 0) : action === doubleBlackjack ? (handStakes[index] || 0) : 0;
    if (extraStake > 0 && !freePlayMode && !onSpendPoints?.(extraStake)) {
      setMessage("You need " + formatPoints(extraStake) + " more coins to make that move.");
      return;
    }
    try {
      const next = action(round);
      const stakes = handStakes.slice();
      if (action === splitBlackjack) stakes.splice(0, 1, handStakes[0], handStakes[0]);
      if (action === doubleBlackjack) stakes[index] = (stakes[index] || 0) * 2;
      setRound(next);
      setHandStakes(stakes);
      if (next.phase === "complete") publishFinished(next, stakes);
      else if (next.activeHand !== round.activeHand) setMessage("Hand " + (next.activeHand + 1) + " is now active.");
      else setMessage("Your turn. Choose your next move.");
    } catch (error) {
      if (extraStake > 0 && !freePlayMode) onEarnPoints(extraStake);
      setMessage(error instanceof Error ? error.message : "That move is unavailable.");
    }
  }

  const activeHand = round?.hands?.[round.activeHand] || [];
  const canSplit = Boolean(round?.phase === "playing" && !round.splitUsed && round.hands.length === 1 && activeHand.length === 2 && cardPoints(activeHand[0]) === cardPoints(activeHand[1]));
  const canDouble = Boolean(round?.phase === "playing" && activeHand.length === 2);
  const numericBet = Number(bet);
  const canAffordBet = freePlayMode || (Number.isSafeInteger(numericBet) && numericBet >= 1 && numericBet <= balance);

  return <section className="blackjack-page" aria-labelledby="blackjack-title">
    <div className="skill-game-heading">
      <div><span className="eyebrow">CLASSIC CARD GAME</span><h1 id="blackjack-title">Blackjack</h1><p className="muted">Try to finish closer to 21 than the dealer without going over.</p></div>
      <div className="number-hunt-balance"><span>YOUR COINS</span><strong>{formatPoints(balance)} pts</strong></div>
    </div>
    <div className={"blackjack-table tablecloth-" + currentCosmetics.selectedTablecloth}>
      <div className="blackjack-table-title">MINI ARCADE CARD ROOM</div>
      {freePlay && (!round || round.phase === "complete") && <label className="tester-freeplay-toggle"><input type="checkbox" checked={freePlayMode} onChange={(event) => setFreePlayMode(event.target.checked)} /> <span>Free play mode <small>No coins spent or awarded</small></span></label>}
      {!freePlayMode && (!round || round.phase === "complete") && <div className="arcade-bet-controls">
        <label htmlFor="blackjack-bet">Stake per hand</label>
        <input id="blackjack-bet" type="number" min="1" max={balance} step="1" value={bet} onChange={(event) => setBet(event.target.value)} />
        <span>Available: {formatPoints(balance)} coins</span>
      </div>}
      {freePlayMode && <p className="tester-freeplay-note">TESTER MODE · No coins are spent or awarded</p>}
      <section className="blackjack-hand-area" aria-label="Dealer hand">
        <div className="blackjack-hand-heading"><strong>DEALER</strong><span>{round ? (round.phase === "playing" ? "Showing " + handValue(round.dealer.slice(0, 1)) : "Total " + handValue(round.dealer)) : "Waiting for deal"}</span></div>
        <div className="playing-cards">{round?.dealer.map((card, index) => <PlayingCard key={"dealer-" + index} card={card} hidden={round.phase === "playing" && index === 1} deckTheme={currentCosmetics.selectedDeck} />)}{!round && <span className="blackjack-empty-hand">Cards will appear here.</span>}</div>
      </section>
      <div className="blackjack-divider" />
      <section className="blackjack-hand-area" aria-label="Player hands">
        <div className="blackjack-hand-heading"><strong>YOUR HAND{round?.hands.length > 1 ? "S" : ""}</strong><span>{round ? "Hand " + (round.activeHand + 1) + " of " + round.hands.length : "Your turn"}</span></div>
        {round?.hands.map((hand, index) => <div className={"blackjack-player-hand " + (round.phase === "playing" && round.activeHand === index ? "active" : "")} key={"player-" + index}>
          <div className="playing-cards">{hand.map((card, cardIndex) => <PlayingCard key={index + "-" + cardIndex} card={card} deckTheme={currentCosmetics.selectedDeck} />)}<span className="blackjack-hand-total">{handValue(hand)}</span></div>
          <small>{round.handStatus[index] === "playing" ? "IN PLAY" : round.phase === "complete" ? round.outcomes[index]?.outcome?.toUpperCase() : round.handStatus[index]?.toUpperCase()}</small>
          {!freePlayMode && <small>Stake: {formatPoints(handStakes[index] || 0)}</small>}
        </div>)}
        {!round && <span className="blackjack-empty-hand">Deal to start your round.</span>}
      </section>
      <div className="blackjack-message" role="status" aria-live="polite">{message}</div>
      <div className="blackjack-controls">
        {!round || round.phase === "complete" ? <button className="arcade-primary-button" type="button" onClick={startRound} disabled={!canAffordBet}>{round ? "Deal again" : "Deal cards"}</button> : <>
          <button className="arcade-primary-button" type="button" onClick={() => perform(hitBlackjack)}>Hit</button>
          <button className="arcade-secondary-button" type="button" onClick={() => perform(standBlackjack)}>Stand</button>
          <button className="arcade-secondary-button" type="button" onClick={() => perform(doubleBlackjack)} disabled={!canDouble || (!freePlayMode && balance < (handStakes[round.activeHand] || 0))}>Double</button>
          <button className="arcade-secondary-button" type="button" onClick={() => perform(splitBlackjack)} disabled={!canSplit || (!freePlayMode && balance < (handStakes[0] || 0))}>Split</button>
        </>}
      </div>
      <div className="blackjack-round-note">Round {roundNumber} · {freePlayMode ? "Tester free play" : "Stake-based play"}</div>
    </div>
    <section className="blackjack-customization classic-panel" aria-labelledby="blackjack-customization-title">
      <div className="blackjack-customization-heading">
        <div><span className="eyebrow">THE CARD ROOM</span><h2 id="blackjack-customization-title">Table &amp; Deck Shop</h2><p className="muted">Spend arcade points on permanent cosmetic designs. Owned designs can be switched freely.</p></div>
        <strong>{formatPoints(balance)} pts</strong>
      </div>
      <h3>TABLECLOTHS</h3>
      <div className="blackjack-cosmetic-grid">
        {tablecloths.map((item) => {
          const owned = currentCosmetics.ownedTablecloths?.includes(item.id);
          const selected = currentCosmetics.selectedTablecloth === item.id;
          return <article className={"blackjack-cosmetic-card " + (selected ? "selected" : "")} key={item.id}>
            <div className={"cosmetic-swatch tablecloth-swatch tablecloth-" + item.id} />
            <strong>{item.name}</strong><small>{owned ? (selected ? "Currently equipped" : "Owned") : formatPoints(item.price) + " pts"}</small>
            <button type="button" className="profile-action-button" disabled={!owned && balance < item.price} onClick={() => buyOrSelect("tablecloth", item)}>{selected ? "Equipped" : owned ? "Equip" : "Buy"}</button>
          </article>;
        })}
      </div>
      <h3>COLOURED CARD DECKS</h3>
      <div className="blackjack-cosmetic-grid">
        {decks.map((item) => {
          const owned = currentCosmetics.ownedDecks?.includes(item.id);
          const selected = currentCosmetics.selectedDeck === item.id;
          return <article className={"blackjack-cosmetic-card " + (selected ? "selected" : "")} key={item.id}>
            <div className={"cosmetic-swatch deck-swatch deck-" + item.id}><span>A♠</span><span>K♥</span></div>
            <strong>{item.name}</strong><small>{owned ? (selected ? "Currently equipped" : "Owned") : formatPoints(item.price) + " pts"}</small>
            <button type="button" className="profile-action-button" disabled={!owned && balance < item.price} onClick={() => buyOrSelect("deck", item)}>{selected ? "Equipped" : owned ? "Equip" : "Buy"}</button>
          </article>;
        })}
      </div>
      {shopMessage && <p className="blackjack-shop-message" role="status" aria-live="polite">{shopMessage}</p>}
    </section>
    <div className="blackjack-rules">
      <div><strong>Card values</strong><p>Number cards count as shown. Face cards count as 10. Aces count as 1 or 11.</p></div>
      <div><strong>Dealer rules</strong><p>The dealer reveals the hidden card and draws until reaching 17 or higher.</p></div>
      <div><strong>Moves</strong><p>Double and split each require an additional matching stake. Split aces receive one card each.</p></div>
      <div><strong>Coins</strong><p>Win: 1:1 net return. Natural blackjack: 3:2 net return. Push: stake returned. Loss: stake is lost.</p></div>
    </div>
  </section>;
}
