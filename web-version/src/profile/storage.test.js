import test from "node:test";
import assert from "node:assert/strict";
import {
  PROFILE_STORAGE_KEY,
  STARTING_BALANCE,
  DAILY_REWARD,
  MAX_BALANCE,
  defaultProfile,
  sanitizeProfile,
  loadProfile,
  saveProfile,
  getLocalDateKey,
  claimDailyReward,
} from "./storage.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    values,
  };
}

test("creates a fresh profile with the original starting balance", () => {
  const profile = defaultProfile();
  assert.equal(profile.nickname, "Player");
  assert.equal(profile.balance, STARTING_BALANCE);
  assert.deepEqual(profile.stats.numberHuntGames, 0);
  assert.equal(profile.dailyReward, 100);
  assert.equal(profile.numberReward, 20);
  assert.equal(profile.rpsReward, 10);
  assert.equal(profile.triviaReward, 5);
});

test("saves and loads a profile using the versioned storage key", () => {
  const storage = memoryStorage();
  const profile = { ...defaultProfile(), nickname: "GardenArcade", balance: 620 };
  assert.equal(saveProfile(profile, storage), true);
  assert.ok(storage.getItem(PROFILE_STORAGE_KEY));
  const loaded = loadProfile(storage);
  assert.equal(loaded.nickname, "GardenArcade");
  assert.equal(loaded.balance, 620);
});

test("corrupt stored JSON falls back to a clean default profile", () => {
  const storage = memoryStorage({ [PROFILE_STORAGE_KEY]: "{not-json" });
  assert.deepEqual(loadProfile(storage), defaultProfile());
});

test("sanitizes malformed values and limits nickname length", () => {
  const profile = sanitizeProfile({
    nickname: "  ThisNicknameIsMuchTooLongForTheProfile  ",
    balance: -50,
    lastDailyReward: "not-a-date",
    dailyReward: -2,
    numberReward: 150000,
    rpsReward: "bad",
    triviaReward: 7,
    stats: { rpsWins: "-4", triviaGames: "8", surprise: 999 },
  });
  assert.equal(profile.nickname.length, 18);
  assert.equal(profile.balance, 0);
  assert.equal(profile.lastDailyReward, "");
  assert.equal(profile.stats.rpsWins, 0);
  assert.equal(profile.stats.triviaGames, 8);
  assert.equal(profile.dailyReward, 100);
  assert.equal(profile.numberReward, 100000);
  assert.equal(profile.rpsReward, 10);
  assert.equal(profile.triviaReward, 7);
  assert.equal("surprise" in profile.stats, false);
});

test("sanitizes Blackjack cosmetics and always retains the free starter designs", () => {
  const profile = sanitizeProfile({
    ...defaultProfile(),
    blackjackCosmetics: {
      ownedTablecloths: ["burgundy", "unknown", "burgundy"],
      ownedDecks: ["blue", "invalid"],
      selectedTablecloth: "unknown",
      selectedDeck: "blue",
    },
  });
  assert.deepEqual(profile.blackjackCosmetics.ownedTablecloths, ["burgundy", "classic-green"]);
  assert.deepEqual(profile.blackjackCosmetics.ownedDecks, ["blue", "classic"]);
  assert.equal(profile.blackjackCosmetics.selectedTablecloth, "classic-green");
  assert.equal(profile.blackjackCosmetics.selectedDeck, "blue");
});

test("daily reward is credited once per local calendar date", () => {
  const original = defaultProfile();
  const first = claimDailyReward(original, "2026-11-17");
  assert.equal(first.claimed, true);
  assert.equal(first.reward, DAILY_REWARD);
  assert.equal(first.profile.balance, STARTING_BALANCE + DAILY_REWARD);
  assert.equal(first.profile.stats.dailyLogins, 1);

  const second = claimDailyReward(first.profile, "2026-11-17");
  assert.equal(second.claimed, false);
  assert.equal(second.reward, 0);
  assert.equal(second.profile.balance, first.profile.balance);
});

test("uses the reward amount saved in the player profile", () => {
  const profile = { ...defaultProfile(), balance: 100, dailyReward: 175 };
  const claim = claimDailyReward(profile, "2026-11-17");
  assert.equal(claim.reward, 175);
  assert.equal(claim.profile.balance, 275);
});

test("daily reward can be claimed on a later date", () => {
  const first = claimDailyReward(defaultProfile(), "2026-11-17");
  const second = claimDailyReward(first.profile, "2026-11-18");
  assert.equal(second.claimed, true);
  assert.equal(second.profile.stats.dailyLogins, 2);
  assert.equal(second.profile.balance, STARTING_BALANCE + DAILY_REWARD * 2);
});

test("daily reward never pushes the balance above the maximum", () => {
  const profile = sanitizeProfile({ ...defaultProfile(), balance: MAX_BALANCE - 10 });
  const claim = claimDailyReward(profile, "2026-11-17");
  assert.equal(claim.reward, 10);
  assert.equal(claim.profile.balance, MAX_BALANCE);
});

test("storage failures are handled without throwing", () => {
  const brokenStorage = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("quota"); },
  };
  assert.deepEqual(loadProfile(brokenStorage), defaultProfile());
  assert.equal(saveProfile(defaultProfile(), brokenStorage), false);
});

test("local date key uses the supplied date's local calendar date", () => {
  const result = getLocalDateKey(new Date(2026, 10, 17, 12, 0, 0));
  assert.equal(result, "2026-11-17");
});
