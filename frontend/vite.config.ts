import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"
import path from "path"
import { readFileSync } from "fs"

// Versão do app, mostrada no cabeçalho
const { version } = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf-8"))

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null, // Registro manual via public/register-sw.js (só ativa em HTTPS/localhost)
      // permite CSP script-src: 'self' sem 'unsafe-inline'
      manifest: {
        name: "Gestor de Loterias",
        short_name: "Gestor de Loterias",
        description: "Gestão financeira para lotéricas",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#4f46e5",
        icons: [
          { src: "/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        ],
      },
      workbox: {
        // Nunca cachear dados financeiros — sempre buscar da rede.
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    watch: {
      usePolling: true,
    },
    proxy: {
      "/api": process.env.VITE_BACKEND_URL ?? "http://localhost:3000",
    },
  },
})
