import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAdminRole,
  fetchAdminRole,
  fetchAdminSnapshot,
  setAdminRole,
  suspendPlayer,
  unsuspendPlayer,
  sendOnlinePrank,
  registerPrankPresence,
  pollPrankEvents,
  leavePrankPresence,
  PRANK_EVENT_TYPES,
} from "./admin.js";

function mockClient(results = {}) {
  const calls = [];
  return {
    calls,
    rpc: async (name, args) => {
      calls.push({ name, args });
      return results[name] ?? { data: null, error: null };
    },
  };
}

test("normalizes supported owner/admin role response shapes and fails closed", () => {
  assert.equal(normalizeAdminRole("owner"), "owner");
  assert.equal(normalizeAdminRole([{ role: "admin" }]), "admin");
  assert.equal(normalizeAdminRole({ mini_arcade_admin_check: "owner" }), "owner");
  assert.equal(normalizeAdminRole("moderator"), null);
  assert.equal(normalizeAdminRole(null), null);
});

test("fetches admin role only through the server RPC", async () => {
  const client = mockClient({
    mini_arcade_admin_check: { data: "owner", error: null },
  });
  assert.equal(await fetchAdminRole(client), "owner");
  assert.deepEqual(client.calls, [{ name: "mini_arcade_admin_check", args: {} }]);
});

test("admin snapshot reads only the three protected server RPCs and returns safe fields", async () => {
  const client = mockClient({
    mini_arcade_admin_list_roles: {
      data: [{ username: "mynameiskarl", role: "owner", created_at: "2026-01-01", user_id: "private" }],
      error: null,
    },
    mini_arcade_admin_list_suspended: {
      data: [{ username: "player_one", reason: "test", suspended_at: "2026-01-02", user_id: "private" }],
      error: null,
    },
    mini_arcade_admin_audit_list: {
      data: [{ action: "suspend_player", target_username: "player_one", created_at: "2026-01-02", actor_user_id: "private" }],
      error: null,
    },
  });

  const snapshot = await fetchAdminSnapshot(client);
  assert.equal(snapshot.roles[0].role, "owner");
  assert.equal(snapshot.suspended[0].reason, "test");
  assert.equal(snapshot.audit[0].action, "suspend_player");
  assert.equal("user_id" in snapshot.roles[0], false);
  assert.equal("actor_user_id" in snapshot.audit[0], false);
  assert.deepEqual(client.calls.map((item) => item.name).sort(), [
    "mini_arcade_admin_audit_list",
    "mini_arcade_admin_list_roles",
    "mini_arcade_admin_list_suspended",
    "mini_arcade_admin_online_players",
  ]);
});

test("role changes validate the username and role before RPC", async () => {
  const client = mockClient();
  await setAdminRole(client, "  Player_One ", "admin");
  assert.deepEqual(client.calls[0], {
    name: "mini_arcade_admin_set_role",
    args: { p_username: "player_one", p_role: "admin" },
  });
  await assert.rejects(() => setAdminRole(client, "x", "owner"), /username/);
  await assert.rejects(() => setAdminRole(client, "player_one", "owner"), /Choose admin or none/);
});

test("suspension calls the protected RPC without resetting scores", async () => {
  const client = mockClient();
  await suspendPlayer(client, "Player_One", " repeated abuse ");
  assert.deepEqual(client.calls[0], {
    name: "mini_arcade_admin_suspend_player",
    args: {
      p_username: "player_one",
      p_reason: "repeated abuse",
      p_reset_score: false,
    },
  });
  await assert.rejects(() => suspendPlayer(client, "invalid username"), /username/);
});

test("unsuspension validates the username and calls the protected RPC", async () => {
  const client = mockClient();
  await unsuspendPlayer(client, "Player_One");
  assert.deepEqual(client.calls[0], {
    name: "mini_arcade_admin_unsuspend_player",
    args: { p_username: "player_one" },
  });
});

test("sends a supported prank to a selected online player using the protected RPC", async () => {
  const client = mockClient();
  const target = "123e4567-e89b-12d3-a456-426614174000";
  await sendOnlinePrank(client, target, "confetti");
  assert.deepEqual(client.calls[0], {
    name: "mini_arcade_admin_send_prank",
    args: { p_target_user_id: target, p_event_type: "confetti" },
  });
  assert.ok(PRANK_EVENT_TYPES.includes("duck_invasion"));
  await assert.rejects(() => sendOnlinePrank(client, "not-a-uuid", "confetti"), /online player/);
  await assert.rejects(() => sendOnlinePrank(client, target, "unknown"), /supported prank/);
});

test("registers presence with the authenticated username and polls only supported events", async () => {
  const client = mockClient({
    mini_arcade_prank_poll: {
      data: [
        { event_id: 7, event_type: "duck_invasion", payload: {} },
        { event_id: 8, event_type: "unrecognized", payload: {} },
      ],
      error: null,
    },
  });
  await registerPrankPresence(client, "Player_One");
  const events = await pollPrankEvents(client);
  assert.deepEqual(events, [{ eventId: "7", eventType: "duck_invasion", payload: {} }]);
  assert.deepEqual(client.calls.slice(0, 2), [
    { name: "mini_arcade_prank_heartbeat", args: { p_username: "player_one" } },
    { name: "mini_arcade_prank_poll", args: {} },
  ]);
});

test("leaves online presence through the server RPC", async () => {
  const client = mockClient();
  await leavePrankPresence(client);
  assert.deepEqual(client.calls, [{ name: "mini_arcade_prank_leave", args: {} }]);
});
