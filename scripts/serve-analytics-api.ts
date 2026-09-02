import "dotenv/config";
import http from "http";
import { URL } from "url";
import { createDefaultRepository } from "../src/backend/repositories/jsonDesignSystemRegistryRepository";
import { createDefaultProductivityStore } from "../src/backend/repositories/jsonProductivityStore";
import { createBenchmarkService } from "../src/backend/services/designSystemBenchmarkService";
import { indexDesignSystemLibrary, suggestReplacementMappings } from "../src/backend/services/designSystemIndexer";
import { FigmaLibraryClient } from "../src/backend/figma/figmaLibraryClient";
import { loadAndBuildReport, runLumiReportJob } from "../src/backend/services/runLumiReportJob";
import { getSmtpStatus, verifySmtpConnection } from "../src/backend/services/emailTransport";
import type { ReportPeriod } from "../src/backend/services/lumiReportService";
import { resolveReportDryRun } from "../src/backend/services/emailTransport";
import type { ProductivityResult, WorkSession } from "../src/types";

const PORT = Number(process.env.LUMI_ANALYTICS_API_PORT ?? "8788");
const OWNER_KEY = process.env.LUMI_ANALYTICS_OWNER_KEY?.trim() ?? "";

const repo = createDefaultRepository();
const productivityStore = createDefaultProductivityStore();
const benchmarkService = createBenchmarkService(repo);

function parsePeriod(value: string | null): ReportPeriod {
  if (value === "monthly" || value === "quarterly" || value === "weekly") return value;
  return "weekly";
}

