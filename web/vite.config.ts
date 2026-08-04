import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// The API base is proxied in dev so the browser never needs CORS locally.
// In production VITE_API_BASE_URL points at the deployed FastAPI origin.
const API_TARGET = process.env["VITE_API_PROXY_TARGET"] ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // injectManifest, not generateSW: the caching rules in src/sw.ts are
      // specific enough (signed URLs excluded, writes never cached) that a
      // declarative config cannot express them.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "prompt",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
      manifest: {
        name: "Kerala Camp Check",
        short_name: "Camp Check",
        description: "Community-verified relief camp information for Kerala.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#f8fafd",
        theme_color: "#0f172a",
        lang: "en",
        categories: ["utilities", "government"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
