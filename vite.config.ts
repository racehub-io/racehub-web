import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => {
  const pages = mode === "pages";
  const apiPort = process.env.RACEHUB_PORT ?? "8081";
  if (!pages && (!/^\d+$/.test(apiPort) || Number(apiPort) < 1 || Number(apiPort) > 65535)) {
    throw new Error("RACEHUB_PORT must be 1 to 65535 for the development proxy.");
  }
  const proxy = pages ? {} : { "/api": { target: `http://127.0.0.1:${apiPort}`, changeOrigin: true } };

  return {
    base: pages ? `${(process.env.RACEHUB_BASE_PATH ?? "/racehub-web").replace(/\/+$/, "")}/` : "/",
    server: { host: "127.0.0.1", port: 3000, strictPort: true, proxy },
    preview: { host: "127.0.0.1", port: 3000, proxy },
    build: { outDir: "dist", sourcemap: true },
    css: { preprocessorOptions: { scss: { loadPaths: [fileURLToPath(new URL("./src", import.meta.url))] } } },
  };
});
