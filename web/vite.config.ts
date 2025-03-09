import react from "@vitejs/plugin-react";
import { codeInspectorPlugin } from "code-inspector-plugin";
import { resolve } from "path";
import { defineConfig } from "vite";

let devProxyServer = "http://localhost:8081";
if (process.env.DEV_PROXY_SERVER && process.env.DEV_PROXY_SERVER.length > 0) {
  console.log("Use devProxyServer from environment: ", process.env.DEV_PROXY_SERVER);
  devProxyServer = process.env.DEV_PROXY_SERVER;
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    codeInspectorPlugin({
      bundler: "vite",
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
      "^/memos.api.v1": {
        target: devProxyServer,
        xfwd: true,
      },
      "^/file": {
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
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "assets/app.[hash].js",
        chunkFileNames: "assets/[name].[hash].js",
        assetFileNames: "assets/[name].[hash][extname]",
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "mui-vendor": ["@mui/joy", "@emotion/react", "@emotion/styled"],
          "utils-vendor": ["dayjs", "lodash-es", "mobx", "mobx-react-lite"],
          "katex-vendor": ["katex"],
          "highlight-vendor": ["highlight.js"],
          "mermaid-vendor": ["mermaid"],
          "leaflet-vendor": ["leaflet", "react-leaflet"],
        },
      },
    },
  },
});
