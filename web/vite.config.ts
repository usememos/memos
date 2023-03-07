import { resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

const devProxyServer = "http://localhost:8081/";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 3001,
    proxy: {
      "^/api": {
        target: devProxyServer,
        changeOrigin: true,
      },
      "^/o/": {
        target: devProxyServer,
        changeOrigin: true,
      },
      "^/u/\\d*/rss.xml": {
        target: devProxyServer,
        changeOrigin: true,
      },
      "/explore/rss.xml": {
        target: devProxyServer,
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
