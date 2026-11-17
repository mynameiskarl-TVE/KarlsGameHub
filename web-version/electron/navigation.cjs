const { URL } = require("node:url");

function getSafeExternalUrl(rawUrl) {
  if (typeof rawUrl !== "string" || rawUrl.length > 4096) return null;

  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

module.exports = { getSafeExternalUrl };
