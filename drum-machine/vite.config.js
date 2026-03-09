import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/", // Root of the site now!
  build: {
    outDir: "dist",
  },
  server: {
    proxy: {
      // Proxy API requests to backend server
      '/api': {
        // target: 'https://api.charliedahle.me', // Production
        target: 'http://localhost:3001', // Local development
        changeOrigin: true,
        secure: false,
      },
      // Proxy WebSocket connections
      '/socket.io': {
        // target: 'https://api.charliedahle.me', // Production
        target: 'http://localhost:3001', // Local development
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
