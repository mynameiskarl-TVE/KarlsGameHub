export const COIN_SIDES = ["Heads", "Tails"];

export function flipCoin(guess, random = Math.random) {
  if (!COIN_SIDES.includes(guess)) throw new RangeError("Choose Heads or Tails.");
  if (typeof random !== "function") throw new TypeError("A random function is required.");
  const result = random() < 0.5 ? "Heads" : "Tails";
  const won = guess === result;
  return {
    guess,
    result,
    won,
    reward: won ? 10 : 0,
  };
}
