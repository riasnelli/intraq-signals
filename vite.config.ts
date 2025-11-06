import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg","apple-touch-icon.png"],
      manifest: {
        name: "IntraQ Signals",
        short_name: "Signals",
        display: "standalone",
        start_url: "/",
        background_color: "#0b0f19",
        theme_color: "#0ea5e9",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" }
        ]
      }
    })
  ]
});