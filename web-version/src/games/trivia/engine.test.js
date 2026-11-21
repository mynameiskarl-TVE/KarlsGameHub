import test from "node:test";
import assert from "node:assert/strict";
import {
  createTriviaQuiz,
  answerTriviaQuestion,
  triviaPayout,
  validateTriviaBet,
  TRIVIA_QUESTIONS,
  QUESTIONS_PER_QUIZ,
  TRIVIA_REWARD,
  PERFECT_QUIZ_BONUS,
  TRIVIA_MAX_BET,
  TRIVIA_PAYOUT_MULTIPLIERS,
} from "./engine.js";

const allCorrectRandom = () => 0.999999;

test("the question bank contains the 25 supplied questions and a quiz starts five at a time", () => {
  assert.equal(TRIVIA_QUESTIONS.length, 25);
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

// ---------------------------------------------------------------------------
// v10.11: the 25-question bank, no repeats within a quiz, and bets.
// ---------------------------------------------------------------------------

// The correct answer for every supplied question, written out in words so a typo in the bank
// (or an answer pointing at the wrong option) is caught.
const EXPECTED_ANSWERS = {
  "Which planet has the shortest day in our solar system?": "Jupiter",
  "What is the smallest country in the world by area?": "Vatican City",
  "Which animal has three hearts?": "Octopus",
  "What is the chemical symbol for potassium?": "K",
  "Which ocean is the deepest?": "Pacific",
  "What is the only mammal capable of true sustained flight?": "Bat",
  "Which country has the most natural lakes?": "Canada",
  "What is the name of the boundary around a black hole beyond which nothing can escape?": "Event horizon",
  "Which element has the atomic number 74?": "Tungsten",
  "What is the largest moon of Saturn?": "Titan",
  "Which ancient civilization developed the earliest known writing system, cuneiform?": "Sumerians",
  "What is the SI unit of catalytic activity?": "Katal",
  "Which mathematician is associated with the incompleteness theorems?": "Kurt Gödel",
  "What is the rarest naturally occurring stable isotope of an element?": "Tantalum-180m",
  "Which country was formerly known as Dahomey?": "Benin",
  "What is the deepest known point in Earth's oceans?": "Challenger Deep",
  "Which composer wrote the orchestral work 'The Planets'?": "Gustav Holst",
  "Which moon in our solar system has lakes and seas of liquid hydrocarbons on its surface?": "Titan",
  "What is the name of the mathematical constant equal to the limit of (1 + 1/n)^n as n approaches infinity?": "Euler's number",
  "Which element was first discovered in the spectrum of the Sun before it was found on Earth?": "Helium",
  "What is the capital of the ancient Achaemenid Persian Empire most closely associated with Darius I?": "Persepolis",
  "Which scientist introduced the concept of entropy in thermodynamics?": "Rudolf Clausius",
  "What is the name of the largest known volcano in the solar system?": "Olympus Mons",
  "Which language family does Hungarian belong to?": "Uralic",
  "In biology, what is the name of the organelle responsible for modifying, sorting, and packaging proteins?": "Golgi apparatus",
};

test("every supplied question is in the bank exactly once with the supplied correct answer", () => {
  assert.equal(Object.keys(EXPECTED_ANSWERS).length, 25);
  const texts = TRIVIA_QUESTIONS.map((item) => item.question);
  assert.equal(new Set(texts).size, texts.length, "the bank repeats a question");
  assert.deepEqual([...texts].sort(), Object.keys(EXPECTED_ANSWERS).sort());
  for (const item of TRIVIA_QUESTIONS) {
    assert.equal(item.options.length, 4, item.question);
    assert.equal(new Set(item.options).size, 4, `${item.question} has a repeated option`);
    assert.ok(Number.isInteger(item.answer) && item.answer >= 0 && item.answer < 4, item.question);
    assert.equal(item.options[item.answer], EXPECTED_ANSWERS[item.question], item.question);
  }
});

test("the old twelve questions are gone", () => {
  const texts = new Set(TRIVIA_QUESTIONS.map((item) => item.question));
  assert.equal(texts.has("Which planet is known as the Red Planet?"), false);
  assert.equal(texts.has("What is 9 × 7?"), false);
});

test("a quiz never repeats a question, over many random quizzes", () => {
  for (let run = 0; run < 2000; run += 1) {
    const quiz = createTriviaQuiz();
    const texts = quiz.questions.map((item) => item.question);
    assert.equal(texts.length, QUESTIONS_PER_QUIZ);
    assert.equal(new Set(texts).size, QUESTIONS_PER_QUIZ);
  }
});

test("a quiz drops repeated questions if a bank ever contains duplicates", () => {
  const bank = [
    { question: "A?", options: ["1", "2", "3", "4"], answer: 0 },
    { question: "a?", options: ["1", "2", "3", "4"], answer: 0 },
    { question: "B?", options: ["1", "2", "3", "4"], answer: 1 },
    { question: "C?", options: ["1", "2", "3", "4"], answer: 2 },
    { question: "D?", options: ["1", "2", "3", "4"], answer: 3 },
  ];
  // Five entries but only four different questions: not enough for a quiz.
  assert.throws(() => createTriviaQuiz({ questions: bank }), /at least five/);
});

test("options are shuffled but the correct answer always points at the right text", () => {
  const seenPositions = new Set();
  for (let run = 0; run < 500; run += 1) {
    const quiz = createTriviaQuiz();
    for (const item of quiz.questions) {
      assert.equal(item.options[item.answer], EXPECTED_ANSWERS[item.question], item.question);
      assert.equal(item.options.length, 4);
      seenPositions.add(item.answer);
    }
  }
  assert.deepEqual([...seenPositions].sort(), [0, 1, 2, 3]);
});

test("the supplied key is not always the same letter once options are shuffled", () => {
  // In the supplied list 15 of the 25 answers are option B. Shuffling must remove that pattern.
  let b = 0;
  let total = 0;
  for (let run = 0; run < 400; run += 1) {
    for (const item of createTriviaQuiz().questions) {
      total += 1;
      if (item.answer === 1) b += 1;
    }
  }
  assert.ok(b / total < 0.4, `option B was correct ${((b / total) * 100).toFixed(0)}% of the time`);
});

test("the maximum bet is 2,500", () => {
  assert.equal(TRIVIA_MAX_BET, 2500);
  assert.equal(validateTriviaBet(2500), 2500);
  assert.equal(validateTriviaBet("2500"), 2500);
  assert.equal(validateTriviaBet(0), 0);
  assert.equal(validateTriviaBet(""), 0);
  assert.throws(() => validateTriviaBet(2501), /maximum bet is 2,500/);
  assert.throws(() => createTriviaQuiz({ bet: 2501 }), /maximum bet/);
});

test("invalid bets are rejected", () => {
  for (const bad of [-1, 1.5, "abc", NaN, Infinity, null, undefined, {}, "1e3x"]) {
    if (bad === undefined) continue; // undefined falls back to "no bet" in createTriviaQuiz only
    assert.throws(() => validateTriviaBet(bad), RangeError, String(bad));
  }
  assert.throws(() => validateTriviaBet(600, 500), /do not have that many points/);
  assert.equal(validateTriviaBet(500, 500), 500);
});

test("payouts follow the table and never pay out more than the table says", () => {
  assert.deepEqual(TRIVIA_PAYOUT_MULTIPLIERS, [0, 0, 0.5, 1, 2, 3]);
  assert.equal(triviaPayout(1000, 5), 3000);
  assert.equal(triviaPayout(1000, 4), 2000);
  assert.equal(triviaPayout(1000, 3), 1000);
  assert.equal(triviaPayout(1000, 2), 500);
  assert.equal(triviaPayout(1000, 1), 0);
  assert.equal(triviaPayout(1000, 0), 0);
  assert.equal(triviaPayout(2500, 5), 7500);
  assert.equal(triviaPayout(1, 2), 0); // rounds down, never up
  assert.equal(triviaPayout(0, 5), 0);
  assert.equal(triviaPayout(-5, 5), 0);
});

function playQuiz(quiz, correctCount) {
  let current = quiz;
  const awarded = [];
  for (let index = 0; index < QUESTIONS_PER_QUIZ; index += 1) {
    const question = current.questions[current.questionIndex];
    const pick = index < correctCount ? question.answer : (question.answer + 1) % question.options.length;
    current = answerTriviaQuestion(current, pick);
    awarded.push(current.lastAnswer.earnedNow);
  }
  return { finished: current, awarded };
}

test("a bet quiz pays nothing per answer and pays the whole payout at the end", () => {
  const { finished, awarded } = playQuiz(createTriviaQuiz({ bet: 1000, random: allCorrectRandom }), 4);
  assert.deepEqual(awarded, [0, 0, 0, 0, 2000]);
  assert.equal(finished.result.bet, 1000);
  assert.equal(finished.result.payout, 2000);
  assert.equal(finished.result.net, 1000);
  assert.equal(finished.result.perfectBonus, 0);
  assert.equal(finished.active, false);
});

test("a perfect bet quiz pays three times the bet, and losing returns nothing", () => {
  assert.equal(playQuiz(createTriviaQuiz({ bet: 2500 }), 5).finished.result.payout, 7500);
  const lost = playQuiz(createTriviaQuiz({ bet: 2500 }), 1).finished.result;
  assert.equal(lost.payout, 0);
  assert.equal(lost.net, -2500);
  const even = playQuiz(createTriviaQuiz({ bet: 400 }), 3).finished.result;
  assert.equal(even.payout, 400);
  assert.equal(even.net, 0);
});

test("a quiz with no bet still plays exactly like the classic quiz", () => {
  const { finished, awarded } = playQuiz(createTriviaQuiz({ random: allCorrectRandom }), 5);
  assert.deepEqual(awarded, [5, 5, 5, 5, 15]);
  assert.equal(finished.result.payout, 0);
  assert.equal(finished.result.net, null);
  assert.equal(finished.result.message, "Quiz complete: 5/5 correct. Bonus: +10.");
});
