// Game version helpers: what version this is, whether it is too old, and how the server's
// "update required" refusal reaches the player.
//
// The version comes from package.json (injected by Vite as __APP_VERSION__). Every request to
// the server carries it in the x-mini-arcade-version header. The server (see
// supabase_version_gate_setup.sql) refuses requests from versions older than a minimum you set.

export const VERSION_HEADER = "x-mini-arcade-version";
export const UPDATE_REQUIRED_EVENT = "mini-arcade-update-required";
export const UPDATE_REQUIRED_CODE = "update_required";

// eslint-disable-next-line no-undef
export const APP_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0";

const VERSION_PATTERN = /^[0-9]{1,4}(\.[0-9]{1,4}){0,2}$/;

/** "10.10" -> [10, 10, 0]. Returns null for anything that is not a plain version number. */
export function parseVersion(text) {
  const value = String(text ?? "").trim();
  if (!VERSION_PATTERN.test(value)) return null;
  const parts = value.split(".").map(Number);
  while (parts.length < 3) parts.push(0);
  return parts;
}

/**
 * True when `have` is older than `need`. Numbers are compared one by one, so 10.10 is newer than
 * 10.9. An unreadable `have` counts as older; an unreadable or empty `need` means no minimum is
 * set, so nothing is older.
 */
export function isOlderThan(have, need) {
  const required = parseVersion(need);
  if (!required) return false;
  const current = parseVersion(have);
  if (!current) return true;
  for (let i = 0; i < 3; i += 1) {
    if (current[i] !== required[i]) return current[i] < required[i];
  }
  return false;
}

/** The version as shown to players: "10.10.0" -> "10.10". */
export function displayVersion(text = APP_VERSION) {
  const parsed = parseVersion(text);
  if (!parsed) return String(text);
  const [major, minor, patch] = parsed;
  return patch ? `${major}.${minor}.${patch}` : `${major}.${minor}`;
}

export function updateRequiredText({ minVersion = "", message = "" } = {}) {
  const parts = [`This is version ${displayVersion()}.`];
  if (minVersion) parts.push(`Online play needs version ${displayVersion(minVersion)} or newer.`);
  const serverMessage = String(message || "").trim();
  parts.push(
    serverMessage || "Refresh this page (Ctrl+F5) to load the newest version, or download the latest app.",
  );
  parts.push("You can still play as a guest on this device.");
  return parts.join(" ");
}

export function notifyUpdateRequired(detail, target = globalThis) {
  if (typeof target?.dispatchEvent !== "function" || typeof CustomEvent !== "function") return;
  target.dispatchEvent(new CustomEvent(UPDATE_REQUIRED_EVENT, { detail }));
}

/**
 * Wraps fetch so a server refusal because the version is too old (HTTP 426 with the
 * update_required code) reaches the screen instead of looking like a random network error.
 * The response itself is returned unchanged.
 */
export function createVersionedFetch(baseFetch, onUpdateRequired = notifyUpdateRequired) {
  return async (input, init) => {
    const response = await baseFetch(input, init);
    if (response.status === 426) {
      try {
        const body = await response.clone().json();
        if (body && body.code === UPDATE_REQUIRED_CODE) {
          onUpdateRequired({ message: String(body.message || "") });
        }
      } catch {
        // Not our JSON error: leave the response alone.
      }
    }
    return response;
  };
}

/** Ask the server for the minimum version. Returns null when there is none or it cannot be read. */
export async function fetchClientRequirements(client) {
  const { data, error } = await client.rpc("mini_arcade_client_requirements");
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  const minVersion = String(row?.min_client_version || "").trim();
  if (!minVersion) return null;
  return { minVersion, message: String(row?.update_message || "").trim().slice(0, 300) };
}
