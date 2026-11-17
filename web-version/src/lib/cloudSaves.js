import { mergeProfileIntoLegacySave } from "../profile/legacy.js";

export async function fetchPlayerCloudSave(client, userId) {
  if (!client || !userId) throw new TypeError("A signed-in player is required.");
  const { data, error } = await client
    .from("player_saves")
    .select("save_data,updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data
    ? { saveData: data.save_data, updatedAt: data.updated_at, exists: true }
    : { saveData: null, updatedAt: null, exists: false };
}

export async function uploadPlayerCloudSave(client, userId, profile, existingSave = {}) {
  if (!client || !userId) throw new TypeError("A signed-in player is required.");

  const saveData = mergeProfileIntoLegacySave(profile, existingSave);
  const { error } = await client
    .from("player_saves")
    .upsert(
      { user_id: userId, save_data: saveData },
      { onConflict: "user_id" }
    );

  if (error) throw error;
  return saveData;
}

function safeCounter(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? Math.min(parsed, 1_000_000_000) : 0;
}

export async function syncPlayerLeaderboard(client, userId, profile, existingSave = {}) {
  if (!client || !userId) throw new TypeError("A signed-in player is required.");

  const saveData = mergeProfileIntoLegacySave(profile, existingSave);

  // Only sync the non-wagering web game's public profile fields. Older
  // win totals from retired desktop-only games remain untouched.
  const { error } = await client
    .from("leaderboard")
    .update({
      nickname: profile.nickname,
      points: safeCounter(profile.balance),
      trivia_correct: safeCounter(profile.stats?.triviaCorrect),
    })
    .eq("user_id", userId);  if (error) throw error;
}

export async function fetchPlayerModerationStatus(client) {
  if (!client) throw new TypeError("A signed-in player is required.");
  const { data, error } = await client.rpc("mini_arcade_my_status", {});
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return {
    suspended: Boolean(row?.is_suspended),
    reason: typeof row?.reason === "string" ? row.reason.slice(0, 200) : "",
  };
}
