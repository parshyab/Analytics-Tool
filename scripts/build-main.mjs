import "dotenv/config";
import esbuild from "esbuild";
import fs from "fs";
import path from "path";

const uiPath = path.resolve("dist/ui.html");
const uiHtml = fs.existsSync(uiPath) ? fs.readFileSync(uiPath, "utf8") : "";

if (!uiHtml.trim()) {
  console.warn("⚠ dist/ui.html missing or empty — main.js will use fallback HTML only.");
} else {
  console.log(`✓ Injecting dist/ui.html (${(uiHtml.length / 1024).toFixed(0)} KB) into __html__`);
}

const adminEmails = (process.env.LUMI_ADMIN_EMAILS ?? "").trim();
const reportRecipientOptions = (
  process.env.LUMI_REPORT_RECIPIENT_OPTIONS ??
  process.env.LUMI_REPORT_EMAILS ??
  ""
).trim();
if (adminEmails) {
  const count = adminEmails.split(",").filter((e) => e.trim()).length;
  console.log(`✓ LUMI_ADMIN_EMAILS loaded from .env (${count} entr${count === 1 ? "y" : "ies"})`);
} else {
  console.warn("⚠ LUMI_ADMIN_EMAILS not set — using fallback owner email only");
}
if (reportRecipientOptions) {
  const count = reportRecipientOptions.split(",").filter((e) => e.trim()).length;
  console.log(`✓ LUMI_REPORT_RECIPIENT_OPTIONS loaded (${count} dropdown entr${count === 1 ? "y" : "ies"})`);
}

await esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  outfile: "dist/main.js",
  target: "es2017",
  platform: "browser",
  loader: {
    ".json": "json",
  },
    define: {
    __html__: JSON.stringify(uiHtml),
    __LUMI_DEV_MODE__: JSON.stringify(process.env.LUMI_DEV_MODE === "true"),
    __LUMI_ANALYTICS_API_URL__: JSON.stringify(
      (process.env.LUMI_ANALYTICS_API_URL ?? "http://localhost:8788").replace(
        /\/\/127\.0\.0\.1/i,
        "//localhost"
      )
    ),
    __LUMI_ANALYTICS_OWNER_KEY__: JSON.stringify(process.env.LUMI_ANALYTICS_OWNER_KEY ?? ""),
    __LUMI_ADMIN_EMAILS__: JSON.stringify(adminEmails),
    __LUMI_REPORT_RECIPIENT_OPTIONS__: JSON.stringify(reportRecipientOptions),
    __LUMI_UI_BUILD_STAMP__: JSON.stringify(new Date().toISOString().slice(0, 16)),
  },
  logLevel: "info",
});
