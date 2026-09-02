import fs from "fs";
import path from "path";

const distDir = path.resolve("dist");
const indexHtml = path.join(distDir, "index.html");
const uiHtml = path.join(distDir, "ui.html");

if (fs.existsSync(indexHtml)) {
  fs.renameSync(indexHtml, uiHtml);
  console.log("✓ Renamed dist/index.html → dist/ui.html");
}

for (const stale of ["ui.js", "ui.css"]) {
  const p = path.join(distDir, stale);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log(`✓ Removed stale dist/${stale}`);
  }
}
