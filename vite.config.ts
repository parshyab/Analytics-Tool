import "dotenv/config";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "path";

const adminEmails = (process.env.LUMI_ADMIN_EMAILS ?? "").trim();

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  root: path.resolve(__dirname, "src/ui"),
  define: {
    __LUMI_DEV_MODE__: JSON.stringify(process.env.LUMI_DEV_MODE === "true"),
    __LUMI_ADMIN_EMAILS__: JSON.stringify(adminEmails),
    __LUMI_UI_BUILD_STAMP__: JSON.stringify(new Date().toISOString().slice(0, 16)),
  },
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: false,
    target: "es2017",
    cssCodeSplit: false,
    rollupOptions: {
      input: path.resolve(__dirname, "src/ui/index.html"),
    },
  },
});
