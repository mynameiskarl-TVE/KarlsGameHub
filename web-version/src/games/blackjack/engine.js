/**
 * Framework-independent Blackjack rules for Mini Arcade Hub.
 *
 * Cards are represented as [rank, suit], matching the original Python game.
 * The last card in the deck is drawn first, just like Python's list.pop().
 */

export const SUITS = ["♠", "♥", "♦", "♣"];
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function createDeck({ shuffle = true, random = Math.random } = {}) {
  const deck = SUITS.flatMap((suit) => RANKS.map((rank) => [rank, suit]));

  if (shuffle) {
    for (let index = deck.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
    }
  }

  return deck;
}

export function cardValue(card) {
  if (!Array.isArray(card) || card.length !== 2) {
    throw new TypeError("A card must be represented as [rank, suit].");
  }

  const [rank] = card;
  if (rank === "J" || rank === "Q" || rank === "K") return 10;
  if (rank === "A") return 11;

  const value = Number(rank);
  if (!Number.isInteger(value) || value < 2 || value > 10) {
    throw new TypeError(`Invalid card rank: ${String(rank)}`);
  }
  return value;
}

export function handValue(hand) {
  if (!Array.isArray(hand)) {
    throw new TypeError("A hand must be an array of cards.");
  }

  let total = hand.reduce((sum, card) => sum + cardValue(card), 0);
  let softAces = hand.filter(([rank]) => rank === "A").length;

  while (total > 21 && softAces > 0) {
    total -= 10;
    softAces -= 1;
  }

  return total;
}

function copyCard(card) {
  return [card[0], card[1]];
}

function copyRound(round) {
  return {
    ...round,
    deck: round.deck.map(copyCard),
    dealer: round.dealer.map(copyCard),
    playerHands: round.playerHands.map((hand) => hand.map(copyCard)),
    handBets: [...round.handBets],
    handStatuses: [...round.handStatuses],
    handDoubled: [...round.handDoubled],
    stats: { ...round.stats },
    result: round.result
      ? {
          ...round.result,
          hands: round.result.hands.map((hand) => ({ ...hand })),
        }
      : null,
  };
}

function drawCard(round) {
  return round.deck.pop();
}

