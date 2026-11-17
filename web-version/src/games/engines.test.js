import test from "node:test";
import assert from "node:assert/strict";
import {
  cardPoints,
  handValue,
  startBlackjackRound,
  standBlackjack,
} from "./blackjack/engine.js";
import { spinSlots } from "./slots/engine.js";
import { flipCoin } from "./coin-flip/engine.js";

test("Blackjack handles face cards and flexible aces", () => {
  assert.equal(cardPoints({ rank: "K", suit: "♠" }), 10);
  assert.equal(handValue([
    { rank: "A", suit: "♠" },
    { rank: "9", suit: "♥" },
    { rank: "5", suit: "♦" },
  ]), 15);
  assert.equal(handValue([
    { rank: "A", suit: "♠" },
    { rank: "A", suit: "♥" },
    { rank: "9", suit: "♦" },
  ]), 21);
});

test("Blackjack deals from one 52-card deck without duplicate cards", () => {
  const round = startBlackjackRound(() => 0.5);
  const cards = [
    ...round.deck,
    ...round.dealer,
    ...round.hands.flat(),
  ];
  assert.equal(cards.length, 52);
  assert.equal(new Set(cards.map((card) => card.rank + card.suit)).size, 52);
});

test("Blackjack stand settles an active round", () => {
  let round = startBlackjackRound(() => 0.5);
  if (round.phase === "playing") round = standBlackjack(round);
  assert.equal(round.phase, "complete");
  assert.ok(round.result);
  assert.ok(round.reward >= 0);
});

test("slot machine deterministic seven jackpot awards fixed free-play points", () => {
  const result = spinSlots(() => 0);
  assert.deepEqual(result.reels, ["7", "7", "7"]);
  assert.equal(result.outcome, "jackpot");
  assert.equal(result.reward, 100);
});

test("coin flip awards points only for a correct call", () => {
  const correct = flipCoin("Heads", () => 0.2);
  assert.equal(correct.result, "Heads");
  assert.equal(correct.reward, 10);
  const incorrect = flipCoin("Tails", () => 0.2);
  assert.equal(incorrect.result, "Heads");
  assert.equal(incorrect.reward, 0);
});

test("coin flip rejects invalid guesses", () => {
  assert.throws(() => flipCoin("Edge", () => 0.2), /Choose Heads or Tails/);
});
