import React from "react";
import {
  answerTriviaQuestion,
  createTriviaQuiz,
  QUESTIONS_PER_QUIZ,
} from "../games/trivia/engine.js";

const formatPoints = (value) => new Intl.NumberFormat("en-US").format(value);

export default function TriviaGame({ balance, onSpendPoints, onEarnPoints, onGameResult, rewardPerCorrect = 5 }) {
  const [quiz, setQuiz] = React.useState(null);
  const [showFeedback, setShowFeedback] = React.useState(false);
  const [message, setMessage] = React.useState("Start a quiz when you are ready.");

  function startQuiz() {
    setQuiz(createTriviaQuiz({ rewardPerCorrect }));
    setShowFeedback(false);
    setMessage("Answer five questions. You earn 5 points for each correct answer.");
  }

  function chooseAnswer(index) {
    if (!quiz?.active || showFeedback) return;

    try {
      const next = answerTriviaQuestion(quiz, index);
      if (!next.lastAnswer.correct && !onSpendPoints?.(2)) { setMessage("You need 2 points available to risk an incorrect answer."); return; }
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
      setMessage(next.lastAnswer.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Your answer could not be checked.");
    }
  }

  function nextQuestion() {
    setShowFeedback(false);
    setMessage("Choose your answer.");
  }

  return (
    <section className="trivia-page" aria-labelledby="trivia-title">
      <div className="trivia-heading">
        <div>
          <span className="eyebrow">ARCADE MINI-GAME</span>
          <h1 id="trivia-title">Quick Trivia</h1>
          <p className="muted">Five questions selected from the Mini Arcade question bank.</p>
        </div>
        <div className="trivia-balance" aria-live="polite">
          <span>YOUR BALANCE</span>
          <strong>{formatPoints(balance)} pts</strong>
        </div>
      </div>

      <div className="trivia-card">
        {!quiz ? (
          <>
            <div className="trivia-symbol" aria-hidden="true">?</div>
            <h2>Ready for a quick quiz?</h2>
            <p className="trivia-copy">{`Answer five multiple-choice questions. Each correct answer earns ${formatPoints(rewardPerCorrect)} points, with a 10-point bonus for a perfect score.`}</p>
            <button className="trivia-primary" type="button" onClick={startQuiz}>Start quiz</button>
          </>
        ) : quiz.active ? (
          <>
            <div className="trivia-progress-heading">
              <span>QUESTION {quiz.questionIndex + 1} OF {QUESTIONS_PER_QUIZ}</span>
              <strong>{quiz.correctAnswers} correct</strong>
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
            <p className="trivia-earned">
              Points earned this quiz: {formatPoints(quiz.correctAnswers * quiz.rewardPerCorrect + quiz.result.perfectBonus)}
            </p>
            <button className="trivia-primary" type="button" onClick={startQuiz}>Play another quiz</button>
          </div>
        )}
      </div>

      <p className="trivia-balance-note">Current balance: {formatPoints(balance)} points. Each incorrect answer costs 2 points.</p>
    </section>
  );
}
