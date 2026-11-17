import test from "node:test";
import assert from "node:assert/strict";
import {
  cardValue,
  handValue,
  createDeck,
  startRound,
  hit,
  stand,
  split,
  doubleDown,
  getControls,
} from "./engine.js";

const card = (rank, suit = "♠") => [rank, suit];
// The engine draws from the end of the deck, so reverse the requested draw order.
const orderedDeck = (...drawOrder) => drawOrder.reverse();

test("card values and flexible Aces match the original game", () => {
  assert.equal(cardValue(card("A")), 11);
  assert.equal(cardValue(card("K")), 10);
  assert.equal(cardValue(card("10")), 10);
  assert.equal(handValue([card("A"), card("7")]), 18);
  assert.equal(handValue([card("A"), card("7"), card("9")]), 17);
  assert.equal(handValue([card("A"), card("A"), card("9")]), 21);
  assert.equal(handValue([card("A"), card("K")]), 21);
});

test("creates a standard 52-card deck with no duplicate cards", () => {
  const deck = createDeck({ shuffle: false });
  assert.equal(deck.length, 52);
  assert.equal(new Set(deck.map(([rank, suit]) => rank + suit)).size, 52);
});

test("rejects invalid bets and insufficient balances", () => {
  const deck = orderedDeck(card("5"), card("6"), card("10"), card("7"));
  assert.throws(() => startRound({ balance: 500, bet: 0, deck }), /at least 1/);
  assert.throws(() => startRound({ balance: 5, bet: 6, deck }), /higher than your point balance/);
});

test("natural blackjack pays 3:2 and settles immediately", () => {
  const deck = orderedDeck(
    card("A"), card("K"), card("9"), card("7")
  );
  const round = startRound({ balance: 500, bet: 20, deck });
  assert.equal(round.roundActive, false);
  assert.equal(round.balance, 530);
  assert.equal(round.result.hands[0].outcome, "natural");
  assert.equal(round.result.hands[0].payout, 50);
  assert.equal(round.stats.wins, 1);
});

test("natural blackjack pushes against a dealer natural", () => {
  const deck = orderedDeck(
    card("A"), card("K"), card("A", "♥"), card("Q", "♥")
  );
  const round = startRound({ balance: 500, bet: 20, deck });
  assert.equal(round.roundActive, false);
  assert.equal(round.balance, 500);
  assert.equal(round.result.hands[0].outcome, "push");
  assert.equal(round.stats.pushes, 1);
});

test("hitting to a bust ends the hand and skips the dealer draw", () => {
  const deck = orderedDeck(
    card("10"), card("6"), card("10", "♥"), card("7", "♥"), card("8", "♦")
  );
  const started = startRound({ balance: 500, bet: 20, deck });
  const finished = hit(started);
  assert.equal(finished.roundActive, false);
  assert.equal(finished.handStatuses[0], "bust");
  assert.equal(finished.dealer.length, 2);
  assert.equal(finished.balance, 480);
  assert.equal(finished.result.hands[0].outcome, "bust");
});

test("standing resolves the dealer to 17 or higher and pays a normal win 1:1", () => {
  const deck = orderedDeck(
    card("10"), card("8"), card("10", "♥"), card("6", "♥"), card("10", "♦")
  );
  const started = startRound({ balance: 500, bet: 10, deck });
  const finished = stand(started);
  assert.equal(handValue(finished.dealer), 26);
  assert.equal(finished.balance, 510);
  assert.equal(finished.result.hands[0].outcome, "win");
  assert.equal(finished.stats.wins, 1);
});

test("split matches point values, charges a second bet, and plays both hands", () => {
  const deck = orderedDeck(
    card("8"), card("8", "♥"), card("10", "♦"), card("7", "♦"),
    card("3"), card("10", "♥")
  );
  const started = startRound({ balance: 500, bet: 20, deck });
  assert.equal(getControls(started).canSplit, true);
  const splitRound = split(started);
  assert.equal(splitRound.balance, 460);
  assert.equal(splitRound.playerHands.length, 2);
  assert.equal(splitRound.handBets[0], 20);
  assert.equal(splitRound.handBets[1], 20);
  assert.equal(splitRound.activeHandIndex, 0);
  assert.equal(getControls(splitRound).canSplit, false);
  const afterFirstStand = stand(splitRound);
  assert.equal(afterFirstStand.activeHandIndex, 1);
});

test("split Aces receive exactly one card each and automatically stand", () => {
  const deck = orderedDeck(
    card("A"), card("A", "♥"), card("10", "♦"), card("7", "♦"),
    card("9"), card("8", "♥")
  );
  const started = startRound({ balance: 500, bet: 10, deck });
  const finished = split(started);
  assert.equal(finished.roundActive, false);
  assert.deepEqual(finished.handStatuses, ["stood", "stood"]);
  assert.equal(finished.playerHands[0].length, 2);
  assert.equal(finished.playerHands[1].length, 2);
  assert.equal(finished.stats.wins + finished.stats.losses + finished.stats.pushes, 2);
});

test("double down adds an equal bet, deals one card, and automatically stands", () => {
  const deck = orderedDeck(
    card("5"), card("6"), card("10", "♥"), card("7", "♥"), card("10", "♦")
  );
  const started = startRound({ balance: 500, bet: 20, deck });
  assert.equal(getControls(started).canDouble, true);
  const finished = doubleDown(started);
  assert.equal(finished.handBets[0], 40);
  assert.equal(finished.handDoubled[0], true);
  assert.equal(finished.handStatuses[0], "stood");
  assert.equal(finished.playerHands[0].length, 3);
  assert.equal(finished.balance, 540);
  assert.equal(finished.result.hands[0].outcome, "win");
});

test("transitions do not mutate the previous round state", () => {
  const deck = orderedDeck(
    card("10"), card("6"), card("10", "♥"), card("7", "♥"), card("2", "♦")
  );
  const started = startRound({ balance: 500, bet: 10, deck });
  const originalPlayerLength = started.playerHands[0].length;
  const afterHit = hit(started);
  assert.equal(started.playerHands[0].length, originalPlayerLength);
  assert.equal(afterHit.playerHands[0].length, originalPlayerLength + 1);
});
