import test from "node:test";
import assert from "node:assert/strict";
import { playRockPaperScissors, RPS_MOVES, RPS_WIN_REWARD, RPS_TIE_REWARD } from "./engine.js";

test("all three player moves beat the correct computer move", () => {
  assert.equal(playRockPaperScissors("Rock", "Scissors").outcome, "win");
  assert.equal(playRockPaperScissors("Paper", "Rock").outcome, "win");
  assert.equal(playRockPaperScissors("Scissors", "Paper").outcome, "win");
});

test("all three losing matchups return zero points", () => {
  assert.equal(playRockPaperScissors("Rock", "Paper").reward, 0);
  assert.equal(playRockPaperScissors("Paper", "Scissors").reward, 0);
  assert.equal(playRockPaperScissors("Scissors", "Rock").reward, 0);
});

test("ties award the original 2-point bonus", () => {
  for (const move of RPS_MOVES) {
    const result = playRockPaperScissors(move, move);
    assert.equal(result.outcome, "tie");
    assert.equal(result.reward, RPS_TIE_REWARD);
  }
});

test("wins award the original 10 points", () => {
  const result = playRockPaperScissors("Rock", "Scissors");
  assert.equal(result.reward, RPS_WIN_REWARD);
  assert.equal(result.message.includes("+10"), true);
});

test("rejects unknown player or computer moves", () => {
  assert.throws(() => playRockPaperScissors("Lizard", "Rock"), /Choose Rock/);
  assert.throws(() => playRockPaperScissors("Rock", "Lizard"), /computer move is invalid/);
});
