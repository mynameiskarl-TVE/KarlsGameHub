import React from "react";
import {
  answerTriviaQuestion,
  createTriviaQuiz,
  QUESTIONS_PER_QUIZ,
  TRIVIA_MAX_BET,
  validateTriviaBet,
} from "../games/trivia/engine.js";
import { fetchTriviaStatus, formatCountdown, startTriviaGame } from "../lib/triviaDaily.js";

const formatPoints = (value) => new Intl.NumberFormat("en-US").format(value);

export default function TriviaGame({
  balance,
  onSpendPoints,
  onEarnPoints,
  onGameResult,
  rewardPerCorrect = 5,
  client = null,
  signedIn = false,
  visible = true,
}) {
  const [quiz, setQuiz] = React.useState(null);
  const [showFeedback, setShowFeedback] = React.useState(false);
  const [notice, setNotice] = React.useState("");
  const [betText, setBetText] = React.useState("0");
  const [starting, setStarting] = React.useState(false);
  // Daily limit, as reported by the SERVER. `checked` is false until the first answer arrives.
  const [daily, setDaily] = React.useState({ checked: false, canPlay: false, maxBet: TRIVIA_MAX_BET, error: "" });
  const [secondsLeft, setSecondsLeft] = React.useState(0);
  // The countdown uses performance.now(), which keeps counting at a steady pace and ignores the
  // computer's date/time, so changing the local clock cannot shorten the wait.
  const countdownBase = React.useRef({ seconds: 0, at: 0 });

  const online = Boolean(client && signedIn);
  const maxBet = Math.max(0, Math.min(daily.maxBet, balance));

  const applyServerState = React.useCallback((state) => {
    countdownBase.current = { seconds: state.secondsUntilReset, at: performance.now() };
    setSecondsLeft(state.secondsUntilReset);
    setDaily({ checked: true, canPlay: state.canPlay, maxBet: state.maxBet, error: "" });
  }, []);

  const refreshDaily = React.useCallback(async () => {
    if (!online) return;
    try {
      applyServerState(await fetchTriviaStatus(client));
    } catch (error) {
      setDaily((current) => ({
        ...current,
        checked: true,
        canPlay: false,
        error: error instanceof Error ? error.message : "Could not check today's trivia game.",
      }));
    }
  }, [online, client, applyServerState]);

  // Ask the server whenever the player opens Trivia, signs in, or switches account.
  React.useEffect(() => {
    if (!online) {
      setDaily({ checked: false, canPlay: false, maxBet: TRIVIA_MAX_BET, error: "" });
      return;
    }
    if (visible) refreshDaily();
  }, [online, visible, refreshDaily]);

  // Count down the seconds the server gave us; when they run out, ask the server again.
  const waiting = online && daily.checked && !daily.canPlay && !daily.error && !(quiz && quiz.active);
  React.useEffect(() => {
    if (!waiting) return undefined;
    const timer = window.setInterval(() => {
      const { seconds, at } = countdownBase.current;
      const left = Math.max(0, seconds - Math.floor((performance.now() - at) / 1000));
      setSecondsLeft(left);
      if (left === 0) {
        window.clearInterval(timer);
        refreshDaily();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [waiting, refreshDaily, daily.canPlay]);

  async function startQuiz() {
    if (starting || !online) return;

    let bet;
    try {
      bet = validateTriviaBet(betText, maxBet);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Check your bet and try again.");
      return;
    }

    setStarting(true);
    try {
      // The server uses up today's game first. Only if it says yes do we take the bet and start.
      const started = await startTriviaGame(client, bet);
      applyServerState({ ...started, canPlay: false });
      if (!started.ok) {
        setNotice("You have already played Trivia today.");
        return;
      }

      let stake = bet;
      if (stake > 0 && !onSpendPoints?.(stake)) {
        stake = 0;
        setNotice("Your balance changed, so this game is being played without a bet.");
      } else {
        setNotice(stake > 0
          ? `You bet ${formatPoints(stake)} points. Answer five questions.`
          : `Answer five questions. You earn ${formatPoints(rewardPerCorrect)} points for each correct answer.`);
      }
      setQuiz(createTriviaQuiz({ rewardPerCorrect, bet: stake }));
      setShowFeedback(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Trivia could not start. Nothing was used up; try again.");
    } finally {
      setStarting(false);
    }
  }

  function chooseAnswer(index) {
    if (!quiz?.active || showFeedback) return;

    try {
      const next = answerTriviaQuestion(quiz, index);
      // Only the classic quiz charges 2 points for a wrong answer; with a bet, your bet is the risk.
      if (!quiz.bet && !next.lastAnswer.correct && !onSpendPoints?.(2)) { setNotice("You need 2 points available to risk an incorrect answer."); return; }
      setQuiz(next);
      setShowFeedback(true);

      if (next.lastAnswer.earnedNow > 0) {
        onEarnPoints(next.lastAnswer.earnedNow);
      }
      if (next.result) {
        onGameResult?.({
          game: "trivia",
          correctAnswers: next.result.correctAnswers,
        });
      }
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Your answer could not be checked.");
    }
  }

  function nextQuestion() {
    setShowFeedback(false);
    setNotice("");
  }

  const betIsValid = (() => {
    try { validateTriviaBet(betText, maxBet); return true; } catch { return false; }
  })();

  function renderStartPanel() {
    if (!online) {
      return (
        <>
          <div className="trivia-symbol" aria-hidden="true">?</div>
          <h2>Sign in to play Trivia</h2>
          <p className="trivia-copy">Trivia can be played once a day, and the server keeps track of the day. Sign in to your account to play. Your other games still work as a guest.</p>
        </>
      );
    }
    if (!daily.checked) {
      return (
        <>
          <div className="trivia-symbol" aria-hidden="true">?</div>
          <h2>Checking today's game…</h2>
        </>
      );
    }
    if (daily.error) {
      return (
        <>
          <div className="trivia-symbol" aria-hidden="true">!</div>
          <h2>Could not check today's game</h2>
          <p className="trivia-copy" role="alert">{daily.error}</p>
          <button className="trivia-primary" type="button" onClick={refreshDaily}>Try again</button>
        </>
      );
    }
    if (!daily.canPlay) {
      return (
        <>
          <div className="trivia-symbol" aria-hidden="true">✓</div>
          <h2>You have played Trivia today</h2>
          <p className="trivia-copy" role="status" aria-live="polite">
            {`Your next game is available in ${formatCountdown(secondsLeft)}. The server decides when a new day starts, so changing the clock on your device will not change this.`}
          </p>
        </>
      );
    }
    return (
      <>
        <div className="trivia-symbol" aria-hidden="true">?</div>
        <h2>Ready for today's quiz?</h2>
        <p className="trivia-copy">{`Answer five multiple-choice questions. Without a bet, each correct answer earns ${formatPoints(rewardPerCorrect)} points (10-point bonus for a perfect score) and each wrong answer costs 2. With a bet, the questions are the same but you win or lose based on your score: 5 correct pays 3×, 4 pays 2×, 3 returns your bet, 2 returns half, and 0 or 1 loses it. The maximum bet is ${formatPoints(daily.maxBet)} points.`}</p>
        <div className="trivia-bet">
          <label htmlFor="trivia-bet-input">Your bet (0 for no bet)</label>
          <input
            id="trivia-bet-input"
            type="number"
            inputMode="numeric"
            min="0"
            max={maxBet}
            step="1"
            value={betText}
            onChange={(event) => setBetText(event.target.value)}
          />
          <div className="trivia-bet-quick">
            <button type="button" onClick={() => setBetText("0")}>No bet</button>
            <button type="button" onClick={() => setBetText(String(Math.min(100, maxBet)))}>100</button>
            <button type="button" onClick={() => setBetText(String(Math.min(500, maxBet)))}>500</button>
            <button type="button" onClick={() => setBetText(String(maxBet))}>Max ({formatPoints(maxBet)})</button>
          </div>
        </div>
        <p className="muted">One game per day. It counts as played the moment you press Start, so closing or refreshing the page halfway through will not give it back.</p>
        <button className="trivia-primary" type="button" onClick={startQuiz} disabled={starting || !betIsValid}>
          {starting ? "Starting…" : "Start quiz"}
        </button>
      </>
    );
  }

  return (
    <section className="trivia-page" aria-labelledby="trivia-title">
      <div className="trivia-heading">
        <div>
          <span className="eyebrow">ARCADE MINI-GAME</span>
          <h1 id="trivia-title">Quick Trivia</h1>
          <p className="muted">Five questions from the Mini Arcade question bank. One game a day.</p>
        </div>
        <div className="trivia-balance" aria-live="polite">
          <span>YOUR BALANCE</span>
          <strong>{formatPoints(balance)} pts</strong>
        </div>
      </div>

      <div className="trivia-card">
        {!quiz ? (
          renderStartPanel()
        ) : quiz.active ? (
          <>
            <div className="trivia-progress-heading">
              <span>QUESTION {quiz.questionIndex + 1} OF {QUESTIONS_PER_QUIZ}</span>
              <strong>{quiz.correctAnswers} correct{quiz.bet ? ` · bet ${formatPoints(quiz.bet)}` : ""}</strong>
            </div>
            <div className="trivia-progress-track" aria-label={`${quiz.questionIndex} of 5 questions answered`}>
              <span style={{ width: `${(quiz.questionIndex / QUESTIONS_PER_QUIZ) * 100}%` }} />
            </div>
            <h2 className="trivia-question">{quiz.questions[quiz.questionIndex].question}</h2>
            {!showFeedback ? (
              <div className="trivia-options">
                {quiz.questions[quiz.questionIndex].options.map((option, index) => (
                  <button
                    type="button"
                    className="trivia-option"
                    key={option}
                    onClick={() => chooseAnswer(index)}
                  >
                    <span>{String.fromCharCode(65 + index)}</span>
                    {option}
                  </button>
                ))}
              </div>
            ) : (
              <div className={`trivia-feedback ${quiz.lastAnswer.correct ? "is-correct" : "is-incorrect"}`} role="status" aria-live="polite">
                <strong>{quiz.lastAnswer.correct ? "Correct!" : "Not quite"}</strong>
                <p>{quiz.lastAnswer.message}</p>
                <button className="trivia-primary" type="button" onClick={nextQuestion}>Next question</button>
              </div>
            )}
          </>
        ) : (
          <div className="trivia-complete" role="status" aria-live="polite">
            <div className="trivia-symbol" aria-hidden="true">{quiz.correctAnswers === 5 ? "★" : "✓"}</div>
            <span className="eyebrow">QUIZ COMPLETE</span>
            <h2>{quiz.correctAnswers} / {QUESTIONS_PER_QUIZ} correct</h2>
            <p>{quiz.result.message}</p>
            {quiz.bet ? (
              <p className="trivia-earned">
                Bet: {formatPoints(quiz.bet)} · Paid back: {formatPoints(quiz.result.payout)} · {quiz.result.net >= 0 ? "Won" : "Lost"}: {formatPoints(Math.abs(quiz.result.net))}
              </p>
            ) : (
              <p className="trivia-earned">
                Points earned this quiz: {formatPoints(quiz.correctAnswers * quiz.rewardPerCorrect + quiz.result.perfectBonus)}
              </p>
            )}
            {daily.checked && daily.canPlay ? (
              <button className="trivia-primary" type="button" onClick={() => { setQuiz(null); setNotice(""); }}>Play today's quiz</button>
            ) : (
              <p className="muted">That was today's game.{daily.checked ? ` Your next game is available in ${formatCountdown(secondsLeft)}.` : ""}</p>
            )}
          </div>
        )}
        {notice ? <p className="trivia-notice" role="status" aria-live="polite">{notice}</p> : null}
      </div>

      <p className="trivia-balance-note">Current balance: {formatPoints(balance)} points. Without a bet, each incorrect answer costs 2 points. With a bet, your bet is the only thing at risk.</p>
    </section>
  );
}
