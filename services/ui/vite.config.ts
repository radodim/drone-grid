import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react-swc"
import path from "node:path"
import { defineConfig } from "vite"

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    // LAN dev access via the machine's mDNS name (Vite blocks unknown hostnames)
    allowedHosts: [".local"],
    watch: {
      usePolling: true,
    },
  },
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      enableRouteGeneration: false,
    }),
    react(),
    tailwindcss(),
  ],
})
