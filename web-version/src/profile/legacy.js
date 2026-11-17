import { defaultProfile, sanitizeProfile } from "./storage.js";

/**
 * Converts the existing Python v10 save shape to the web profile shape.
 * Unknown legacy properties are intentionally retained in the base object
 * when writing back, so the web edition does not erase older save metadata.
 */
const FIELD_MAP = {
  numberHuntGames: "number_hunt_games",
  numberHuntWins: "number_hunt_wins",
  rpsGames: "rps_games",
  rpsWins: "rps_wins",
  triviaGames: "trivia_games",
  triviaCorrect: "trivia_correct",
  dailyLogins: "daily_logins",
};

function validCounter(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function firstDefined(source, snakeCase, camelCase) {
  if (source[snakeCase] !== undefined && source[snakeCase] !== null) return source[snakeCase];
  if (source[camelCase] !== undefined && source[camelCase] !== null) return source[camelCase];
  return undefined;
}

export function profileFromLegacySave(saveData, fallbackProfile = defaultProfile(), username = "") {
  const fallback = sanitizeProfile(fallbackProfile);
  if (!saveData || typeof saveData !== "object" || Array.isArray(saveData)) {
    return fallback;
  }

  const rawStats = {};
  for (const [webKey, legacyKey] of Object.entries(FIELD_MAP)) {
    rawStats[webKey] = firstDefined(saveData, legacyKey, webKey) ?? fallback.stats[webKey];
  }

  const nickname =
    typeof saveData.nickname === "string" && saveData.nickname.trim()
      ? saveData.nickname.trim().slice(0, 18)
      : (username || fallback.nickname);

  const lastDailyReward =
    typeof saveData.last_daily_reward === "string"
      ? saveData.last_daily_reward
      : typeof saveData.lastDailyReward === "string"
        ? saveData.lastDailyReward
        : fallback.lastDailyReward;

  return sanitizeProfile({
    nickname,
    balance: validCounter(saveData.balance, fallback.balance),
    lastDailyReward,
    stats: rawStats,
  });
}

export function mergeProfileIntoLegacySave(profile, existingSave = {}) {
  const clean = sanitizeProfile(profile);
  const base =
    existingSave && typeof existingSave === "object" && !Array.isArray(existingSave)
      ? { ...existingSave }
      : {};

  base.balance = clean.balance;
  base.nickname = clean.nickname;
  base.last_daily_reward = clean.lastDailyReward;

  for (const [webKey, legacyKey] of Object.entries(FIELD_MAP)) {
    base[legacyKey] = clean.stats[webKey];
  }

  return base;
}

export function getLegacyUsername(user) {
  const email = typeof user?.email === "string" ? user.email : "";
  const suffix = "@accounts.miniarcade.invalid";
  if (!email.toLowerCase().endsWith(suffix)) return "";
  return email.slice(0, -suffix.length).toLowerCase();
}
