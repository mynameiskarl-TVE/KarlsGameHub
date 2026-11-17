export const SLOT_SYMBOLS = ["7", "BAR", "♦", "♥", "♣", "♠"];
const SLOT_WEIGHTS = [2, 3, 5, 6, 8, 8];
const SLOT_REWARDS = { "7": 100, BAR: 40, "♦": 20, "♥": 12, "♣": 9, "♠": 9 };

function chooseSymbol(random) {
  const total = SLOT_WEIGHTS.reduce((sum, value) => sum + value, 0);
  let roll = random() * total;
  for (let index = 0; index < SLOT_SYMBOLS.length; index += 1) {
    roll -= SLOT_WEIGHTS[index];
    if (roll < 0) return SLOT_SYMBOLS[index];
  }
  return SLOT_SYMBOLS[SLOT_SYMBOLS.length - 1];
}

export function spinSlots(random = Math.random) {
  if (typeof random !== "function") throw new TypeError("A random function is required.");
  const reels = [chooseSymbol(random), chooseSymbol(random), chooseSymbol(random)];
  const allMatch = reels[0] === reels[1] && reels[1] === reels[2];
  const pair = !allMatch && (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]);
  const reward = allMatch ? SLOT_REWARDS[reels[0]] : pair ? 5 : 0;
  const payoutMultiplier = allMatch
    ? ({ "7": 10, BAR: 5, "♦": 2, "♥": 1.5, "♣": 1.25, "♠": 1.25 }[reels[0]])
    : pair ? 0.5 : 0;
  return {
    reels,
    outcome: allMatch ? "jackpot" : pair ? "pair" : "no-match",
    reward,
    payoutMultiplier,
  };
}
