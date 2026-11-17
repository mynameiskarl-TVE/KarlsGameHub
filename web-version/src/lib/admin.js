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

  const [rolesResult, suspendedResult, auditResult] = await Promise.all([
    client.rpc("mini_arcade_admin_list_roles", {}),
    client.rpc("mini_arcade_admin_list_suspended", {}),
    client.rpc("mini_arcade_admin_audit_list", {}),
  ]);

  for (const result of [rolesResult, suspendedResult, auditResult]) {
    if (result.error) throw result.error;
  }

  return {
    roles: cleanRows(rolesResult.data).map((row) => ({
      username: textField(row.username, 20),
      role: row.role === "owner" ? "owner" : row.role === "admin" ? "admin" : "unknown",
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
