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
  const encodedSize = new TextEncoder().encode(JSON.stringify(saveData)).byteLength;
  if (encodedSize > 65_536) {
    throw new RangeError("This save is too large to upload. Reduce the saved activity history and try again.");
  }

  const { error } = await client
    .from("player_saves")
    .upsert(
      { user_id: userId, save_data: saveData },
      { onConflict: "user_id" }
    );

  if (error) throw error;
  return saveData;
}

export async function syncPlayerLeaderboard(client, userId, profile) {
  if (!client || !userId) throw new TypeError("A signed-in player is required.");

  // Browser clients may edit only the display nickname.
  // Score columns are server-owned and are never accepted from a client save.
  const nickname = String(profile?.nickname || "Player").trim().slice(0, 18) || "Player";
  const { error } = await client
    .from("leaderboard")
    .update({ nickname })
    .eq("user_id", userId);

  if (error) throw error;
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
