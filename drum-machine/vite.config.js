import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/", // Root of the site now!
  build: {
    outDir: "../dist", // Build directly to dist (no /app subfolder)
  },
});
