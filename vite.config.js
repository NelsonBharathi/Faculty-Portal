import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],

  // ✅ IMPORTANT: must match your GitHub repo name EXACTLY (case-sensitive)
  base: "/Faculty-Portal/",

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});