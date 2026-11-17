import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // GitHub Pages hosts this project under /KarlsGameHub/.
  // Electron/Capacitor builds can override this with VITE_BASE_PATH=/.
  base: process.env.VITE_BASE_PATH || "/KarlsGameHub/",
});
