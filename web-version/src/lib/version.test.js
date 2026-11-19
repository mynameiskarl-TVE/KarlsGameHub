import test from "node:test";
import assert from "node:assert/strict";
import {
  APP_VERSION,
  UPDATE_REQUIRED_CODE,
  VERSION_HEADER,
  createVersionedFetch,
  displayVersion,
  fetchClientRequirements,
  isOlderThan,
  notifyUpdateRequired,
  parseVersion,
  updateRequiredText,
} from "./version.js";
import { createSupabaseBrowserClient } from "./supabase.js";
import { readFileSync } from "node:fs";

test("numbers compare one by one, not alphabetically", () => {
  assert.equal(isOlderThan("10.9", "10.10"), true);
  assert.equal(isOlderThan("10.10", "10.9"), false);
  assert.equal(isOlderThan("10.10", "10.10"), false);
  assert.equal(isOlderThan("10.10.0", "10.10"), false);
  assert.equal(isOlderThan("10.9.9", "10.10"), true);
  assert.equal(isOlderThan("11", "10.10"), false);
});

test("unreadable versions: an unreadable copy is old, an unreadable minimum is no minimum", () => {
  assert.equal(isOlderThan(undefined, "10.10"), true);
  assert.equal(isOlderThan("abc", "10.10"), true);
  assert.equal(isOlderThan("1", ""), false);
  assert.equal(isOlderThan("1", null), false);
  assert.equal(isOlderThan("1", "junk"), false);
});

test("parse rejects anything that is not a plain version", () => {
  for (const bad of ["", "abc", "1.2.3.4", "-1", "10.10; drop", "99999", null, undefined]) {
    assert.equal(parseVersion(bad), null, String(bad));
  }
  assert.deepEqual(parseVersion("10.10"), [10, 10, 0]);
});

test("display trims a trailing .0 patch", () => {
  assert.equal(displayVersion("10.10.0"), "10.10");
  assert.equal(displayVersion("10.10"), "10.10");
  assert.equal(displayVersion("10.10.2"), "10.10.2");
});

test("package.json is the version source and matches the desktop version", () => {
  const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  assert.ok(parseVersion(pkg.version), "package.json version must be a plain version");
  const config = readFileSync(new URL("../../../mini_arcade_hub_v10_10_security/config.py", import.meta.url), "utf8");
  const desktop = /APP_VERSION\s*=\s*"([^"]+)"/.exec(config)?.[1];
  assert.deepEqual(parseVersion(pkg.version), parseVersion(desktop), "web and desktop versions must match");
});

test("a 426 update_required response is announced and returned unchanged", async () => {
  const seen = [];
  const body = JSON.stringify({ code: UPDATE_REQUIRED_CODE, message: "Get the new build." });
  const fetchLike = createVersionedFetch(
    async () => new Response(body, { status: 426, headers: { "content-type": "application/json" } }),
    (detail) => seen.push(detail),
  );
  const response = await fetchLike("https://x.supabase.co/rest/v1/leaderboard");
  assert.equal(response.status, 426);
  assert.equal((await response.json()).code, UPDATE_REQUIRED_CODE);
  assert.deepEqual(seen, [{ message: "Get the new build." }]);
});

test("other responses are not announced", async () => {
  const seen = [];
  const make = (status, text) =>
    createVersionedFetch(async () => new Response(text, { status }), (d) => seen.push(d));
  await make(200, "[]")("u");
  await make(500, "boom")("u");
  await make(426, "not json")("u");
  await make(426, JSON.stringify({ code: "something_else" }))("u");
  assert.deepEqual(seen, []);
});

test("notifyUpdateRequired dispatches an event and is safe without a window", () => {
  const events = [];
  notifyUpdateRequired({ message: "m" }, { dispatchEvent: (e) => events.push(e) });
  assert.equal(events.length, 1);
  assert.equal(events[0].detail.message, "m");
  assert.doesNotThrow(() => notifyUpdateRequired({ message: "m" }, {}));
});

test("requirements are read from the server's answer", async () => {
  const client = (result) => ({ rpc: async (name) => { assert.equal(name, "mini_arcade_client_requirements"); return result; } });
  assert.deepEqual(
    await fetchClientRequirements(client({ data: [{ min_client_version: "10.10", update_message: " Get it " }], error: null })),
    { minVersion: "10.10", message: "Get it" },
  );
  assert.equal(await fetchClientRequirements(client({ data: [], error: null })), null);
  assert.equal(await fetchClientRequirements(client({ data: [{ min_client_version: null }], error: null })), null);
  assert.equal(await fetchClientRequirements(client({ data: null, error: { message: "x" } })), null);
});

test("player text mentions both versions and the server's message", () => {
  const text = updateRequiredText({ minVersion: "10.11", message: "Use the new link." });
  assert.match(text, /10\.11/);
  assert.match(text, /Use the new link\./);
  assert.match(text, /guest/);
  assert.match(updateRequiredText({}), /Ctrl\+F5/);
});

test("the real client sends the version header on every request", async () => {
  const requests = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    requests.push({ url: String(input instanceof Request ? input.url : input), version: headers.get(VERSION_HEADER) });
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const client = createSupabaseBrowserClient({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_testkey",
    });
    await client.from("leaderboard").select("username").limit(1);
    await client.rpc("mini_arcade_client_requirements");
  } finally {
    globalThis.fetch = original;
  }
  assert.ok(requests.length >= 2, "expected the table and RPC requests");
  for (const request of requests) {
    assert.equal(request.version, APP_VERSION, request.url);
  }
});
