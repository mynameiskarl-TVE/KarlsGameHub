import React from "react";
import { RPS_MOVES, playRockPaperScissors } from "../games/rock-paper-scissors/engine.js";

const moveLabels = {
  Rock: "ROCK",
  Paper: "PAPER",
  Scissors: "SCISSORS",
};

const formatPoints = (value) => new Intl.NumberFormat("en-US").format(value);

export default function RockPaperScissorsGame({ balance, onSpendPoints, onEarnPoints, onGameResult, rewardAmount = 10 }) {
  const [lastRound, setLastRound] = React.useState(null);
  const [stats, setStats] = React.useState({ played: 0, wins: 0, ties: 0 });

  function play(move) {
    if (balance < 4 || !onSpendPoints?.(4)) return;
    const computerMove = RPS_MOVES[Math.floor(Math.random() * RPS_MOVES.length)];
    const result = playRockPaperScissors(move, computerMove, { winReward: rewardAmount });

    setLastRound(result);
    setStats((current) => ({
      played: current.played + 1,
      wins: current.wins + (result.outcome === "win" ? 1 : 0),
      ties: current.ties + (result.outcome === "tie" ? 1 : 0),
    }));

    if (result.reward > 0) onEarnPoints(result.reward);
    onGameResult?.({ game: "rps", outcome: result.outcome });
  }

  return (
    <section className="rps-page" aria-labelledby="rps-title">
      <div className="rps-heading">
        <div>
          <span className="eyebrow">ARCADE MINI-GAME</span>
          <h1 id="rps-title">Rock Paper Scissors</h1>
          <p className="muted">Choose a move and see what the computer picks.</p>
        </div>
        <div className="rps-balance" aria-live="polite">
          <span>YOUR BALANCE</span>
          <strong>{formatPoints(balance)} pts</strong>
        </div>
      </div>

      <div className="rps-card">
        <div className="rps-scoreboard">
          <div><strong>{stats.played}</strong><span>Played</span></div>
          <div><strong>{stats.wins}</strong><span>Wins</span></div>
          <div><strong>{stats.ties}</strong><span>Ties</span></div>
        </div>

        <h2>Make your move</h2>
        <p className="rps-instructions">Rock beats Scissors. Scissors beats Paper. Paper beats Rock.</p>

        <div className="rps-moves">
          {RPS_MOVES.map((move) => (
            <button
              className="rps-move-button"
              type="button"
              key={move}
              onClick={() => play(move)}
              disabled={balance < 4}
              aria-label={move}
            >
              <span className="rps-move-word" aria-hidden="true">{moveLabels[move]}</span>
              <strong>{move}</strong>
            </button>
          ))}
        </div>

        {lastRound ? (
          <div className={`rps-result rps-result-${lastRound.outcome}`} role="status" aria-live="polite">
            <div className="rps-versus">
              <div><span>You</span><strong>{lastRound.playerMove}</strong></div>
              <span className="versus-label">VS</span>
              <div><span>Computer</span><strong>{lastRound.computerMove}</strong></div>
            </div>
            <strong className="rps-result-message">{lastRound.message}</strong>
          </div>
        ) : (
          <p className="rps-ready" role="status">Choose Rock, Paper, or Scissors to play your first round.</p>
        )}
      </div>

      <div className="rps-rewards">
        <div><strong>Win</strong><span>+{formatPoints(rewardAmount)} points</span></div>
        <div><strong>Tie</strong><span>+2 points</span></div>
        <div><strong>Loss</strong><span>Lose 4-point stake</span></div>
      </div>
    </section>
  );
}
