import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwind()],
  build: { outDir: "dist/client" },
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:3000" } },
});
