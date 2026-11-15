import config from "../../vite.config.mjs";

export default {
  ...config,
  cacheDir: "node_modules/.vite-drawing-test",
  server: { ...config.server, port: 3074, strictPort: true, hmr: false },
};
