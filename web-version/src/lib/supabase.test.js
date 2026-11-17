import test from "node:test";
import assert from "node:assert/strict";
import {
  validateSupabaseConfig,
  usernameToAuthEmail,
  loadSupabaseConfig,
  saveSupabaseConfig,
  SUPABASE_CONFIG_KEY,
} from "./supabase.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    values,
  };
}

function legacyAnonKey(role = "anon") {
  const payload = Buffer.from(JSON.stringify({ role })).toString("base64url");
  return `header.${payload}.signature`;
}

test("accepts HTTPS Supabase project URL with a publishable key", () => {
  const config = validateSupabaseConfig({
    url: "https://example-project.supabase.co/",
    publishableKey: "sb_publishable_example",
  });
  assert.deepEqual(config, {
    url: "https://example-project.supabase.co",
    publishableKey: "sb_publishable_example",
  });
});

test("accepts a legacy anon JWT for existing project compatibility", () => {
  const config = validateSupabaseConfig({
    url: "https://example-project.supabase.co",
    publishableKey: legacyAnonKey(),
  });
  assert.equal(config.publishableKey, legacyAnonKey());
});

test("rejects service-role and secret keys", () => {
  assert.throws(() => validateSupabaseConfig({
    url: "https://example-project.supabase.co",
    publishableKey: "service_role",
  }), /service-role or secret/);
  assert.throws(() => validateSupabaseConfig({
    url: "https://example-project.supabase.co",
    publishableKey: "sb_secret_example",
  }), /service-role or secret/);
  assert.throws(() => validateSupabaseConfig({
    url: "https://example-project.supabase.co",
    publishableKey: legacyAnonKey("service_role"),
  }), /publishable key/);
});

test("rejects HTTP, non-Supabase URLs and URL paths", () => {
  assert.throws(() => validateSupabaseConfig({
    url: "http://example-project.supabase.co",
    publishableKey: "sb_publishable_example",
  }), /HTTPS/);
  assert.throws(() => validateSupabaseConfig({
    url: "https://example.com",
    publishableKey: "sb_publishable_example",
  }), /Supabase project/);
  assert.throws(() => validateSupabaseConfig({
    url: "https://example-project.supabase.co/rest/v1",
    publishableKey: "sb_publishable_example",
  }), /base Supabase Project URL/);
});

test("saves and loads a validated config locally", () => {
  const storage = memoryStorage();
  const saved = saveSupabaseConfig({
    url: "https://example-project.supabase.co",
    publishableKey: "sb_publishable_example",
  }, storage);
  assert.equal(saved.url, "https://example-project.supabase.co");
  assert.ok(storage.getItem(SUPABASE_CONFIG_KEY));
  assert.deepEqual(loadSupabaseConfig(storage), saved);
});

test("ignores malformed config stored in the browser", () => {
  const storage = memoryStorage();
  storage.setItem(SUPABASE_CONFIG_KEY, "{broken-json");
  assert.equal(loadSupabaseConfig(storage), null);
});

test("maps existing Python-style usernames to their legacy Auth identity", () => {
  assert.equal(usernameToAuthEmail("  Player_123 "), "player_123@accounts.miniarcade.invalid");
  assert.throws(() => usernameToAuthEmail("ab"), /3–20/);
  assert.throws(() => usernameToAuthEmail("has space"), /3–20/);
});
