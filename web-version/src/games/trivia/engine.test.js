import test from "node:test";
import assert from "node:assert/strict";
import {
  createTriviaQuiz,
  answerTriviaQuestion,
  TRIVIA_QUESTIONS,
  QUESTIONS_PER_QUIZ,
  TRIVIA_REWARD,
  PERFECT_QUIZ_BONUS,
} from "./engine.js";

const allCorrectRandom = () => 0.999999;

test("the original question bank contains twelve questions and starts five at a time", () => {
  assert.equal(TRIVIA_QUESTIONS.length, 12);
  const quiz = createTriviaQuiz({ random: allCorrectRandom });
  assert.equal(quiz.questions.length, QUESTIONS_PER_QUIZ);
  assert.equal(quiz.active, true);
  assert.equal(quiz.questionIndex, 0);
  assert.equal(quiz.correctAnswers, 0);
});

test("a correct answer awards five points and advances the quiz", () => {
  const quiz = createTriviaQuiz({ random: allCorrectRandom });
  const answer = quiz.questions[0].answer;
  const next = answerTriviaQuestion(quiz, answer);
  assert.equal(next.lastAnswer.correct, true);
  assert.equal(next.lastAnswer.earnedNow, TRIVIA_REWARD);
  assert.equal(next.questionIndex, 1);
  assert.equal(next.correctAnswers, 1);
  assert.equal(next.active, true);
  assert.equal(quiz.questionIndex, 0);
});

test("an incorrect answer awards no points and reveals the correct answer", () => {
  const quiz = createTriviaQuiz({ random: allCorrectRandom });
  const question = quiz.questions[0];
  const wrong = (question.answer + 1) % question.options.length;
  const next = answerTriviaQuestion(quiz, wrong);
  assert.equal(next.lastAnswer.correct, false);
  assert.equal(next.lastAnswer.earnedNow, 0);
  assert.equal(next.lastAnswer.correctText, question.options[question.answer]);
});

test("a perfect quiz awards the original ten-point completion bonus", () => {
  let quiz = createTriviaQuiz({ random: allCorrectRandom });
  for (let index = 0; index < QUESTIONS_PER_QUIZ; index += 1) {
    quiz = answerTriviaQuestion(quiz, quiz.questions[quiz.questionIndex].answer);
  }
  assert.equal(quiz.active, false);
  assert.equal(quiz.correctAnswers, 5);
  assert.equal(quiz.result.perfectBonus, PERFECT_QUIZ_BONUS);
  assert.equal(quiz.lastAnswer.earnedNow, TRIVIA_REWARD + PERFECT_QUIZ_BONUS);
  assert.equal(quiz.result.message, "Quiz complete: 5/5 correct. Bonus: +10.");
});

test("a non-perfect quiz does not receive a completion bonus", () => {
  let quiz = createTriviaQuiz({ random: allCorrectRandom });
  for (let index = 0; index < QUESTIONS_PER_QUIZ; index += 1) {
    const correct = quiz.questions[quiz.questionIndex].answer;
    quiz = answerTriviaQuestion(quiz, index === 0 ? (correct + 1) % 4 : correct);
  }
  assert.equal(quiz.active, false);
  assert.equal(quiz.correctAnswers, 4);
  assert.equal(quiz.result.perfectBonus, 0);
  assert.equal(quiz.lastAnswer.earnedNow, TRIVIA_REWARD);
});

test("rejects invalid answers and refuses answers after completion", () => {
  const quiz = createTriviaQuiz({ random: allCorrectRandom });
  assert.throws(() => answerTriviaQuestion(quiz, -1), /available answers/);
  assert.throws(() => answerTriviaQuestion(quiz, 4), /available answers/);
  assert.equal(quiz.questionIndex, 0);

  let finished = quiz;
  for (let index = 0; index < QUESTIONS_PER_QUIZ; index += 1) {
    finished = answerTriviaQuestion(finished, finished.questions[finished.questionIndex].answer);
  }
  assert.throws(() => answerTriviaQuestion(finished, 0), /quiz is complete/);
});

test("rejects quiz configurations with too few questions", () => {
  assert.throws(() => createTriviaQuiz({ questions: [] }), /at least five/);
});
