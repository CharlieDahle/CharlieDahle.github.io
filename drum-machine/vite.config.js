import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/app/", // This is crucial for GitHub Pages
  build: {
    outDir: "../dist/app", // Build directly to dist/app
  },
});
