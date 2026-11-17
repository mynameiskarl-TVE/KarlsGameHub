export const TRIVIA_REWARD = 5;
export const PERFECT_QUIZ_BONUS = 10;
export const QUESTIONS_PER_QUIZ = 5;

export const TRIVIA_QUESTIONS = [
  { question: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Mercury"], answer: 1 },
  { question: "How many sides does a hexagon have?", options: ["Five", "Six", "Seven", "Eight"], answer: 1 },
  { question: "What is the largest ocean on Earth?", options: ["Atlantic", "Indian", "Pacific", "Arctic"], answer: 2 },
  { question: "Which animal is the largest living land animal?", options: ["Giraffe", "Hippo", "African elephant", "Rhino"], answer: 2 },
  { question: "What is H2O commonly called?", options: ["Oxygen", "Hydrogen", "Salt", "Water"], answer: 3 },
  { question: "How many minutes are in two hours?", options: ["90", "100", "120", "140"], answer: 2 },
  { question: "Which instrument usually has 88 keys?", options: ["Violin", "Piano", "Flute", "Trumpet"], answer: 1 },
  { question: "What is the process plants use to make food from sunlight?", options: ["Evaporation", "Photosynthesis", "Digestion", "Condensation"], answer: 1 },
  { question: "Which is the closest star to Earth?", options: ["Sirius", "Polaris", "The Sun", "Vega"], answer: 2 },
  { question: "What is 9 × 7?", options: ["56", "63", "72", "79"], answer: 1 },
  { question: "Which continent is the Sahara Desert in?", options: ["Asia", "Africa", "Australia", "South America"], answer: 1 },
  { question: "What do bees collect from flowers?", options: ["Nectar", "Sand", "Bark", "Dew only"], answer: 0 },
];

function shuffle(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function createTriviaQuiz({
  questions = TRIVIA_QUESTIONS,
  random = Math.random,
  rewardPerCorrect = TRIVIA_REWARD,
  perfectBonus = PERFECT_QUIZ_BONUS,
} = {}) {
  if (!Array.isArray(questions) || questions.length < QUESTIONS_PER_QUIZ) {
    throw new RangeError("A quiz needs at least five questions.");
  }
  if (!Number.isSafeInteger(rewardPerCorrect) || rewardPerCorrect < 0 ||
      !Number.isSafeInteger(perfectBonus) || perfectBonus < 0) {
    throw new RangeError("Trivia rewards must be non-negative whole numbers.");
  }

  const selected = shuffle(questions, random).slice(0, QUESTIONS_PER_QUIZ);
  return {
    questions: selected.map((item) => ({
      question: item.question,
      options: [...item.options],
      answer: item.answer,
    })),
    questionIndex: 0,
    score: 0,
    correctAnswers: 0,
    rewardPerCorrect,
    perfectBonus,
    active: true,
    lastAnswer: null,
    result: null,
  };
}

export function answerTriviaQuestion(quiz, selectedOption) {
  if (!quiz || typeof quiz !== "object") {
    throw new TypeError("Start a trivia quiz first.");
  }
  if (!quiz.active) {
    throw new Error("This quiz is complete. Start another quiz to play again.");
  }

  const current = quiz.questions[quiz.questionIndex];
  if (!current) {
    throw new Error("There is no unanswered question.");
  }
  if (!Number.isSafeInteger(selectedOption) ||
      selectedOption < 0 ||
      selectedOption >= current.options.length) {
    throw new RangeError("Choose one of the available answers.");
  }

  const correct = selectedOption === current.answer;
  const correctAnswers = quiz.correctAnswers + (correct ? 1 : 0);
  const questionIndex = quiz.questionIndex + 1;
  const completed = questionIndex >= QUESTIONS_PER_QUIZ;
  const bonus = completed && correctAnswers === QUESTIONS_PER_QUIZ
    ? quiz.perfectBonus
    : 0;
  const earnedNow = (correct ? quiz.rewardPerCorrect : 0) + bonus;

  return {
    ...quiz,
    questionIndex,
    correctAnswers,
    score: quiz.score + (correct ? 1 : 0),
    active: !completed,
    lastAnswer: {
      selectedOption,
      correct,
      correctText: current.options[current.answer],
      earnedNow,
      message: correct
        ? `Correct! +${quiz.rewardPerCorrect} points.`
        : `Not quite — the answer was ${current.options[current.answer]}.`,
    },
    result: completed
      ? {
          correctAnswers,
          totalQuestions: QUESTIONS_PER_QUIZ,
          perfectBonus: bonus,
          totalBonus: bonus,
          message: `Quiz complete: ${correctAnswers}/5 correct. Bonus: +${bonus}.`,
        }
      : null,
  };
}
