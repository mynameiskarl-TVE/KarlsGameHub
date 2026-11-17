export const RPS_MOVES = ["Rock", "Paper", "Scissors"];
export const RPS_WIN_REWARD = 10;
export const RPS_TIE_REWARD = 2;

const BEATS = {
  Rock: "Scissors",
  Paper: "Rock",
  Scissors: "Paper",
};

export function playRockPaperScissors(
  playerMove,
  computerMove,
  { winReward = RPS_WIN_REWARD, tieReward = RPS_TIE_REWARD } = {}
) {
  if (!Number.isSafeInteger(winReward) || winReward < 0 || winReward > 100_000 ||
      !Number.isSafeInteger(tieReward) || tieReward < 0 || tieReward > 100_000) {
    throw new RangeError("Reward values must be non-negative whole numbers.");
  }
  if (!RPS_MOVES.includes(playerMove)) {
    throw new RangeError("Choose Rock, Paper, or Scissors.");
  }
  if (!RPS_MOVES.includes(computerMove)) {
    throw new RangeError("The computer move is invalid.");
  }

  let outcome;
  let reward;

  if (playerMove === computerMove) {
    outcome = "tie";
    reward = tieReward;
  } else if (BEATS[playerMove] === computerMove) {
    outcome = "win";
    reward = winReward;
  } else {
    outcome = "loss";
    reward = 0;
  }

  return {
    playerMove,
    computerMove,
    outcome,
    reward,
    message:
      outcome === "tie"
        ? `You both chose ${computerMove}. Tie bonus: +${reward} points.`
        : outcome === "win"
          ? `You chose ${playerMove}; computer chose ${computerMove}. You win +${reward}!`
          : `You chose ${playerMove}; computer chose ${computerMove}. Computer wins this round.`,
  };
}
