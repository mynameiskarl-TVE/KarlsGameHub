import test from "node:test";
import assert from "node:assert/strict";
import {
  profileFromLegacySave,
  mergeProfileIntoLegacySave,
  getLegacyUsername,
} from "./legacy.js";
import { defaultProfile } from "./storage.js";

test("converts an existing Python save into the browser profile", () => {
  const profile = profileFromLegacySave({
    balance: 740,
    nickname: "ArcadePlayer",
    last_daily_reward: "2026-11-16",
    number_hunt_games: 12,
    number_hunt_wins: 8,
    rps_games: 9,
    rps_wins: 5,
    rps_ties: 3,
    trivia_games: 4,
    trivia_correct: 16,
    daily_logins: 7,
  });
  assert.equal(profile.balance, 740);
  assert.equal(profile.nickname, "ArcadePlayer");
  assert.equal(profile.lastDailyReward, "2026-11-16");
  assert.equal(profile.stats.numberHuntGames, 12);
  assert.equal(profile.stats.numberHuntWins, 8);
  assert.equal(profile.stats.rpsGames, 9);
  assert.equal(profile.stats.rpsWins, 5);
  assert.equal(profile.stats.rpsTies, 3);
  assert.equal(profile.stats.triviaGames, 4);
  assert.equal(profile.stats.triviaCorrect, 16);
  assert.equal(profile.stats.dailyLogins, 7);
});

test("can read camelCase web profiles as well as legacy snake_case saves", () => {
  const profile = profileFromLegacySave({
    balance: 600,
    numberHuntGames: 3,
    numberHuntWins: 2,
    rpsGames: 8,
    rpsWins: 4,
    triviaGames: 2,
    triviaCorrect: 7,
    dailyLogins: 1,
    lastDailyReward: "2026-11-17",
  });
  assert.equal(profile.stats.numberHuntGames, 3);
  assert.equal(profile.stats.rpsWins, 4);
  assert.equal(profile.stats.triviaCorrect, 7);
  assert.equal(profile.lastDailyReward, "2026-11-17");
});

test("invalid fields fall back to the current safe local profile", () => {
  const fallback = { ...defaultProfile(), balance: 321, nickname: "LocalPlayer" };
  const profile = profileFromLegacySave({
    balance: -100,
    nickname: "",
    number_hunt_games: -4,
    rps_wins: "not-a-number",
  }, fallback, "cloudname");
  assert.equal(profile.balance, 321);
  assert.equal(profile.nickname, "cloudname");
  assert.equal(profile.stats.numberHuntGames, 0);
  assert.equal(profile.stats.rpsWins, 0);
});

test("merges current profile fields without deleting unrelated legacy save fields", () => {
  const existing = {
    activity: ["old event"],
    announcement: "Welcome!",
    blackjack_wins: 11,
    slot_spins: 42,
    daily_reward: 125,
    rigging_enabled: false,
  };
  const profile = {
    ...defaultProfile(),
    nickname: "WebPlayer",
    balance: 800,
    stats: { ...defaultProfile().stats, numberHuntWins: 5, triviaCorrect: 20 },
  };
  const merged = mergeProfileIntoLegacySave(profile, existing);
  assert.equal(merged.balance, 800);
  assert.equal(merged.nickname, "WebPlayer");
  assert.equal(merged.number_hunt_wins, 5);
  assert.equal(merged.trivia_correct, 20);
  assert.deepEqual(merged.activity, ["old event"]);
  assert.equal(merged.announcement, "Welcome!");
  assert.equal(merged.blackjack_wins, 11);
  assert.equal(merged.slot_spins, 42);
  assert.equal(merged.daily_reward, 125);
  assert.equal(merged.rigging_enabled, false);
});

test("does not accept an arbitrary Auth email as a game username", () => {
  assert.equal(getLegacyUsername({ email: "player_123@accounts.miniarcade.invalid" }), "player_123");
  assert.equal(getLegacyUsername({ email: "person@example.com" }), "");
  assert.equal(getLegacyUsername({ email: null }), "");
});
