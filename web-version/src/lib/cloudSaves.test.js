import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchPlayerCloudSave,
  uploadPlayerCloudSave,
  syncPlayerLeaderboard,
  fetchPlayerModerationStatus,
} from "./cloudSaves.js";
import { defaultProfile } from "../profile/storage.js";

function makeClient({ selectResult, upsertError = null, updateError = null, rpcResult } = {}) {
  const calls = [];
  const client = {
    calls,
    from(table) {
      const state = { table };
      const builder = {
        select(columns) { state.select = columns; calls.push({ method: "select", table, columns }); return builder; },
        eq(column, value) { state.eq = [column, value]; calls.push({ method: "eq", table, column, value }); return builder; },
        maybeSingle: async () => ({ data: selectResult ?? null, error: null }),
        upsert: async (row, options) => {
          calls.push({ method: "upsert", table, row, options });
          return { data: null, error: upsertError };
        },
        update: (row) => {
          calls.push({ method: "update", table, row });
          return {
            eq: async (column, value) => {
              calls.push({ method: "eq", table, column, value });
              return { data: null, error: updateError };
            },
          };
        },
      };
      return builder;
    },
    rpc: async (name, args) => {
      calls.push({ method: "rpc", name, args });
      return rpcResult ?? { data: [{ is_suspended: false, reason: null }], error: null };
    },
  };
  return client;
}

test("reads only the requested authenticated user's player save", async () => {
  const client = makeClient({
    selectResult: {
      save_data: { balance: 700, nickname: "CloudPlayer" },
      updated_at: "2026-11-17T18:00:00Z",
    },
  });
  const result = await fetchPlayerCloudSave(client, "auth-user-id");
  assert.equal(result.exists, true);
  assert.equal(result.saveData.balance, 700);
  assert.equal(result.updatedAt, "2026-11-17T18:00:00Z");
  assert.ok(client.calls.some(call => call.method === "eq" && call.column === "user_id" && call.value === "auth-user-id"));
});

test("returns an explicit empty result when the player has no cloud save yet", async () => {
  const result = await fetchPlayerCloudSave(makeClient(), "auth-user-id");
  assert.deepEqual(result, { saveData: null, updatedAt: null, exists: false });
});

test("upserts the account save while preserving unrelated old Python fields", async () => {
  const client = makeClient();
  const profile = {
    ...defaultProfile(),
    balance: 820,
    nickname: "NewName",
    stats: { ...defaultProfile().stats, rpsTies: 3 },
  };
  const merged = await uploadPlayerCloudSave(client, "auth-user-id", profile, {
    activity: ["older history"],
    blackjack_wins: 9,
    daily_reward: 100,
  });

  const call = client.calls.find(item => item.method === "upsert");
  assert.equal(call.table, "player_saves");
  assert.equal(call.row.user_id, "auth-user-id");
  assert.equal(call.options.onConflict, "user_id");
  assert.equal(call.row.save_data.balance, 820);
  assert.equal(call.row.save_data.rps_ties, 3);
  assert.equal(call.row.save_data.blackjack_wins, 9);
  assert.deepEqual(call.row.save_data.activity, ["older history"]);
  assert.equal(merged.daily_reward, 100);
});

test("rejects a cloud save larger than the database's 64 KiB limit before upload", async () => {
  const client = makeClient();
  const oversizedLegacySave = {
    activity: ["x".repeat(66_000)],
  };

  await assert.rejects(
    () => uploadPlayerCloudSave(client, "auth-user-id", defaultProfile(), oversizedLegacySave),
    /save is too large/
  );
  assert.equal(client.calls.some(call => call.method === "upsert"), false);
});

test("leaderboard sync updates only non-wagering fields on the authenticated player's own row", async () => {
  const client = makeClient();
  const profile = {
    ...defaultProfile(),
    balance: 900,
    nickname: "HubPlayer",
    stats: { ...defaultProfile().stats, numberHuntWins: 4, rpsWins: 2, triviaCorrect: 15 },
  };
  await syncPlayerLeaderboard(client, "my-user-id", profile, {
    blackjack_wins: 5,
    coin_flip_wins: 7,
    slot_wins: 2,
  });

  const update = client.calls.find(item => item.method === "update");
  assert.equal(update.table, "leaderboard");
  assert.equal(update.row.nickname, "HubPlayer");
  assert.equal(update.row.points, 900);
  assert.equal(update.row.trivia_correct, 15);
  assert.equal("blackjack_wins" in update.row, false);
  assert.equal("mini_game_wins" in update.row, false);
  assert.equal("total_wins" in update.row, false);
  assert.ok(client.calls.some(item => item.method === "eq" && item.column === "user_id" && item.value === "my-user-id"));
});

test("checks moderation status using the authenticated-user-only RPC", async () => {
  const client = makeClient({
    rpcResult: { data: [{ is_suspended: true, reason: "Review requested" }], error: null },
  });
  const status = await fetchPlayerModerationStatus(client);
  assert.deepEqual(status, { suspended: true, reason: "Review requested" });
  assert.ok(client.calls.some(item => item.method === "rpc" && item.name === "mini_arcade_my_status"));
});

test("rejects cloud requests without a user ID", async () => {
  await assert.rejects(() => fetchPlayerCloudSave(makeClient(), ""), /signed-in player/);
  await assert.rejects(() => uploadPlayerCloudSave(makeClient(), "", defaultProfile()), /signed-in player/);
});
