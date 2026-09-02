import * as esbuild from "esbuild";

const ctx = await esbuild.context({
  entryPoints: ["src/main.ts", "src/ui/index.tsx"],
  outdir: "dist",
  bundle: true,
  target: "es2017",
  platform: "browser",
  jsx: "automatic",
  define: {
    __html__: '""',
  },
});

await ctx.watch();
console.log("Watching for changes…");
