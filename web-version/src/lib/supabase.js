import { createClient } from "@supabase/supabase-js";

export const SUPABASE_CONFIG_KEY = "mini-arcade-hub.supabase-config.v1";

export function validateSupabaseConfig(config) {
  if (!config || typeof config !== "object") {
    throw new TypeError("Enter your Supabase Project URL and publishable key.");
  }

  const urlText = String(config.url || "").trim().replace(/\/$/, "");
  const key = String(config.publishableKey || "").trim();

  let parsed;
  try {
    parsed = new URL(urlText);
  } catch {
    throw new TypeError("The Project URL is not a valid URL.");
  }

  if (parsed.protocol !== "https:") {
    throw new TypeError("The Supabase Project URL must use HTTPS.");
  }
  if (
    !parsed.hostname.endsWith(".supabase.co") &&
    !parsed.hostname.endsWith(".supabase.in")
  ) {
    throw new TypeError("Enter the HTTPS URL of your Supabase project.");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
    throw new TypeError("Enter only the base Supabase Project URL, without extra paths or credentials.");
  }
  if (!key || key.length > 1000) {
    throw new TypeError("Enter a valid Supabase publishable key.");
  }
  if (/service[_-]?role|sb_secret_/i.test(key)) {
    throw new TypeError("A service-role or secret key is not allowed in a browser app. Use the publishable key.");
  }

  const isPublishable = key.startsWith("sb_publishable_");
  let isLegacyAnon = false;
  if (!isPublishable && key.split(".").length === 3) {
    try {
      const payloadPart = key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const padded = payloadPart.padEnd(Math.ceil(payloadPart.length / 4) * 4, "=");
      const payload = JSON.parse(atob(padded));
      isLegacyAnon = payload.role === "anon";
    } catch {
      isLegacyAnon = false;
    }
  }

  if (!isPublishable && !isLegacyAnon) {
    throw new TypeError("Use a Supabase publishable key (or a legacy anon key). Secret keys are not supported.");
  }

  return { url: parsed.origin, publishableKey: key };
}

export function loadSupabaseConfig(storage = globalThis.localStorage) {
  if (!storage || typeof storage.getItem !== "function") return null;
  try {
    const raw = storage.getItem(SUPABASE_CONFIG_KEY);
    if (!raw) return null;
    return validateSupabaseConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveSupabaseConfig(config, storage = globalThis.localStorage) {
  if (!storage || typeof storage.setItem !== "function") {
    throw new Error("This browser does not allow local settings storage.");
  }
  const safe = validateSupabaseConfig(config);
  storage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(safe));
  return safe;
}

export function createSupabaseBrowserClient(config) {
  const safe = validateSupabaseConfig(config);
  return createClient(safe.url, safe.publishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
}

export function usernameToAuthEmail(username) {
  const normalized = String(username || "").trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(normalized)) {
    throw new TypeError("Usernames must be 3–20 characters and use only letters, numbers, or underscores.");
  }
  return `${normalized}@accounts.miniarcade.invalid`;
}
