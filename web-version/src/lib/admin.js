const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

function cleanUsername(value) {
  const username = String(value || "").trim().toLowerCase();
  if (!USERNAME_PATTERN.test(username)) {
    throw new TypeError("Enter a username with 3–20 letters, numbers or underscores.");
  }
  return username;
}

function cleanRows(data) {
  if (!Array.isArray(data)) return [];
  return data.filter((row) => row && typeof row === "object" && !Array.isArray(row));
}

function textField(value, maxLength = 200) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export const PRANK_EVENT_TYPES = [
  "confetti",
  "reality_glitch",
  "nickname_swap",
  "fake_announcement",
  "duck_invasion",
  "fortune",
  "jumpscare",
];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeAdminRole(data) {
  let role = data;

  if (Array.isArray(role)) role = role[0];
  if (role && typeof role === "object") {
    role = role.role ?? role.mini_arcade_admin_check ?? null;
  }

  return role === "owner" || role === "admin" ? role : null;
}

export async function fetchAdminRole(client) {
  if (!client) throw new TypeError("A signed-in account is required.");
  const { data, error } = await client.rpc("mini_arcade_admin_check", {});
  if (error) throw error;
  return normalizeAdminRole(data);
}

export async function fetchAdminSnapshot(client) {
  if (!client) throw new TypeError("A signed-in administrator is required.");

  const [rolesResult, suspendedResult, auditResult, onlineResult, freePlayResult] = await Promise.all([
    client.rpc("mini_arcade_admin_list_roles", {}),
    client.rpc("mini_arcade_admin_list_suspended", {}),
    client.rpc("mini_arcade_admin_audit_list", {}),
    client.rpc("mini_arcade_admin_online_players", {}),
    client.rpc("mini_arcade_admin_list_freeplay_testers", {}),
  ]);

  for (const result of [rolesResult, suspendedResult, auditResult, onlineResult, freePlayResult]) {
    if (result.error) throw result.error;
  }

  return {
    roles: cleanRows(rolesResult.data).map((row) => ({
      username: textField(row.username, 20),
      role: row.role === "owner" ? "owner" : row.role === "admin" ? "admin" : "unknown",
      createdAt: textField(row.created_at, 40),
    })),
    freePlayTesters: cleanRows(freePlayResult.data).map((row) => ({
      username: textField(row.username, 20),
      createdAt: textField(row.created_at, 40),
    })),
    suspended: cleanRows(suspendedResult.data).map((row) => ({
      username: textField(row.username, 20),
      reason: textField(row.reason, 200),
      suspendedAt: textField(row.suspended_at, 40),
    })),
    audit: cleanRows(auditResult.data).map((row) => ({
      action: textField(row.action, 40),
      targetUsername: textField(row.target_username, 20),
      createdAt: textField(row.created_at, 40),
    })),
    onlinePlayers: cleanRows(onlineResult.data).map((row) => ({
      // Kept in memory only for the server-authorized send-prank RPC.
      userId: typeof row.user_id === "string" ? row.user_id : "",
      username: textField(row.username, 20),
      lastSeenAt: textField(row.last_seen_at, 40),
    })).filter((row) => UUID_PATTERN.test(row.userId) && row.username),
  };
}

export async function setAdminRole(client, username, role) {
  if (!client) throw new TypeError("A signed-in owner is required.");
  const clean = cleanUsername(username);
  if (role !== "admin" && role !== "none") {
    throw new RangeError("Choose admin or none.");
  }

  const { error } = await client.rpc("mini_arcade_admin_set_role", {
    p_username: clean,
    p_role: role,
  });
  if (error) throw error;
}


export async function spawnPlayerCoins(client, username, amount) {
  if (!client) throw new TypeError("A signed-in administrator is required.");
  const clean = cleanUsername(username);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000) {
    throw new RangeError("Enter an amount from 1 to 1,000,000.");
  }
  const { data, error } = await client.rpc("mini_arcade_admin_spawn_coins", {
    p_username: clean,
    p_amount: amount,
  });
  if (error) throw error;
  return data;
}

export async function fetchFreePlayAccess(client) {
  if (!client) return false;
  const { data, error } = await client.rpc("mini_arcade_freeplay_check", {});
  if (error) throw error;
  return data === true;
}

export async function setFreePlayTester(client, username, enabled) {
  if (!client) throw new TypeError("A signed-in owner is required.");
  const clean = cleanUsername(username);
  if (typeof enabled !== "boolean") throw new TypeError("Choose whether tester free play is enabled.");
  const { error } = await client.rpc("mini_arcade_admin_set_freeplay_tester", {
    p_username: clean,
    p_enabled: enabled,
  });
  if (error) throw error;
}

export async function suspendPlayer(client, username, reason = "") {
  if (!client) throw new TypeError("A signed-in administrator is required.");
  const clean = cleanUsername(username);
  const cleanReason = textField(reason, 200);

  const { error } = await client.rpc("mini_arcade_admin_suspend_player", {
    p_username: clean,
    p_reason: cleanReason,
    // Do not reset balances or historic statistics from the web admin console.
    p_reset_score: false,
  });
  if (error) throw error;
}

export async function unsuspendPlayer(client, username) {
  if (!client) throw new TypeError("A signed-in administrator is required.");
  const clean = cleanUsername(username);

  const { error } = await client.rpc("mini_arcade_admin_unsuspend_player", {
    p_username: clean,
  });
  if (error) throw error;
}

export async function sendOnlinePrank(client, targetUserId, eventType) {
  if (!client) throw new TypeError("A signed-in administrator is required.");
  if (typeof targetUserId !== "string" || !UUID_PATTERN.test(targetUserId)) {
    throw new TypeError("Select a valid online player.");
  }
  if (!PRANK_EVENT_TYPES.includes(eventType)) {
    throw new RangeError("Choose a supported prank event.");
  }

  const { data, error } = await client.rpc("mini_arcade_admin_send_prank", {
    p_target_user_id: targetUserId,
    p_event_type: eventType,
  });
  if (error) throw error;
  return data;
}

export async function registerPrankPresence(client, username) {
  if (!client) throw new TypeError("A signed-in player is required.");
  const clean = cleanUsername(username);
  const { error } = await client.rpc("mini_arcade_prank_heartbeat", {
    p_username: clean,
  });
  if (error) throw error;
}

export async function pollPrankEvents(client) {
  if (!client) throw new TypeError("A signed-in player is required.");
  const { data, error } = await client.rpc("mini_arcade_prank_poll", {});
  if (error) throw error;
  return cleanRows(data).map((row) => ({
    eventId: String(row.event_id ?? ""),
    eventType: textField(row.event_type, 40),
    payload: row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? row.payload
      : {},
  })).filter((row) => PRANK_EVENT_TYPES.includes(row.eventType));
}

export async function leavePrankPresence(client) {
  if (!client) return;
  const { error } = await client.rpc("mini_arcade_prank_leave", {});
  if (error) throw error;
}
