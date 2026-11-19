import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The web/app version comes from package.json, the one place it is set for the web version.
const APP_VERSION = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;

const PAGES_BASE = "/KarlsGameHub/";

// Content-Security-Policy for the public website. If a bug ever let someone inject a script,
// this stops it from loading code from, or sending your players' sign-in data to, other sites.
//  - connect-src allows any *.supabase.co project because the Account panel lets a player type
//    their own project URL; tighten it to your project URL if you remove that feature.
//  - the background music is served from this site itself, so no other media host is allowed.
//  - style-src needs 'unsafe-inline' because React sets style="" attributes.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

// Only the GitHub Pages build gets the policy. The dev server needs inline scripts, and the
// Electron/Android builds (VITE_BASE_PATH=/) load from file:// or localhost, where this exact
// policy has not been tested.
function contentSecurityPolicy() {
  let base = "/";
  return {
    name: "mini-arcade-content-security-policy",
    apply: "build",
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml(html) {
      if (base !== PAGES_BASE) return html;
      return html.replace(
        "<head>",
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), contentSecurityPolicy()],
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  // GitHub Pages hosts this project under /KarlsGameHub/.
  // Electron/Capacitor builds can override this with VITE_BASE_PATH=/.
  base: process.env.VITE_BASE_PATH || PAGES_BASE,
});
