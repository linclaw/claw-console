import path from "path"
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_")

  const gatewayHost = env.VITE_GATEWAY_HOST || "127.0.0.1"
  const gatewayPort = env.VITE_GATEWAY_PORT || "18789"
  const gatewayTarget = `http://${gatewayHost}:${gatewayPort}`

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      // Bind to 0.0.0.0 so the dev server is reachable over the LAN; Vite's HMR
      // websocket connects straight to :5174. nginx also serves the app on :80
      // at the clean http://claw.local hostname (see infra/README.md).
      host: true,
      // 5174, not Vite's default 5173 — the home-gym dev server already owns 5173
      // on this machine, and strictPort makes a collision fail loudly.
      port: 5174,
      strictPort: true,
      // Vite blocks requests whose Host header isn't localhost/an IP. The nginx
      // proxy forwards Host: claw.local, so allow-list it (`.local` also covers
      // the mDNS/Bonjour name when hitting :5174 directly).
      allowedHosts: ["claw.local", ".local"],
      proxy: {
        "/api": {
          target: gatewayTarget,
          changeOrigin: true,
        },
        "/healthz": {
          target: gatewayTarget,
          changeOrigin: true,
        },
        "/readyz": {
          target: gatewayTarget,
          changeOrigin: true,
        },
        "/ws": {
          target: gatewayTarget.replace("http", "ws"),
          ws: true,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/ws/, ""),
        },
      },
    },
  }
})
