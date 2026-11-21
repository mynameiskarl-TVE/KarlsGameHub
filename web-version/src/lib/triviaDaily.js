// Talks to the server about the daily Trivia limit (see supabase_trivia_daily_setup.sql).
// The SERVER decides whether today's game is still available, using its own clock. This file
// never looks at the player's clock to decide that; it only counts down the seconds the
// server reported, using a timer that does not depend on the computer's date and time.

import { TRIVIA_MAX_BET } from "../games/trivia/engine.js";

const MAX_SECONDS_PER_DAY = 24 * 60 * 60;

function safeSeconds(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(Math.ceil(number), MAX_SECONDS_PER_DAY);
}

/** Turn the server's JSON into a plain, safe object. Anything unreadable means "cannot play". */
export function normalizeTriviaState(data) {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return { canPlay: false, secondsUntilReset: 0, maxBet: TRIVIA_MAX_BET, playDay: "" };
  }
  const serverMax = Number(row.max_bet);
  return {
    canPlay: row.can_play === true,
    secondsUntilReset: safeSeconds(row.seconds_until_reset),
    // Never offer a higher bet than this game knows about, even if the server says more.
    maxBet: Number.isSafeInteger(serverMax) && serverMax > 0 ? Math.min(serverMax, TRIVIA_MAX_BET) : TRIVIA_MAX_BET,
    playDay: typeof row.play_day === "string" ? row.play_day : "",
  };
}

/** Ask the server whether today's trivia game is available. Throws with a readable message on failure. */
export async function fetchTriviaStatus(client) {
  if (!client) throw new Error("Sign in to play Trivia.");
  const { data, error } = await client.rpc("mini_arcade_trivia_status", {});
  if (error) throw new Error(error.message || "The server could not check today's trivia game.");
  return normalizeTriviaState(data);
}

/**
 * Use up today's game on the server. Resolves to { ok: true, ... } when the game may start, or
 * { ok: false, reason: "already_played", ... } when it was already used today. Throws on
 * errors (not signed in, suspended, bet outside 0 to 2,500, network trouble).
 */
export async function startTriviaGame(client, bet) {
  if (!client) throw new Error("Sign in to play Trivia.");
  if (!Number.isSafeInteger(bet) || bet < 0 || bet > TRIVIA_MAX_BET) {
    throw new RangeError(`The bet must be a whole number from 0 to ${TRIVIA_MAX_BET}.`);
  }
  const { data, error } = await client.rpc("mini_arcade_trivia_start", { p_bet: bet });
  if (error) throw new Error(error.message || "The server could not start the trivia game.");
  const row = Array.isArray(data) ? data[0] : data;
  const state = normalizeTriviaState(row);
  return {
    ...state,
    ok: row?.ok === true,
    reason: typeof row?.reason === "string" ? row.reason : "",
  };
}

/** 3725 -> "1h 02m 05s". */
export function formatCountdown(totalSeconds) {
  const seconds = safeSeconds(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const two = (n) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}h ${two(minutes)}m ${two(rest)}s` : `${minutes}m ${two(rest)}s`;
}