function formatPoints(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function settleRound(round) {
  const dealerTotal = handValue(round.dealer);
  const dealerBlackjack = round.dealer.length === 2 && dealerTotal === 21;
  const outcomes = [];

  round.handStatuses = round.handStatuses.map((status) =>
    status === "playing" ? "stood" : status
  );

  round.playerHands.forEach((hand, index) => {
    const bet = round.handBets[index] ?? round.bet;
    const total = handValue(hand);
    const busted = round.handStatuses[index] === "bust" || total > 21;
    const naturalBlackjack =
      !round.splitUsed && index === 0 && hand.length === 2 && total === 21;

    let outcome;
    let payout = 0;
    let message;

    if (busted) {
      outcome = "bust";
      round.stats.losses += 1;
      message = `Bust — lose ${formatPoints(bet)} points`;
    } else if (naturalBlackjack && dealerBlackjack) {
      outcome = "push";
      payout = bet;
      round.stats.pushes += 1;
      message = `Push — ${formatPoints(bet)} points returned`;
    } else if (naturalBlackjack) {
      outcome = "natural";
      // Match the Python version's integer payout for a 3:2 natural.
      payout = Math.floor(bet * 2.5);
      round.stats.wins += 1;
      message = `Natural blackjack — receive ${formatPoints(payout)} points`;
    } else if (dealerBlackjack) {
      outcome = "dealer_blackjack";
      round.stats.losses += 1;
      message = `Dealer blackjack — lose ${formatPoints(bet)} points`;
    } else if (dealerTotal > 21 || total > dealerTotal) {
      outcome = "win";
      payout = bet * 2;
      round.stats.wins += 1;
      message = `Win — receive ${formatPoints(payout)} points`;
    } else if (total === dealerTotal) {
      outcome = "push";
      payout = bet;
      round.stats.pushes += 1;
      message = `Push — ${formatPoints(bet)} points returned`;
    } else {
      outcome = "dealer_win";
      round.stats.losses += 1;
      message = `Dealer wins — lose ${formatPoints(bet)} points`;
    }

    round.balance += payout;
    outcomes.push({
      handNumber: index + 1,
      outcome,
      bet,
      playerTotal: total,
      payout,
      message,
    });
  });

  round.roundActive = false;
  round.result = {
    hands: outcomes,
    dealerTotal,
    dealerBlackjack,
    dealerBust: dealerTotal > 21,
    message:
      outcomes.length === 1
        ? `Hand 1: ${outcomes[0].message}`
        : `Split round complete:\n${outcomes.map((item) => `Hand ${item.handNumber}: ${item.message}`).join("\n")}`,
  };

  return round;
}

function finishPlayerHands(round) {
  if (!round.roundActive || round.handStatuses.includes("playing")) return round;

  // As in the Python game, the dealer does not draw if every player hand busted.
  if (round.handStatuses.some((status) => status !== "bust")) {
    while (handValue(round.dealer) < 17 && round.deck.length > 0) {
      round.dealer.push(drawCard(round));
    }
  }

  return settleRound(round);
}

function advanceAfterHand(round) {
  const nextIndex = round.handStatuses.findIndex(
    (status, index) => index > round.activeHandIndex && status === "playing"
  );

  if (nextIndex === -1) return finishPlayerHands(round);

  round.activeHandIndex = nextIndex;
  return round;
}

function assertActiveHand(round) {
  if (!round || !round.roundActive) {
    throw new Error("There is no active Blackjack round.");
  }

  const index = round.activeHandIndex;
  if (
    index < 0 ||
    index >= round.playerHands.length ||
    round.handStatuses[index] !== "playing"
  ) {
    throw new Error("There is no player hand waiting for an action.");
  }

  return index;
}

export function startRound({ balance, bet, deck = createDeck() }) {
  if (!Number.isSafeInteger(balance) || balance < 0) {
    throw new TypeError("The point balance must be a non-negative whole number.");
  }
  if (!Number.isSafeInteger(bet) || bet < 1) {
    throw new RangeError("Enter a whole-number bet of at least 1 point.");
  }
  if (bet > balance) {
    throw new RangeError("Your bet cannot be higher than your point balance.");
  }
  if (!Array.isArray(deck) || deck.length < 4) {
    throw new RangeError("The deck needs at least four cards to start a round.");
  }

  const round = {
    balance: balance - bet,
    bet,
    deck: deck.map(copyCard),
    dealer: [],
    playerHands: [[]],
    handBets: [bet],
    handStatuses: ["playing"],
    handDoubled: [false],
    activeHandIndex: 0,
    splitUsed: false,
    roundActive: true,
    result: null,
    stats: { wins: 0, losses: 0, pushes: 0 },
  };

  round.playerHands[0] = [drawCard(round), drawCard(round)];
  round.dealer = [drawCard(round), drawCard(round)];

  // An original two-card 21 settles immediately, after checking dealer blackjack.
  if (handValue(round.playerHands[0]) === 21) {
    settleRound(round);
  }

  return round;
}

export function hit(currentRound) {
  const round = copyRound(currentRound);
  const index = assertActiveHand(round);
  const hand = round.playerHands[index];

  if (round.deck.length === 0) {
    round.handStatuses[index] = "stood";
  } else {
    hand.push(drawCard(round));
    const total = handValue(hand);
    if (total > 21) round.handStatuses[index] = "bust";
    else if (total === 21) round.handStatuses[index] = "stood";
  }

  if (round.handStatuses[index] !== "playing") return advanceAfterHand(round);
  return round;
}

export function stand(currentRound) {
  const round = copyRound(currentRound);
  const index = assertActiveHand(round);
  round.handStatuses[index] = "stood";
  return advanceAfterHand(round);
}

export function split(currentRound) {
  const round = copyRound(currentRound);
  const index = assertActiveHand(round);
  const original = round.playerHands[index];

  if (
    round.splitUsed ||
    round.playerHands.length !== 1 ||
    original.length !== 2 ||
    cardValue(original[0]) !== cardValue(original[1]) ||
    round.balance < round.bet ||
    round.deck.length < 2
  ) {
    throw new Error("This hand cannot be split.");
  }

  round.balance -= round.bet;
  const isSplitAces = cardValue(original[0]) === 11;
  round.playerHands = [
    [original[0], drawCard(round)],
    [original[1], drawCard(round)],
  ];
  round.handBets = [round.bet, round.bet];
  round.handStatuses = ["playing", "playing"];
  round.handDoubled = [false, false];
  round.splitUsed = true;

  // Split Aces receive exactly one card each. Any split hand reaching 21 stands.
  round.playerHands.forEach((hand, handIndex) => {
    if (isSplitAces || handValue(hand) === 21) {
      round.handStatuses[handIndex] = "stood";
    }
  });

  const nextIndex = round.handStatuses.findIndex((status) => status === "playing");
  if (nextIndex === -1) {
    round.activeHandIndex = 0;
    return finishPlayerHands(round);
  }

  round.activeHandIndex = nextIndex;
  return round;
}

export function doubleDown(currentRound) {
  const round = copyRound(currentRound);
  const index = assertActiveHand(round);
  const hand = round.playerHands[index];
  const extraBet = round.handBets[index];

  if (
    hand.length !== 2 ||
    round.handDoubled[index] ||
    round.balance < extraBet ||
    round.deck.length === 0
  ) {
    throw new Error("This hand cannot be doubled down.");
  }

  round.balance -= extraBet;
  round.handBets[index] *= 2;
  round.handDoubled[index] = true;
  hand.push(drawCard(round));
  round.handStatuses[index] = handValue(hand) > 21 ? "bust" : "stood";

  return advanceAfterHand(round);
}

export function getControls(round) {
  if (!round) {
    return {
      canDeal: true,
      canHit: false,
      canStand: false,
      canSplit: false,
      canDouble: false,
      canClear: false,
    };
  }

  const index = round.activeHandIndex;
  const handExists = index >= 0 && index < round.playerHands.length;
  const hand = handExists ? round.playerHands[index] : [];
  const isPlaying =
    round.roundActive && handExists && round.handStatuses[index] === "playing";
  const handBet = handExists ? round.handBets[index] : 0;

  return {
    canDeal: !round.roundActive,
    canHit: isPlaying && round.deck.length > 0 && handValue(hand) < 21,
    canStand: isPlaying,
    canSplit:
      isPlaying &&
      !round.splitUsed &&
      round.playerHands.length === 1 &&
      hand.length === 2 &&
      cardValue(hand[0]) === cardValue(hand[1]) &&
      round.balance >= round.bet &&
      round.deck.length >= 2,
    canDouble:
      isPlaying &&
      hand.length === 2 &&
      !round.handDoubled[index] &&
      round.balance >= handBet &&
      round.deck.length > 0,
    canClear: !round.roundActive,
  };
}
