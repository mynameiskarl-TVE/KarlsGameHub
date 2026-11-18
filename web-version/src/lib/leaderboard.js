const MAX_ROWS = 100;
const MAX_COUNTER = 1_000_000_000;

function safeCounter(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) return 0;
  return Math.min(number, MAX_COUNTER);
}

function safeText(value, maxLength, fallback) {
  if (typeof value !== "string") return fallback;
  const clean = value.trim().slice(0, maxLength);
  return clean || fallback;
}

export function normalizeLeaderboardRows(rows) {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => ({
    username: safeText(row?.username, 20, "player"),
    nickname: safeText(row?.nickname, 18, safeText(row?.username, 20, "Player")),
    points: safeCounter(row?.points),
    blackjackWins: safeCounter(row?.blackjack_wins),
    triviaCorrect: safeCounter(row?.trivia_correct),
    updatedAt: typeof row?.updated_at === "string" ? row.updated_at : "",
  }));
}

export async function fetchLeaderboard(client, limit = 50) {
  if (!client) throw new TypeError("Connect and sign in to view the leaderboard.");

  const safeLimit = Number.isSafeInteger(limit)
    ? Math.max(1, Math.min(MAX_ROWS, limit))
    : 50;

  const { data, error } = await client
    .from("leaderboard")
    .select("username,nickname,points,blackjack_wins,trivia_correct,updated_at")
    .order("points", { ascending: false })
    .order("trivia_correct", { ascending: false })
    .limit(safeLimit);

  if (error) throw error;
  return normalizeLeaderboardRows(data || []);
}
