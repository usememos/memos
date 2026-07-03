import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// Defaults to the local Cloudflare Worker (`wrangler dev`), which serves the
// Connect API, /file/* and RSS. Override with DEV_PROXY_SERVER when needed.
let devProxyServer = "http://localhost:8787";
if (process.env.DEV_PROXY_SERVER && process.env.DEV_PROXY_SERVER.length > 0) {
  console.log("Use devProxyServer from environment: ", process.env.DEV_PROXY_SERVER);
  devProxyServer = process.env.DEV_PROXY_SERVER;
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3001,
    proxy: {
      "^/memos.api.v1": {
        target: devProxyServer,
        xfwd: true,
      },
      "^/file": {
        target: devProxyServer,
        xfwd: true,
      },
      "^/(explore/rss.xml|u/[^/]+/rss.xml|sitemap.xml|robots.txt|mcp)": {
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
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "utils-vendor",
              test: /node_modules[\\/](dayjs|lodash-es)([\\/]|$)/,
            },
            {
              name: "leaflet-vendor",
              test: /node_modules[\\/]leaflet([\\/]|$)/,
            },
          ],
        },
      },
    },
  },
});
