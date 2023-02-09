import { resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 3001,
    proxy: {
      "^/api": {
        target: "http://localhost:8081/",
        changeOrigin: true,
      },
      "^/o/": {
        target: "http://localhost:8081/",
        changeOrigin: true,
      },
      "^/u/\\d*/rss.xml": {
        target: "http://localhost:8081/",
        changeOrigin: true,
      },
      "/explore/rss.xml": {
        target: "http://localhost:8081/",
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
