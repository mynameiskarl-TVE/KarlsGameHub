import test from "node:test";
import assert from "node:assert/strict";
import {
  cardPoints,
  handValue,
  startBlackjackRound,
  standBlackjack,
  splitBlackjack,
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

test("Blackjack can split equal-value face and number cards", () => {
  const round = {
    deck: [
      { rank: "4", suit: "♠" },
      { rank: "6", suit: "♥" },
    ],
    hands: [[
      { rank: "10", suit: "♣" },
      { rank: "K", suit: "♦" },
    ]],
    dealer: [
      { rank: "8", suit: "♣" },
      { rank: "7", suit: "♠" },
    ],
    handStatus: ["playing"],
    activeHand: 0,
    splitUsed: false,
    phase: "playing",
    outcomes: [],
    reward: 0,
    result: null,
  };
  const nextRound = splitBlackjack(round);
  assert.equal(nextRound.hands.length, 2);
  assert.equal(nextRound.splitUsed, true);
});

test("Blackjack stand settles an active round", () => {
  let round = startBlackjackRound(() => 0.5);
  if (round.phase === "playing") round = standBlackjack(round);
  assert.equal(round.phase, "complete");
  assert.ok(round.result);
  assert.ok(round.reward >= 0);
});

test("slot machine deterministic seven jackpot returns the configured stake multiplier", () => {
  const result = spinSlots(() => 0);
  assert.deepEqual(result.reels, ["7", "7", "7"]);
  assert.equal(result.outcome, "jackpot");
  assert.equal(result.payoutMultiplier, 10);
  assert.equal(result.reward, 100);
});

test("slot machine always returns a non-negative payout multiplier", () => {
  const result = spinSlots(() => 0.999);
  assert.ok(result.payoutMultiplier >= 0);
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
