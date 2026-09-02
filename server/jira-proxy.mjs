/**
 * Local Jira CORS proxy for LUMI Analytics Figma plugin.
 *
 * Jira Cloud REST API does not allow browser/plugin requests (no ACAO header).
 * This proxy adds CORS headers and forwards requests server-side.
 *
 * Usage: npm run jira-proxy
 * Plugin proxy URL: http://localhost:8787
 */
import http from "node:http";
import https from "node:https";

const PORT = Number(process.env.JIRA_PROXY_PORT ?? 8787);

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function normalizeSiteUrl(url) {
  const base = String(url ?? "https://nykmage.atlassian.net").trim().replace(/\/+$/, "");
  return base.startsWith("http") ? base : `https://${base}`;
}

function jiraRequest({ siteUrl, email, apiToken, path, method = "GET", query }) {
  const base = normalizeSiteUrl(siteUrl);
  const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");
  let url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  if (query && Object.keys(query).length > 0) {
    const qs = Object.entries(query)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    url += `?${qs}`;
  }

  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method,
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({ status: res.statusCode ?? 500, text });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function handleMyself(body, res) {
  const { siteUrl, email, apiToken } = body;
  if (!siteUrl || !email || !apiToken) {
    sendJson(res, 400, { error: "siteUrl, email, and apiToken are required." });
    return;
  }
  const result = await jiraRequest({
    siteUrl,
    email,
    apiToken,
    path: "/rest/api/3/myself",
  });
  if (result.status >= 400) {
    sendJson(res, result.status, {
      error: result.status === 401 ? "Invalid Jira email or API token." : result.text.slice(0, 220),
    });
    return;
  }
  sendJson(res, 200, JSON.parse(result.text));
}

async function handleSearch(body, res) {
  const { siteUrl, email, apiToken, jql, fields, startAt = 0, maxResults = 100 } = body;
  if (!siteUrl || !email || !apiToken || !jql) {
    sendJson(res, 400, { error: "siteUrl, email, apiToken, and jql are required." });
    return;
  }
  const fieldList = Array.isArray(fields) ? fields.join(",") : String(fields ?? "");
  const result = await jiraRequest({
    siteUrl,
    email,
    apiToken,
    path: "/rest/api/3/search",
    query: {
      jql,
      startAt: String(startAt),
      maxResults: String(maxResults),
      fields: fieldList,
    },
  });
  if (result.status >= 400) {
    sendJson(res, result.status, {
      error:
        result.status === 401
          ? "Invalid Jira email or API token."
          : result.status === 403
            ? "Your Jira account does not have permission to view these tickets or this project."
            : result.text.slice(0, 220),
    });
    return;
  }
  sendJson(res, 200, JSON.parse(result.text));
}

async function handleIssue(body, res) {
  const { siteUrl, email, apiToken, issueKey, fields } = body;
  if (!siteUrl || !email || !apiToken || !issueKey) {
    sendJson(res, 400, { error: "siteUrl, email, apiToken, and issueKey are required." });
    return;
  }
  const fieldList = Array.isArray(fields) ? fields.join(",") : String(fields ?? "");
  const result = await jiraRequest({
    siteUrl,
    email,
    apiToken,
    path: `/rest/api/3/issue/${String(issueKey).toUpperCase()}`,
    query: fieldList ? { fields: fieldList } : undefined,
  });
  if (result.status >= 400) {
    sendJson(res, result.status, { error: result.text.slice(0, 220) });
    return;
  }
  sendJson(res, 200, JSON.parse(result.text));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
    });
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { ok: true, service: "lumi-jira-proxy" });
      return;
    }

    const body = req.method === "POST" ? await readBody(req) : {};

    if (req.method === "POST" && url.pathname === "/api/jira/myself") {
      await handleMyself(body, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/jira/search") {
      await handleSearch(body, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/jira/issue") {
      await handleIssue(body, res);
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(PORT, () => {
  console.log(`LUMI Jira proxy listening on http://localhost:${PORT}`);
  console.log("Set plugin Data source mode → Proxy and Proxy URL → http://localhost:8787");
});
