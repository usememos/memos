import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    cors: true,
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:8080/",
        changeOrigin: true,
      },
      "/h/": {
        target: "http://localhost:8080/",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@/": `${resolve(__dirname, "src")}/`,
    },
  },
});
