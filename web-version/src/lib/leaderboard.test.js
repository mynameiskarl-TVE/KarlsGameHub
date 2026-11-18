import test from "node:test";
import assert from "node:assert/strict";
import { fetchLeaderboard, normalizeLeaderboardRows } from "./leaderboard.js";

function makeClient({ data = [], error = null } = {}) {
  const calls = [];
  const builder = {
    select(columns) { calls.push({ method: "select", columns }); return builder; },
    order(column, options) { calls.push({ method: "order", column, options }); return builder; },
    limit(value) {
      calls.push({ method: "limit", value });
      return Promise.resolve({ data, error });
    },
  };
  return { calls, from(table) { calls.push({ method: "from", table }); return builder; } };
}

test("requests only public profile fields and sorts points then trivia answers", async () => {
  const client = makeClient({
    data: [{
      username: "player_one",
      nickname: "Player One",
      points: 900,
      blackjack_wins: 17,
      trivia_correct: 12,
      updated_at: "2026-11-17T12:00:00Z",
      user_id: "should-not-be-requested",
      is_suspended: false,
      suspended_reason: "private",
    }],
  });
  const rows = await fetchLeaderboard(client);

  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    username: "player_one",
    nickname: "Player One",
    points: 900,
    blackjackWins: 17,
    triviaCorrect: 12,
    updatedAt: "2026-11-17T12:00:00Z",
  });
  assert.ok(client.calls.some((item) => item.method === "select" &&
    item.columns === "username,nickname,points,blackjack_wins,trivia_correct,updated_at"));
  assert.deepEqual(
    client.calls.filter((item) => item.method === "order").map((item) => item.column),
    ["points", "trivia_correct"]
  );
  assert.equal(client.calls.some((item) => item.method === "select" &&
    /user_id|is_suspended|suspended_reason|email/.test(item.columns)), false);
});

test("clamps result count between one and one hundred", async () => {
  const client = makeClient();
  await fetchLeaderboard(client, 500);
  assert.equal(client.calls.find((item) => item.method === "limit").value, 100);
  const second = makeClient();
  await fetchLeaderboard(second, -5);
  assert.equal(second.calls.find((item) => item.method === "limit").value, 1);
});

test("normalizes untrusted row values and ignores additional private columns", () => {
  const rows = normalizeLeaderboardRows([{
    username: "  a user with a very long name  ",
    nickname: "  ",
    points: -100,
    trivia_correct: "not-a-number",
    is_suspended: true,
    email: "private@example.invalid",
  }]);
  assert.equal(rows[0].username, "a user with a very l");
  assert.equal(rows[0].nickname, rows[0].username);
  assert.equal(rows[0].points, 0);
  assert.equal(rows[0].triviaCorrect, 0);
  assert.equal(rows[0].blackjackWins, 0);
  assert.equal("email" in rows[0], false);
  assert.equal("is_suspended" in rows[0], false);
});

test("handles an empty leaderboard and rejects database errors", async () => {
  assert.deepEqual(await fetchLeaderboard(makeClient()), []);
  const failing = makeClient({ error: new Error("RLS denied") });
  await assert.rejects(() => fetchLeaderboard(failing), /RLS denied/);
  await assert.rejects(() => fetchLeaderboard(null), /Connect and sign in/);
});
