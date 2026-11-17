export const CARD_SUITS = ["♠", "♥", "♦", "♣"];
export const CARD_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function shuffle(cards, random) {
  const deck = cards.slice();
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function cardPoints(card) {
  if (!card || !CARD_RANKS.includes(card.rank)) throw new TypeError("Invalid card.");
  if (card.rank === "A") return 11;
  if (["J", "Q", "K"].includes(card.rank)) return 10;
  return Number(card.rank);
}

export function handValue(hand) {
  let total = hand.reduce((sum, card) => sum + cardPoints(card), 0);
  let aces = hand.filter((card) => card.rank === "A").length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

function makeDeck(random) {
  const cards = CARD_SUITS.flatMap((suit) => CARD_RANKS.map((rank) => ({ rank, suit })));
  return shuffle(cards, random);
}

function draw(round) {
  if (!round.deck.length) throw new Error("The deck is empty. Start a new round.");
  const deck = round.deck.slice();
  const card = deck.pop();
  return { ...round, deck, drawnCard: card };
}

function isNatural(hand) {
  return hand.length === 2 && handValue(hand) === 21;
}

function settle(round) {
  const next = { ...round, phase: "complete", dealer: round.dealer.slice() };
  while (handValue(next.dealer) < 17 && next.deck.length) {
    const card = next.deck[next.deck.length - 1];
    next.deck = next.deck.slice(0, -1);
    next.dealer = next.dealer.concat(card);
  }

  const dealerTotal = handValue(next.dealer);
  const dealerNatural = isNatural(next.dealer);
  const outcomes = next.hands.map((hand, index) => {
    const total = handValue(hand);
    const natural = index === 0 && !next.splitUsed && isNatural(hand);
    if (total > 21) return { outcome: "bust", total, reward: 0 };
    if (natural && !dealerNatural) return { outcome: "natural", total, reward: 35 };
    if (dealerTotal > 21 || total > dealerTotal) return { outcome: "win", total, reward: 25 };
    if (total === dealerTotal) return { outcome: "push", total, reward: 5 };
    return { outcome: "loss", total, reward: 0 };
  });

  next.outcomes = outcomes;
  next.reward = outcomes.reduce((sum, item) => sum + item.reward, 0);
  next.result = {
    wins: outcomes.filter((item) => item.outcome === "win" || item.outcome === "natural").length,
    losses: outcomes.filter((item) => item.outcome === "loss" || item.outcome === "bust").length,
    pushes: outcomes.filter((item) => item.outcome === "push").length,
    reward: next.reward,
  };
  return next;
}

function advance(round) {
  const nextIndex = round.handStatus.findIndex((status, index) => index > round.activeHand && status === "playing");
  if (nextIndex >= 0) return { ...round, activeHand: nextIndex };
  return settle(round);
}

export function startBlackjackRound(random = Math.random) {
  if (typeof random !== "function") throw new TypeError("A random function is required.");
  const deck = makeDeck(random);
  const player = [deck.pop(), deck.pop()];
  const dealer = [deck.pop(), deck.pop()];
  const round = {
    deck,
    hands: [player],
    dealer,
    handStatus: ["playing"],
    activeHand: 0,
    splitUsed: false,
    phase: "playing",
    outcomes: [],
    reward: 0,
    result: null,
  };

  if (isNatural(player) || isNatural(dealer)) return settle(round);
  return round;
}

export function hitBlackjack(round) {
  if (!round || round.phase !== "playing") throw new Error("There is no active Blackjack round.");
  const index = round.activeHand;
  if (round.handStatus[index] !== "playing") throw new Error("This hand has already finished.");
  const next = { ...round, hands: round.hands.map((hand) => hand.slice()), handStatus: round.handStatus.slice() };
  const card = next.deck.pop();
  if (!card) throw new Error("The deck is empty.");
  next.hands[index].push(card);
  const total = handValue(next.hands[index]);
  if (total > 21) {
    next.handStatus[index] = "bust";
    return advance(next);
  }
  if (total === 21) {
    next.handStatus[index] = "stood";
    return advance(next);
  }
  return next;
}

export function standBlackjack(round) {
  if (!round || round.phase !== "playing") throw new Error("There is no active Blackjack round.");
  if (round.handStatus[round.activeHand] !== "playing") throw new Error("This hand has already finished.");
  const next = { ...round, handStatus: round.handStatus.slice() };
  next.handStatus[next.activeHand] = "stood";
  return advance(next);
}

export function doubleBlackjack(round) {
  if (!round || round.phase !== "playing") throw new Error("There is no active Blackjack round.");
  const index = round.activeHand;
  if (round.handStatus[index] !== "playing" || round.hands[index].length !== 2) {
    throw new Error("Double is available only on the first two cards of a hand.");
  }
  const next = { ...round, hands: round.hands.map((hand) => hand.slice()), handStatus: round.handStatus.slice() };
  const card = next.deck.pop();
  if (!card) throw new Error("The deck is empty.");
  next.hands[index].push(card);
  next.handStatus[index] = handValue(next.hands[index]) > 21 ? "bust" : "stood";
  return advance(next);
}

export function splitBlackjack(round) {
  if (!round || round.phase !== "playing") throw new Error("There is no active Blackjack round.");
  if (round.splitUsed || round.hands.length !== 1) throw new Error("Only one split is allowed per round.");
  const original = round.hands[0];
  if (original.length !== 2 || cardPoints(original[0]) !== cardPoints(original[1])) {
    throw new Error("Split requires two cards of the same value.");
  }
  if (round.deck.length < 2) throw new Error("Not enough cards remain to split.");

  const deck = round.deck.slice();
  const first = [original[0], deck.pop()];
  const second = [original[1], deck.pop()];
  const splitAces = original[0].rank === "A";
  const hands = [first, second];
  const handStatus = hands.map((hand) => splitAces || handValue(hand) === 21 ? "stood" : "playing");
  const next = {
    ...round,
    deck,
    hands,
    handStatus,
    activeHand: handStatus[0] === "playing" ? 0 : handStatus[1] === "playing" ? 1 : 0,
    splitUsed: true,
  };
  if (handStatus.every((status) => status !== "playing")) return settle(next);
  return next;
}
