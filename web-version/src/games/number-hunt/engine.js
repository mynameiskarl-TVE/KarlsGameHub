/**
 * No-stake Number Hunt game logic.
 * The secret target is kept in game state and is only shown after the round ends.
 */

export const NUMBER_MIN = 1;
export const NUMBER_MAX = 20;
export const MAX_ATTEMPTS = 5;
export const DEFAULT_REWARD = 20;

export function createNumberHunt({
  target = Math.floor(Math.random() * (NUMBER_MAX - NUMBER_MIN + 1)) + NUMBER_MIN,
  reward = DEFAULT_REWARD,
} = {}) {
  if (!Number.isSafeInteger(target) || target < NUMBER_MIN || target > NUMBER_MAX) {
    throw new RangeError("The secret number must be between 1 and 20.");
  }
  if (!Number.isSafeInteger(reward) || reward < 0) {
    throw new RangeError("The reward must be a non-negative whole number.");
  }

  return {
    target,
    reward,
    maxAttempts: MAX_ATTEMPTS,
    attemptsLeft: MAX_ATTEMPTS,
    guesses: [],
    active: true,
    result: null,
  };
}

export function submitNumberGuess(game, rawGuess) {
  if (!game || typeof game !== "object") {
    throw new TypeError("Start a Number Hunt round first.");
  }
  if (!game.active) {
    throw new Error("This round is complete. Start a new round to play again.");
  }

  const guess = typeof rawGuess === "number" ? rawGuess : Number(rawGuess);
  if (!Number.isSafeInteger(guess) || guess < NUMBER_MIN || guess > NUMBER_MAX) {
    throw new RangeError("Enter a whole number from 1 to 20.");
  }

  const next = {
    ...game,
    guesses: [...game.guesses, guess],
    attemptsLeft: game.attemptsLeft - 1,
    result: null,
  };

  if (guess === game.target) {
    next.active = false;
    next.result = {
      outcome: "win",
      reward: game.reward,
      target: game.target,
      message: `You found it! The number was ${game.target}. You earned ${game.reward} points.`,
    };
  } else if (next.attemptsLeft === 0) {
    next.active = false;
    next.result = {
      outcome: "out_of_guesses",
      reward: 0,
      target: game.target,
      message: `Out of guesses. The number was ${game.target}. Try another round!`,
    };
  } else {
    next.result = {
      outcome: "hint",
      reward: 0,
      target: null,
      hint: guess < game.target ? "Higher" : "Lower",
      message: `${guess < game.target ? "Higher" : "Lower"} — ${next.attemptsLeft} guesses left.`,
    };
  }

  return next;
}
