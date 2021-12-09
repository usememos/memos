import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    cors: true,
    proxy: {
      "/api": {
        target: "http://localhost:8080/",
        // target: "https://memos.justsven.top/",
        changeOrigin: true,
      },
    },
  },
});
