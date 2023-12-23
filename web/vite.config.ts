import react from "@vitejs/plugin-react-swc";
import { resolve } from "path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

let devProxyServer = "http://localhost:8081/";
if (process.env.DEV_PROXY_SERVER && process.env.DEV_PROXY_SERVER.length > 0) {
  console.log("Use devProxyServer from environment: ", process.env.DEV_PROXY_SERVER);
  devProxyServer = process.env.DEV_PROXY_SERVER;
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      manifestFilename: "manifest.json",
      registerType: "autoUpdate",
      devOptions: {
        enabled: true,
      },
      manifest: {
        short_name: "memos",
        name: "memos",
        description: "usememos/memos",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#f4f4f5",
        background_color: "#f4f4f5",
        icons: [
          {
            src: "/logo.png",
            type: "image/png",
            sizes: "16x16",
          },
          {
            src: "/logo.png",
            type: "image/png",
            sizes: "32x32",
          },
          {
            src: "/logo.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/logo.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: 3001,
    proxy: {
      "^/api": {
        target: devProxyServer,
        xfwd: true,
      },
      "^/memos.api.v2": {
        target: devProxyServer,
        xfwd: true,
      },
      "^/o/": {
        target: devProxyServer,
        xfwd: true,
      },
      "^/u/.+/rss.xml": {
        target: devProxyServer,
        xfwd: true,
      },
      "^/explore/rss.xml": {
        target: devProxyServer,
        xfwd: true,
      },
    },
  },
  resolve: {
    alias: {
      "@/": `${resolve(__dirname, "src")}/`,
    },
  },
});
