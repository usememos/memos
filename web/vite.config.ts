import { resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

let devProxyServer = "http://localhost:8081/";
if (process.env.DEV_PROXY_SERVER && process.env.DEV_PROXY_SERVER.length > 0) {
  console.log("Use devProxyServer from environment: ", process.env.DEV_PROXY_SERVER);
  devProxyServer = process.env.DEV_PROXY_SERVER;
}

// https://vitejs.dev/config/
export default defineConfig({
  base: "./",
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
