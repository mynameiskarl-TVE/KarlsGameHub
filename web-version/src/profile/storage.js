export const PROFILE_STORAGE_KEY = "mini-arcade-hub.profile.v1";
export const STARTING_BALANCE = 500;
export const DAILY_REWARD = 100;
export const NUMBER_HUNT_REWARD = 20;
export const RPS_REWARD = 10;
export const TRIVIA_REWARD = 5;
export const MAX_BALANCE = 1_000_000_000;
export const MAX_REWARD = 100_000;
export const MAX_NICKNAME_LENGTH = 18;

export const STAT_KEYS = [
  "numberHuntGames",
  "numberHuntWins",
  "rpsGames",
  "rpsWins",
  "rpsTies",
  "triviaGames",
  "triviaCorrect",
  "dailyLogins",
];

export function defaultProfile() {
  return {
    nickname: "Player",
    balance: STARTING_BALANCE,
    lastDailyReward: "",
    dailyReward: DAILY_REWARD,
    numberReward: NUMBER_HUNT_REWARD,
    rpsReward: RPS_REWARD,
    triviaReward: TRIVIA_REWARD,
    stats: Object.fromEntries(STAT_KEYS.map((key) => [key, 0])),
  };
}

function safeCount(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) return 0;
  return Math.min(number, MAX_BALANCE);
}

function safeReward(value, fallback) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) return fallback;
  return Math.min(number, MAX_REWARD);
}

export function sanitizeProfile(value) {
  const fallback = defaultProfile();
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;

  const nickname =
    typeof value.nickname === "string"
      ? value.nickname.trim().slice(0, MAX_NICKNAME_LENGTH)
      : fallback.nickname;

  const lastDailyReward =
    typeof value.lastDailyReward === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.lastDailyReward)
      ? value.lastDailyReward
      : "";

  const rawStats =
    value.stats && typeof value.stats === "object" && !Array.isArray(value.stats)
      ? value.stats
      : {};

  return {
    nickname: nickname || fallback.nickname,
    balance: Math.min(MAX_BALANCE, safeCount(value.balance ?? fallback.balance)),
    lastDailyReward,
    dailyReward: safeReward(value.dailyReward, fallback.dailyReward),
    numberReward: safeReward(value.numberReward, fallback.numberReward),
    rpsReward: safeReward(value.rpsReward, fallback.rpsReward),
    triviaReward: safeReward(value.triviaReward, fallback.triviaReward),
    stats: Object.fromEntries(
      STAT_KEYS.map((key) => [key, safeCount(rawStats[key])])
    ),
  };
}

export function loadProfile(storage, key = PROFILE_STORAGE_KEY) {
  if (!storage || typeof storage.getItem !== "function") return defaultProfile();

  try {
    const raw = storage.getItem(key);
    if (!raw) return defaultProfile();
    return sanitizeProfile(JSON.parse(raw));
  } catch {
    return defaultProfile();
  }
}

export function saveProfile(profile, storage, key = PROFILE_STORAGE_KEY) {
  if (!storage || typeof storage.setItem !== "function") return false;

  try {
    storage.setItem(key, JSON.stringify(sanitizeProfile(profile)));
    return true;
  } catch {
    return false;
  }
}

export function getLocalDateKey(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError("A valid date is required.");
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

export function claimDailyReward(profile, today = getLocalDateKey(), reward) {
  const current = sanitizeProfile(profile);
  const rewardAmount = reward === undefined
    ? current.dailyReward
    : safeReward(reward, current.dailyReward);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    throw new TypeError("The daily reward date must use YYYY-MM-DD format.");
  }

  if (current.lastDailyReward === today) {
    return { profile: current, claimed: false, reward: 0 };
  }

  const credited = Math.min(rewardAmount, MAX_BALANCE - current.balance);
  const nextProfile = {
    ...current,
    balance: current.balance + credited,
    lastDailyReward: today,
    stats: {
      ...current.stats,
      dailyLogins: Math.min(MAX_BALANCE, current.stats.dailyLogins + 1),
    },
  };

  return { profile: nextProfile, claimed: true, reward: credited };
}
