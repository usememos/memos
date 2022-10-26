import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:8080/",
        changeOrigin: true,
      },
      "/o/": {
        target: "http://localhost:8080/",
        changeOrigin: true,
      },
      "/h/": {
        target: "http://localhost:8080/",
        changeOrigin: true,
      },
      "^/u/\\d*/rss.xml": {
        target: "http://localhost:8080/",
        changeOrigin: true,
      },
    },
  },
});