function cors(res: http.ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Owner-Key");
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  cors(res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function parseFilters(url: URL) {
  return {
    dateFrom: url.searchParams.get("dateFrom") ?? undefined,
    dateTo: url.searchParams.get("dateTo") ?? undefined,
    month: url.searchParams.get("month") ?? undefined,
    fileKey: url.searchParams.get("fileKey") ?? undefined,
    flowName: url.searchParams.get("flowName") ?? undefined,
    teamName: url.searchParams.get("teamName") ?? undefined,
    jiraIssueKey: url.searchParams.get("jiraIssueKey") ?? undefined,
    designerName: url.searchParams.get("designerName") ?? undefined,
  };
}

function isOwner(req: http.IncomingMessage): boolean {
  if (!OWNER_KEY) return true;
  return req.headers["x-owner-key"] === OWNER_KEY;
}

const server = http.createServer(async (req, res) => {
  if (!req.url) return json(res, 400, { error: "Bad request" });

  if (req.method === "OPTIONS") {
    cors(res);
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  try {
    if (req.method === "GET" && (path === "/" || path === "")) {
      cors(res);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>LUMI Analytics API</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:640px;margin:48px auto;padding:0 20px;color:#1a1a1a;line-height:1.5}
  code{background:#f4f6f8;padding:2px 6px;border-radius:4px;font-size:13px}
  a{color:#0b57d0}
  .ok{color:#067647;font-weight:600}
  ul{padding-left:18px}
</style></head><body>
  <h1>LUMI Analytics API</h1>
  <p class="ok">Running on port ${PORT}</p>
  <p>This is a backend for the Figma plugin — not a website. Open <strong>Export → Send performance report</strong> in the plugin to email digests.</p>
  <h2>Quick checks</h2>
  <ul>
    <li><a href="/health">/health</a> — service status</li>
    <li><a href="/api/analytics/reports/preview?period=weekly">/api/analytics/reports/preview?period=weekly</a> — report preview JSON</li>
  </ul>
  <p>Keep this process running while you use the plugin. Send reports from Figma (admin), not from this browser tab.</p>
</body></html>`);
      return;
    }

    if (req.method === "GET" && path === "/health") {
      const smtp = getSmtpStatus();
      return json(res, 200, {
        ok: true,
        service: "lumi-analytics-api",
        email: {
          ...smtp,
          liveSendReady: smtp.canSendLive && !smtp.dryRunDefault,
        },
      });
    }

    if (req.method === "GET" && path === "/api/design-systems/libraries") {
      const libraries = await repo.getLibraries();
      return json(res, 200, { libraries });
    }

    if (req.method === "GET" && path === "/api/design-systems/components") {
      const components = await repo.getComponents({
        libraryId: url.searchParams.get("libraryId") ?? undefined,
        status: url.searchParams.get("status") ?? undefined,
        search: url.searchParams.get("search") ?? undefined,
      });
      return json(res, 200, { components });
    }

    if (req.method === "POST" && path === "/api/design-systems/libraries/sync") {
      if (!isOwner(req)) return json(res, 403, { error: "Owner key required" });
      const token = process.env.FIGMA_API_TOKEN?.trim();
      if (!token) return json(res, 400, { error: "FIGMA_API_TOKEN not configured on server" });

      const client = new FigmaLibraryClient(token);
      const libraries = await repo.getLibraries();
      const results = [];
      for (const lib of libraries) {
        const result = await indexDesignSystemLibrary(repo, client, {
          name: lib.name,
          slug: lib.slug,
          type: lib.type,
          status: lib.status,
          figmaFileKey: lib.figmaFileKey,
          figmaTeamId: lib.figmaTeamId,
          description: lib.description,
        });
        results.push({ slug: lib.slug, ...result });
      }
      await suggestReplacementMappings(repo);
      return json(res, 200, { ok: true, results });
    }

    if (req.method === "POST" && path === "/api/analytics/scans") {
      const body = JSON.parse(await readBody(req));
      const snapshot = await benchmarkService.ingestScanPayload(body);
      return json(res, 201, { ok: true, snapshotId: snapshot.id });
    }

    if (req.method === "POST" && path === "/api/analytics/productivity") {
      const body = JSON.parse(await readBody(req)) as {
        result?: ProductivityResult;
        session?: WorkSession;
      };
      if (!body.result?.id || !body.result?.sessionId) {
        return json(res, 400, { error: "result with id and sessionId is required" });
      }
      await productivityStore.upsertProductivityResult(body.result);
      if (body.session?.id) {
        await productivityStore.upsertSession(body.session);
      }
      return json(res, 201, { ok: true, resultId: body.result.id });
    }

    if (req.method === "GET" && path === "/api/analytics/reports/preview") {
      if (!isOwner(req)) return json(res, 403, { error: "Owner key required" });
      const period = parsePeriod(url.searchParams.get("period"));
      const bundle = await loadAndBuildReport(period);
      return json(res, 200, {
        ok: true,
        period: bundle.range,
        summary: bundle.summary,
        designers: bundle.designers,
        teams: bundle.teams,
        adoptionNarrative: bundle.adoptionNarrative,
        adminEfficiency: bundle.adminEfficiency,
        html: bundle.html,
      });
    }

    if (req.method === "POST" && path === "/api/analytics/reports/send") {
      if (!isOwner(req)) return json(res, 403, { error: "Owner key required" });
      const body = JSON.parse((await readBody(req)) || "{}") as {
        period?: string;
        dryRun?: boolean;
        recipients?: string[];
      };
      const period = parsePeriod(body.period ?? url.searchParams.get("period"));
      const dryRun = resolveReportDryRun(
        body.dryRun === true
          ? true
          : body.dryRun === false
            ? false
            : url.searchParams.get("dryRun") === "true"
              ? true
              : url.searchParams.get("dryRun") === "false"
                ? false
                : undefined
      );
      const recipients = Array.isArray(body.recipients)
        ? body.recipients.map((e) => String(e).trim().toLowerCase()).filter(Boolean)
        : [];
      if (!recipients.length) {
        return json(res, 400, {
          error: "recipients required — select who to send to (no default list)",
        });
      }
      const job = await runLumiReportJob({
        period,
        dryRun,
        recipients,
      });
      return json(res, job.send.ok ? 200 : 500, {
        ok: job.send.ok,
        period: job.bundle.range,
        summary: job.bundle.summary,
        recipients: job.recipients,
        send: job.send,
      });
    }

    if (req.method === "GET" && path === "/api/analytics/benchmark/lumi-vs-legacy") {
      const summary = await benchmarkService.getLumiVsLegacySummary(parseFilters(url));
      const opportunities = await benchmarkService.getMigrationOpportunities(parseFilters(url));
      return json(res, 200, { summary, opportunities });
    }

    if (req.method === "GET" && path === "/api/analytics/benchmark/trends") {
      const trends = await benchmarkService.getBenchmarkTrends(parseFilters(url));
      return json(res, 200, { trends });
    }

    if (req.method === "GET" && path === "/api/analytics/benchmark/by-flow") {
      const rows = await benchmarkService.getBenchmarkByFlow(parseFilters(url));
      return json(res, 200, { rows });
    }

    if (req.method === "GET" && path === "/api/analytics/benchmark/by-team") {
      const rows = await benchmarkService.getBenchmarkByTeam(parseFilters(url));
      return json(res, 200, { rows });
    }

    return json(res, 404, { error: "Not found" });
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    void (async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/health`);
        if (res.ok) {
          console.log(
            `LUMI Analytics API is already running on http://localhost:${PORT} — reusing it.`
          );
          console.log("You can send reports from Export without starting another instance.");
          process.exit(0);
        }
      } catch {
        /* fall through */
      }
      console.error(
        `Port ${PORT} is in use but /health is not responding.\n` +
          `Free it with:  lsof -ti :${PORT} | xargs kill\n` +
          `Then run:       npm run analytics-api`
      );
      process.exit(1);
    })();
    return;
  }
  console.error(err);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`LUMI Analytics API listening on http://localhost:${PORT}`);
  const smtp = getSmtpStatus();
  if (smtp.canSendLive && !smtp.dryRunDefault) {
    void verifySmtpConnection().then((v) => {
      if (v.ok) console.log("✓ SMTP verified — live report email enabled");
      else console.warn(`⚠ SMTP verify failed: ${v.error}`);
    });
  } else if (!smtp.dryRunDefault) {
    console.warn(
      "⚠ Live email requested (LUMI_REPORT_DRY_RUN=false) but SMTP is incomplete. Set LUMI_SMTP_* in .env."
    );
  } else {
    console.log("Report dry-run mode (LUMI_REPORT_DRY_RUN=true). Send report in plugin still sends live when clicked.");
  }
});
