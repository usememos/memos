import { resolve } from "path";
import { defineConfig } from "vite";
import legacy from "@vitejs/plugin-legacy";
import react from "@vitejs/plugin-react-swc";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ["defaults", "not IE 11"],
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: 3000,
    proxy: {
      "^/api": {
        target: "http://localhost:8080/",
        changeOrigin: true,
      },
      "^/o/": {
        target: "http://localhost:8080/",
        changeOrigin: true,
      },
      "^/h/": {
        target: "http://localhost:8080/",
        changeOrigin: true,
      },
      "^/u/\\d*/rss.xml": {
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
