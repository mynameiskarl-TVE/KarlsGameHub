export const TRIVIA_REWARD = 5;
export const PERFECT_QUIZ_BONUS = 10;
export const QUESTIONS_PER_QUIZ = 5;

// One quiz per day. The server enforces the daily limit and the same maximum bet (see
// supabase_trivia_daily_setup.sql); keep TRIVIA_MAX_BET equal to c_max_bet there and to
// TRIVIA_MAX_BET in the desktop trivia_daily.py.
export const TRIVIA_MAX_BET = 2500;

// Bet payout: the total you get back for a bet, as a multiple of the bet, by number of correct
// answers (index = correct answers, 0 to 5). 3 correct returns your bet; fewer loses some or all.
// A bet of 0 plays the classic quiz instead (5 points per correct answer, 2 points per wrong one).
export const TRIVIA_PAYOUT_MULTIPLIERS = [0, 0, 0.5, 1, 2, 3];

// The 25 questions. `answer` is the index of the correct option in `options` as written here;
// createTriviaQuiz shuffles the options for every quiz so the right answer is not always in
// the same place.
export const TRIVIA_QUESTIONS = [
  { difficulty: "easy", question: "Which planet has the shortest day in our solar system?", options: ["Mars", "Jupiter", "Mercury", "Venus"], answer: 1 },
  { difficulty: "easy", question: "What is the smallest country in the world by area?", options: ["Monaco", "San Marino", "Vatican City", "Liechtenstein"], answer: 2 },
  { difficulty: "easy", question: "Which animal has three hearts?", options: ["Shark", "Octopus", "Dolphin", "Crocodile"], answer: 1 },
  { difficulty: "easy", question: "What is the chemical symbol for potassium?", options: ["P", "Po", "K", "Pt"], answer: 2 },
  { difficulty: "easy", question: "Which ocean is the deepest?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], answer: 3 },
  { difficulty: "medium", question: "What is the only mammal capable of true sustained flight?", options: ["Flying squirrel", "Sugar glider", "Bat", "Colugo"], answer: 2 },
  { difficulty: "medium", question: "Which country has the most natural lakes?", options: ["Russia", "Canada", "Finland", "United States"], answer: 1 },
  { difficulty: "medium", question: "What is the name of the boundary around a black hole beyond which nothing can escape?", options: ["Photon sphere", "Event horizon", "Singularity line", "Schwarzschild ring"], answer: 1 },
  { difficulty: "medium", question: "Which element has the atomic number 74?", options: ["Tungsten", "Osmium", "Rhenium", "Iridium"], answer: 0 },
  { difficulty: "medium", question: "What is the largest moon of Saturn?", options: ["Enceladus", "Rhea", "Titan", "Iapetus"], answer: 2 },
  { difficulty: "medium", question: "Which ancient civilization developed the earliest known writing system, cuneiform?", options: ["Ancient Egyptians", "Sumerians", "Phoenicians", "Minoans"], answer: 1 },
  { difficulty: "hard", question: "What is the SI unit of catalytic activity?", options: ["Sievert", "Katal", "Tesla", "Weber"], answer: 1 },
  { difficulty: "hard", question: "Which mathematician is associated with the incompleteness theorems?", options: ["Alan Turing", "Kurt Gödel", "David Hilbert", "Bertrand Russell"], answer: 1 },
  { difficulty: "hard", question: "What is the rarest naturally occurring stable isotope of an element?", options: ["Tantalum-180m", "Tellurium-128", "Xenon-124", "Indium-113"], answer: 0 },
  { difficulty: "hard", question: "Which country was formerly known as Dahomey?", options: ["Togo", "Benin", "Gabon", "Burkina Faso"], answer: 1 },
  { difficulty: "hard", question: "What is the deepest known point in Earth's oceans?", options: ["Java Trench", "Tonga Trench", "Challenger Deep", "Horizon Deep"], answer: 2 },
  { difficulty: "hard", question: "Which composer wrote the orchestral work 'The Planets'?", options: ["Claude Debussy", "Gustav Holst", "Richard Strauss", "Edward Elgar"], answer: 1 },
  { difficulty: "very hard", question: "Which moon in our solar system has lakes and seas of liquid hydrocarbons on its surface?", options: ["Europa", "Titan", "Triton", "Ganymede"], answer: 1 },
  { difficulty: "very hard", question: "What is the name of the mathematical constant equal to the limit of (1 + 1/n)^n as n approaches infinity?", options: ["Pi", "Euler's number", "Golden ratio", "Apéry's constant"], answer: 1 },
  { difficulty: "very hard", question: "Which element was first discovered in the spectrum of the Sun before it was found on Earth?", options: ["Neon", "Helium", "Argon", "Krypton"], answer: 1 },
  { difficulty: "very hard", question: "What is the capital of the ancient Achaemenid Persian Empire most closely associated with Darius I?", options: ["Babylon", "Susa", "Persepolis", "Ecbatana"], answer: 2 },
  { difficulty: "very hard", question: "Which scientist introduced the concept of entropy in thermodynamics?", options: ["James Clerk Maxwell", "Rudolf Clausius", "Michael Faraday", "Lord Kelvin"], answer: 1 },
  { difficulty: "very hard", question: "What is the name of the largest known volcano in the solar system?", options: ["Mauna Loa", "Olympus Mons", "Elysium Mons", "Ascraeus Mons"], answer: 1 },
  { difficulty: "very hard", question: "Which language family does Hungarian belong to?", options: ["Slavic", "Germanic", "Uralic", "Turkic"], answer: 2 },
  { difficulty: "very hard", question: "In biology, what is the name of the organelle responsible for modifying, sorting, and packaging proteins?", options: ["Lysosome", "Golgi apparatus", "Ribosome", "Peroxisome"], answer: 1 },
];

function shuffle(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

/** Total points returned for a bet, given how many of the five questions were answered correctly. */
export function triviaPayout(bet, correctAnswers) {
  if (!Number.isSafeInteger(bet) || bet < 0) return 0;
  const index = Math.max(0, Math.min(QUESTIONS_PER_QUIZ, Number.isSafeInteger(correctAnswers) ? correctAnswers : 0));
  return Math.floor(bet * TRIVIA_PAYOUT_MULTIPLIERS[index]);
}

/**
 * Check a bet before a game starts. Returns the bet as a whole number, or throws a RangeError whose
 * message can be shown to the player. 0 means "no bet" (the classic quiz).
 */
export function validateTriviaBet(bet, balance = Infinity) {
  const value = typeof bet === "string" ? (bet.trim() === "" ? 0 : Number(bet)) : bet;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError("Enter your bet as a whole number of points, or 0 for no bet.");
  }
  if (value > TRIVIA_MAX_BET) {
    throw new RangeError(`The maximum bet is ${TRIVIA_MAX_BET.toLocaleString("en-US")} points.`);
  }
  if (value > balance) {
    throw new RangeError("You do not have that many points to bet.");
  }
  return value;
}

export function createTriviaQuiz({
  questions = TRIVIA_QUESTIONS,
  random = Math.random,
  rewardPerCorrect = TRIVIA_REWARD,
  perfectBonus = PERFECT_QUIZ_BONUS,
  bet = 0,
} = {}) {
  if (!Array.isArray(questions)) {
    throw new RangeError("A quiz needs at least five questions.");
  }
  // Never let the same question appear twice in one quiz, even if the bank repeats one.
  const seen = new Set();
  const unique = questions.filter((item) => {
    const key = String(item?.question ?? "").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (unique.length < QUESTIONS_PER_QUIZ) {
    throw new RangeError("A quiz needs at least five questions.");
  }
  if (!Number.isSafeInteger(rewardPerCorrect) || rewardPerCorrect < 0 ||
      !Number.isSafeInteger(perfectBonus) || perfectBonus < 0) {
    throw new RangeError("Trivia rewards must be non-negative whole numbers.");
  }
  const safeBet = validateTriviaBet(bet);

  const selected = shuffle(unique, random).slice(0, QUESTIONS_PER_QUIZ);
  return {
    questions: selected.map((item) => {
      // Shuffle the options but remember which one is correct.
      const order = shuffle(item.options.map((_, optionIndex) => optionIndex), random);
      return {
        question: item.question,
        options: order.map((optionIndex) => item.options[optionIndex]),
        answer: order.indexOf(item.answer),
      };
    }),
    questionIndex: 0,
    score: 0,
    correctAnswers: 0,
    rewardPerCorrect,
    perfectBonus,
    bet: safeBet,
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

  const bet = Number.isSafeInteger(quiz.bet) && quiz.bet > 0 ? quiz.bet : 0;
  const correct = selectedOption === current.answer;
  const correctAnswers = quiz.correctAnswers + (correct ? 1 : 0);
  const questionIndex = quiz.questionIndex + 1;
  const completed = questionIndex >= QUESTIONS_PER_QUIZ;

  // Classic quiz (no bet): points per correct answer plus a bonus for a perfect score.
  // Bet quiz: nothing is paid per answer; the payout for the whole bet comes at the end.
  const bonus = !bet && completed && correctAnswers === QUESTIONS_PER_QUIZ ? quiz.perfectBonus : 0;
  const payout = bet && completed ? triviaPayout(bet, correctAnswers) : 0;
  const earnedNow = bet ? payout : (correct ? quiz.rewardPerCorrect : 0) + bonus;

  let message;
  if (bet) {
    message = correct ? "Correct!" : `Not quite — the answer was ${current.options[current.answer]}.`;
  } else {
    message = correct
      ? `Correct! +${quiz.rewardPerCorrect} points.`
      : `Not quite — the answer was ${current.options[current.answer]}.`;
  }

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
      message,
    },
    result: completed
      ? {
          correctAnswers,
          totalQuestions: QUESTIONS_PER_QUIZ,
          perfectBonus: bonus,
          totalBonus: bonus,
          bet,
          payout,
          net: bet ? payout - bet : null,
          message: bet
            ? `Quiz complete: ${correctAnswers}/5 correct. Bet ${bet}, paid back ${payout}.`
            : `Quiz complete: ${correctAnswers}/5 correct. Bonus: +${bonus}.`,
        }
      : null,
  };
}
