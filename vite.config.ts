import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5174,
  },
  build: {
    rollupOptions: {
      external: ["date-fns"],
    },
    cssMinify: "esbuild",
    minify: "esbuild",
  },
  css: {
    transformer: "postcss",
  },
})
