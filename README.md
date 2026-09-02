# LUMI Analytics — Productivity & Adoption Dashboard

A Figma plugin that measures **LUMI design system adoption** and **designer productivity** from opt-in work sessions, LUMI scans, and historical benchmarks.

Built on top of [figma-calculations](https://www.npmjs.com/package/figma-calculations) (Pinterest) for style/component adoption metrics, with a productivity layer for Nykaa design teams.

## What it does

| Category | Metrics |
|----------|---------|
| **Measured** | Session duration, LUMI adoption %, component instances, text/color style usage, token usage, detached components, quality score |
| **Benchmarked** | Historical median/average time for similar work, sample size, benchmark confidence |
| **Calculated** | Hours saved, productivity lift %, LUMI-attributed hours saved, components reused/hour, design system leverage score |

## Privacy principles

- **One-time consent** — stored in `lumi.consent.v1`; only re-asked if version changes, you decline, or you delete local data
- **Opt-in only** — sessions start when you start one, or auto-start after consent (configurable)
- **No silent tracking** — we do not monitor every click or desktop activity
- **Plugin-scoped** — LUMI runs while the plugin is open or hidden (`figma.ui.hide()`). It cannot run before you open the plugin or after you close it
- **Local-first** — v1 stores data in `figma.clientStorage` (no backend required)
- **Not surveillance** — dashboards are for design system improvement and enablement, not performance ranking

## Quick start

```bash
npm install
npm run build
```

This produces:
- `dist/ui.html` — single-file UI with inlined JS + CSS
- `dist/main.js` — plugin sandbox code with UI HTML embedded via `__html__`

Build order: UI first, then main (main injects `dist/ui.html` into `figma.showUI(__html__, …)`).

In Figma Desktop:

1. **Plugins → Development → Import plugin from manifest…**
2. Select `manifest.json`
3. **Re-import after every `npm run build` or manifest change** (Figma caches plugin files; Jira network access is declared in `manifest.json`)
4. Run **LUMI Analytics**

## Plugin tabs

1. **Welcome / Consent** — One-time allow, anonymous, or decline
2. **Start Session** — Confirm Jira ticket (auto-suggested), flow, and scan scope in under 5 seconds; advanced metadata is inferred or optional
3. **Active Session** — Live timer, pause/resume, finish, **Run in background**, restore interrupted sessions
4. **My Productivity** — Personal dashboard
5. **Designer Productivity** — LUMI Enablement Insights (team view)
6. **Team Dashboard** — Aggregated by team
7. **Monthly Dashboard** — Trends and charts
8. **LUMI Adoption** — Style/component/token adoption from scans
9. **Benchmarks** — Manual baselines and historical matching
10. **Privacy** — Consent status, auto-start, background mode, export, delete local data
11. **Settings** — LUMI library prefix, team name, optional cloud scanning
12. **Export** — CSV and JSON exports

## How to use

### 1. Consent (one-time)
On first open, choose **Allow and continue**, **Continue anonymously**, or **Decline**. Consent is saved to `lumi.consent.v1` and not shown again unless you decline, delete local data, or the consent version changes.

### 2. Auto-start (optional)
In **Privacy**, enable **Auto-start session when LUMI plugin opens**. When enabled and consent is given, LUMI creates a draft session automatically on plugin open (no duplicate if one already exists).

**Full automation (default for new installs):** Privacy → **Automation** — auto-start, infer Jira/file metadata, hide UI in background, auto-finish + scan on plugin close, and auto-finish stale sessions on reopen. Designers only need to open LUMI once per file; no timer clicks required.

### Scheduled stakeholder reports (no manual Send)
- **GitHub Actions:** `.github/workflows/lumi-reports.yml` sends weekly/monthly/quarterly on period boundaries. Set `LUMI_REPORT_EMAILS` secret (or uses `LUMI_REPORT_RECIPIENT_OPTIONS`).
- **Local cron:** `npm run report:schedule` (reads recipients from `.env`, same period rules as CI). Requires `npm run analytics-api` data + SMTP.

### 3. Start a session manually
Fill in project, ticket (e.g. `UX-458`), flow, work type, complexity, and scan scope. Click **Start Session**.

### 4. Work in Figma
Timer runs while session is active. Pause/resume as needed. Use **Run in background** to hide the UI while keeping the session active (plugin must stay open).

### 5. Restore interrupted sessions
If you reopen the plugin with an active session, LUMI shows a restore screen: continue, pause time since last seen, edit minutes, finish, or discard. Sessions idle 30+ minutes show a warning.

### 6. Finish session
Confirm actual minutes, choose adjustment reason, optionally run **LUMI scan**. Hours saved requires a benchmark; without one, actual time and LUMI adoption are still saved.

### 7. View results
Check **My Productivity**, **Monthly** (productivity trends), **LUMI Adoption**, and team dashboards.

## Productivity trend charts

The **Monthly** tab includes real-time designer productivity trends:

- **Hours saved trend** — observed and LUMI-attributed hours saved over time
- **Actual vs benchmark hours** — grouped bar comparison
- **Productivity lift %** — design system productivity trend
- **LUMI adoption %** — LUMI enablement trend
- **Component reuse** and **quality score** over time

Filters: designer, team, date range, project, flow, metric, group by (day/week/month), confidence, and view scope (my data / team / full).

Charts update when sessions start, heartbeat saves, finish + scan completes, or filters change. Active sessions show live actual hours; hours saved requires a finished session with a benchmark.

Export filtered trend data via **Export filtered trend CSV** on the Monthly tab.

## Acceptance tests

| # | Scenario | Expected |
|---|----------|----------|
| 1 | First-time user opens plugin | Consent screen appears |
| 2 | User gives consent, closes and reopens | Consent screen does not appear |
| 3 | Auto-start enabled, open plugin | Draft session starts automatically |
| 4 | Click **Run in background** | UI hides, session stays active, notification appears |
| 5 | Reopen plugin with active session | Session restored, no duplicate created |
| 6 | Plugin unseen 30+ minutes | Restore screen with continue/pause/edit/finish/discard + warning |
| 7 | User deletes consent data, reopens | Consent screen appears again |
| 8 | Finish session with benchmark | Actual time, benchmark, hours saved, productivity lift, confidence shown |
| 9 | Finish session without benchmark | Actual time + LUMI adoption saved; hours saved shows benchmark unavailable |

## figma-calculations integration

The adapter (`src/calculations/figmaCalculationsAdapter.ts`) wraps the library:

- `processTree()` — full/partial text and fill style matches
- `getAdoptionPercent()` — style library adoption
- `getTextStylePercentage()` / `getFillStylePercent()` — style adoption rates
- `getBreakDownByTeams()` — team-level breakdown (cloud mode)

A lookup patch prevents crashes when FILL style buckets are missing (gradient-only libraries).

## Productivity formulas

```
Observed minutes saved = Benchmark median minutes − Actual session minutes
Observed hours saved   = max(0, observed minutes saved) / 60
Productivity lift %    = ((benchmark − actual) / benchmark) × 100

LUMI leverage factor   = (0.45×LUMI adoption + 0.20×token + 0.15×style + 0.20×quality) / 100
LUMI-attributed hours  = Observed hours saved × LUMI leverage factor

Design system leverage = 0.35×LUMI + 0.20×token + 0.15×style + 0.15×lowDetachment + 0.15×quality
```

**If no benchmark exists:** actual time and adoption metrics are saved; hours saved shows **Benchmark unavailable**.

## Benchmarks

Matching hierarchy:

1. Exact match (project + flow + work type + complexity + platform)
2. Flow match
3. Work type match
4. Complexity match
5. Manual baseline
6. Unavailable

Confidence: High (10+ sessions), Medium (5–9), Low (2–4), Unavailable (<2).

Example manual baseline: Checkout + New flow + High = 140 minutes.

## Confidence scoring

| Factor | Points |
|--------|--------|
| Session completed | +25 |
| Actual minutes confirmed | +15 |
| LUMI scan completed | +20 |
| Benchmark high/medium/low | +25 / +15 / +8 |
| Specific scan scope | +10 |
| Whole file scan only | +3 |
| Long unadjusted session (>8h) | −15 |

## Export

- Designer Productivity CSV
- Work Sessions CSV
- Monthly Summary CSV
- Benchmarks CSV
- Full JSON (sessions, scans, results, assumptions)

Emails excluded by default — enable in Settings or Export tab.

## Scheduled stakeholder reports

Admins send **per-designer performance** and **LUMI adoption** digests from **Export → Send performance report**.

Recipients are **never auto-selected**. Choose who to email from the dropdown (options from `LUMI_REPORT_RECIPIENT_OPTIONS`):

- sudhakar.pandey@nykaa.com  
- vipul.gupta@nykaa.com  
- jay.hasija@nykaa.com  
- rajesh@nykaa.com  

### How data reaches the report

1. Keep `npm run analytics-api` running (default `http://localhost:8788`).
2. Designers finish sessions with a LUMI scan — the plugin POSTs scan + productivity payloads.
3. Data lands in `data/design-system-store.json` and `data/productivity-store.json`.

### Generate / send

**In the plugin (admin):** Export → pick period → add recipients from the dropdown → Dry-run or Send report.

**CLI** (recipients required via `--to`):

```bash
npm run report:preview -- --period weekly
npm run report:send -- --period weekly --to sudhakar.pandey@nykaa.com,vipul.gupta@nykaa.com
```

Set `LUMI_SMTP_HOST`, `LUMI_SMTP_FROM`, credentials, and `LUMI_REPORT_DRY_RUN=false` to send for real.

API (owner key when `LUMI_ANALYTICS_OWNER_KEY` is set):

- `GET /api/analytics/reports/preview?period=weekly`
- `POST /api/analytics/reports/send` body `{ "period": "monthly", "recipients": ["…"], "dryRun": true }`

Optional GitHub Actions: `.github/workflows/lumi-reports.yml` — only sends when `LUMI_REPORT_EMAILS` secret is set (explicit schedule list).

## Optional cloud scanning

For team-level scanning outside the plugin, use the CLI:

```bash
cp .env.example .env   # add FIGMA_API_TOKEN, team IDs
npm run analyze:cloud
```

## Project structure

```
src/
  main.ts                          # Plugin sandbox entry
  types.ts                         # Shared types
  calculations/figmaCalculationsAdapter.ts
  scanner/lumiScanner.ts           # LUMI scan + section traversal
  scanner/sectionTraversal.ts
  productivity/                    # Sessions, benchmarks, export
  ui/                              # React dashboard
manifest.json
dist/                              # Built output (after npm run build)
```

## Jira connection (Figma plugin)

**Why a proxy?** Jira Cloud does not allow direct API calls from Figma plugins (CORS / null origin). Manifest `allowedDomains` cannot fix this. LUMI uses a small local proxy that forwards requests to Jira with your credentials.

### Setup (every time you work with Jira)

**Terminal 1 — start the proxy:**
```bash
npm run jira-proxy
```
You should see: `LUMI Jira proxy listening on http://localhost:8787`

**Terminal 2 — build the plugin:**
```bash
npm run build
```

**Figma:**
1. Plugins → Development → Import plugin from manifest… (re-import after manifest/build changes)
2. Open **LUMI Analytics → Jira** tab
3. Data source mode: **Proxy (recommended)**
4. Proxy URL: `http://localhost:8787`
5. Enter Jira email + API token → **Test connection** → **Sync UX tickets**

**Mock mode** (no Jira/proxy): set Data source mode → Mock for local UI testing only.

For production, deploy `server/jira-proxy.mjs` to an internal HTTPS host and set that URL as Proxy URL (add it to `manifest.json` `allowedDomains`).

## Known limitations

- Jira integration: connect with your Nykaa Jira email and API token; sync UX tickets your account can view; designers are grouped by Jira assignee on each ticket
- Team library styles may require Figma API token for full figma-calculations coverage
- Shared plugin data stores compact summaries only (size limits)
- Large whole-file scans may take time with dynamic-page access
- `figma.currentUser` may be null — manual name entry supported

## Development
image.png
```bash
npm run build    # Build plugin
npm run watch    # Rebuild on changes (if watch script configured)
```

## License

ISC
