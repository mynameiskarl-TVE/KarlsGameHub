import React from "react";
import {
  createNumberHunt,
  submitNumberGuess,
  MAX_ATTEMPTS,
  NUMBER_MAX,
  NUMBER_MIN,
} from "../games/number-hunt/engine.js";

const formatPoints = (value) => new Intl.NumberFormat("en-US").format(value);

export default function NumberHuntGame({ balance, onEarnPoints, onGameResult }) {
  const [game, setGame] = React.useState(null);
  const [guess, setGuess] = React.useState("");
  const [message, setMessage] = React.useState("Start a round to get a secret number.");

  function startRound() {
    setGame(createNumberHunt());
    setGuess("");
    setMessage("I picked a number. You have five guesses!");
  }

  function submitGuess(event) {
    event.preventDefault();
    if (!game?.active) return;

    try {
      const next = submitNumberGuess(game, guess);
      setGame(next);
      setGuess("");

      if (next.result.outcome === "win") {
        onEarnPoints(next.result.reward);
        onGameResult?.({ game: "numberHunt", outcome: "win" });
      } else if (next.result.outcome === "out_of_guesses") {
        onGameResult?.({ game: "numberHunt", outcome: "loss" });
      }
      setMessage(next.result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Your guess could not be checked.");
    }
  }

  const guessesRemaining = game?.attemptsLeft ?? MAX_ATTEMPTS;

  return (
    <section className="number-hunt-page" aria-labelledby="number-hunt-title">
      <div className="number-hunt-heading">
        <div>
          <span className="eyebrow">ARCADE MINI-GAME</span>
          <h1 id="number-hunt-title">Number Hunt</h1>
          <p className="muted">Find the secret number from 1 to 20 in five guesses.</p>
        </div>
        <div className="number-hunt-balance" aria-live="polite">
          <span>YOUR BALANCE</span>
          <strong>{formatPoints(balance)} pts</strong>
        </div>
      </div>

      <div className="number-hunt-card">
        <div className="number-hunt-mark" aria-hidden="true">?</div>
        <h2>{game?.active ? "Find the number" : game?.result?.outcome === "win" ? "You found it!" : game ? "Round complete" : "Ready to play?"}</h2>
        <p className="number-hunt-message" role="status" aria-live="polite">{message}</p>

        {game && (
          <div className="attempt-track" aria-label={`${guessesRemaining} of 5 guesses remaining`}>
            {Array.from({ length: MAX_ATTEMPTS }, (_, index) => (
              <span
                key={index}
                className={index < guessesRemaining ? "attempt-dot available" : "attempt-dot used"}
                aria-hidden="true"
              />
            ))}
          </div>
        )}

        {game?.guesses?.length > 0 && (
          <div className="guess-history">
            <span>YOUR GUESSES</span>
            <div className="guess-chips">
              {game.guesses.map((item, index) => (
                <span className="guess-chip" key={`${item}-${index}`}>{item}</span>
              ))}
            </div>
          </div>
        )}

        {!game && (
          <button className="number-hunt-button number-hunt-primary" type="button" onClick={startRound}>
            Start game
          </button>
        )}

        {game?.active && (
          <form className="guess-form" onSubmit={submitGuess}>
            <label htmlFor="number-hunt-guess">Your guess</label>
            <div className="guess-entry-row">
              <input
                id="number-hunt-guess"
                type="number"
                min={NUMBER_MIN}
                max={NUMBER_MAX}
                step="1"
                inputMode="numeric"
                value={guess}
                onChange={(event) => setGuess(event.target.value)}
                placeholder="1–20"
                autoComplete="off"
              />
              <button className="number-hunt-button number-hunt-primary" type="submit" disabled={!guess.trim()}>
                Guess
              </button>
            </div>
          </form>
        )}

        {game && !game.active && (
          <button className="number-hunt-button number-hunt-primary" type="button" onClick={startRound}>
            Play again
          </button>
        )}
      </div>

      <div className="number-hunt-info">
        <div>
          <strong>How it works</strong>
          <p>Enter a whole number from 1 to 20. The game tells you whether the secret number is higher or lower.</p>
        </div>
        <div>
          <strong>Reward</strong>
          <p>Find the number to earn 20 points. There is no entry cost and incorrect guesses never remove points.</p>
        </div>
      </div>
    </section>
  );
}
