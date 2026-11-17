import test from "node:test";
import assert from "node:assert/strict";
import {
  createNumberHunt,
  submitNumberGuess,
  MAX_ATTEMPTS,
  DEFAULT_REWARD,
} from "./engine.js";

test("starts with five attempts and a target in the allowed range", () => {
  const game = createNumberHunt();
  assert.equal(game.attemptsLeft, MAX_ATTEMPTS);
  assert.equal(game.guesses.length, 0);
  assert.equal(game.active, true);
  assert.ok(game.target >= 1 && game.target <= 20);
  assert.equal(game.reward, DEFAULT_REWARD);
});

test("gives a Higher hint when the guess is below the target", () => {
  const game = createNumberHunt({ target: 15 });
  const next = submitNumberGuess(game, 8);
  assert.equal(next.result.hint, "Higher");
  assert.equal(next.attemptsLeft, 4);
  assert.deepEqual(next.guesses, [8]);
  assert.equal(next.active, true);
  assert.equal(game.attemptsLeft, 5);
});

test("gives a Lower hint when the guess is above the target", () => {
  const game = createNumberHunt({ target: 6 });
  const next = submitNumberGuess(game, 12);
  assert.equal(next.result.hint, "Lower");
  assert.equal(next.attemptsLeft, 4);
});

test("awards the configured points once when the correct number is guessed", () => {
  const game = createNumberHunt({ target: 12, reward: 35 });
  const next = submitNumberGuess(game, 12);
  assert.equal(next.active, false);
  assert.equal(next.result.outcome, "win");
  assert.equal(next.result.reward, 35);
  assert.equal(next.result.target, 12);
  assert.throws(() => submitNumberGuess(next, 12), /round is complete/);
});

test("ends after five incorrect guesses without awarding points", () => {
  let game = createNumberHunt({ target: 20 });
  for (const guess of [1, 2, 3, 4]) {
    game = submitNumberGuess(game, guess);
    assert.equal(game.active, true);
  }
  game = submitNumberGuess(game, 5);
  assert.equal(game.active, false);
  assert.equal(game.attemptsLeft, 0);
  assert.equal(game.result.outcome, "out_of_guesses");
  assert.equal(game.result.reward, 0);
  assert.equal(game.result.target, 20);
});

test("rejects invalid guesses without changing the previous state", () => {
  const game = createNumberHunt({ target: 10 });
  assert.throws(() => submitNumberGuess(game, 2.5), /whole number/);
  assert.throws(() => submitNumberGuess(game, 21), /1 to 20/);
  assert.throws(() => submitNumberGuess(game, ""), /1 to 20/);
  assert.equal(game.attemptsLeft, 5);
  assert.deepEqual(game.guesses, []);
});

test("rejects invalid game configuration", () => {
  assert.throws(() => createNumberHunt({ target: 0 }), /between 1 and 20/);
  assert.throws(() => createNumberHunt({ target: 21 }), /between 1 and 20/);
  assert.throws(() => createNumberHunt({ reward: -1 }), /non-negative/);
});
