import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fetchTriviaStatus, formatCountdown, normalizeTriviaState, startTriviaGame } from "./triviaDaily.js";
import { TRIVIA_MAX_BET, TRIVIA_PAYOUT_MULTIPLIERS, TRIVIA_QUESTIONS } from "../games/trivia/engine.js";

function fakeClient(result) {
  const calls = [];
  return {
    calls,
    async rpc(name, params) {
      calls.push([name, params]);
      return typeof result === "function" ? result(name, params) : result;
    },
  };
}

test("status reads the server's answer", async () => {
  const client = fakeClient({ data: { can_play: true, seconds_until_reset: 5000, max_bet: 2500, play_day: "2026-11-19" }, error: null });
  const state = await fetchTriviaStatus(client);
  assert.deepEqual(client.calls, [["mini_arcade_trivia_status", {}]]);
  assert.deepEqual(state, { canPlay: true, secondsUntilReset: 5000, maxBet: 2500, playDay: "2026-11-19" });
});

test("anything unreadable means the player cannot play", () => {
  for (const junk of [null, undefined, [], "oops", 5, { can_play: "yes" }, { can_play: 1 }]) {
    assert.equal(normalizeTriviaState(junk).canPlay, false, String(junk));
  }
});

test("the server cannot raise the bet limit above what the game knows, and seconds are clamped", () => {
  assert.equal(normalizeTriviaState({ can_play: true, max_bet: 999999 }).maxBet, 2500);
  assert.equal(normalizeTriviaState({ can_play: true, max_bet: 100 }).maxBet, 100);
  assert.equal(normalizeTriviaState({ can_play: true, max_bet: "x" }).maxBet, 2500);
  assert.equal(normalizeTriviaState({ seconds_until_reset: -5 }).secondsUntilReset, 0);
  assert.equal(normalizeTriviaState({ seconds_until_reset: 1e9 }).secondsUntilReset, 86400);
  assert.equal(normalizeTriviaState({ seconds_until_reset: "x" }).secondsUntilReset, 0);
});

test("starting sends the bet and reports the server's yes", async () => {
  const client = fakeClient({ data: { ok: true, reason: null, can_play: false, seconds_until_reset: 100, bet: 300 }, error: null });
  const result = await startTriviaGame(client, 300);
  assert.deepEqual(client.calls, [["mini_arcade_trivia_start", { p_bet: 300 }]]);
  assert.equal(result.ok, true);
  assert.equal(result.canPlay, false);
});

test("starting reports 'already played' from the server", async () => {
  const client = fakeClient({ data: { ok: false, reason: "already_played", can_play: false, seconds_until_reset: 100 }, error: null });
  const result = await startTriviaGame(client, 0);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "already_played");
});

test("only an explicit true counts as ok", async () => {
  for (const data of [{ ok: "true" }, { ok: 1 }, {}, null]) {
    assert.equal((await startTriviaGame(fakeClient({ data, error: null }), 5)).ok, false, JSON.stringify(data));
  }
});

test("a bad bet is never sent to the server", async () => {
  const client = fakeClient({ data: { ok: true }, error: null });
  for (const bad of [-1, 2501, 1.5, "100", null, NaN]) {
    await assert.rejects(() => startTriviaGame(client, bad), RangeError, String(bad));
  }
  assert.equal(client.calls.length, 0);
});

test("server errors are thrown with their message, and a missing client is refused", async () => {
  await assert.rejects(() => startTriviaGame(fakeClient({ data: null, error: { message: "This account is suspended" } }), 10), /suspended/);
  await assert.rejects(() => fetchTriviaStatus(fakeClient({ data: null, error: { message: "offline" } })), /offline/);
  await assert.rejects(() => fetchTriviaStatus(null), /Sign in/);
  await assert.rejects(() => startTriviaGame(null, 0), /Sign in/);
});

test("countdown text", () => {
  assert.equal(formatCountdown(3725), "1h 02m 05s");
  assert.equal(formatCountdown(59), "0m 59s");
  assert.equal(formatCountdown(0), "0m 00s");
  assert.equal(formatCountdown(-3), "0m 00s");
  assert.equal(formatCountdown("x"), "0m 00s");
  assert.equal(formatCountdown(86400), "24h 00m 00s");
});

test("the Windows game and the website have the same questions, max bet and payouts", () => {
  const root = new URL("../../../", import.meta.url);
  const folder = readdirSync(root, { withFileTypes: true })
    .find((entry) => entry.isDirectory() && /^mini_arcade_hub_v\d+_\d+_/.test(entry.name))?.name;
  assert.ok(folder, "the versioned game folder was not found");
  const python = readFileSync(new URL(`${folder}/trivia_daily.py`, root), "utf8");

  const pythonQuestions = [...python.matchAll(/^\s+\(("(?:[^"\\]|\\.)*"), \[(.*)\], (\d)\),$/gm)].map((match) => ({
    question: JSON.parse(match[1]),
    options: JSON.parse(`[${match[2]}]`),
    answer: Number(match[3]),
  }));
  assert.equal(pythonQuestions.length, 25);
  assert.deepEqual(
    pythonQuestions,
    TRIVIA_QUESTIONS.map(({ question, options, answer }) => ({ question, options, answer })),
  );

  assert.equal(Number(/^TRIVIA_MAX_BET = (\d+)/m.exec(python)[1]), TRIVIA_MAX_BET);
  const halves = /^TRIVIA_PAYOUT_HALVES = \(([^)]*)\)/m.exec(python)[1].split(",").map((n) => Number(n.trim()));
  assert.deepEqual(halves.map((n) => n / 2), TRIVIA_PAYOUT_MULTIPLIERS);

  const sql = readFileSync(new URL(`${folder}/supabase_trivia_daily_setup.sql`, root), "utf8");
  const sqlMax = [...sql.matchAll(/c_max_bet constant integer := (\d+);/g)].map((match) => Number(match[1]));
  assert.deepEqual(sqlMax, [TRIVIA_MAX_BET, TRIVIA_MAX_BET], "the server's maximum bet differs from the game's");
});
