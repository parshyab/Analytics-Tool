import { useMemo } from "react";
import type { PluginState } from "../../types";
import { computeLumiAdoptionAdminMetrics } from "../../backend/services/lumiAdoptionAdminMetrics";
import { PageSection, EmptyPanel } from "./PageLayout";
import { postMessage, KpiCard } from "../hooks";
import { LumiAdoptionAdminInsights } from "./LumiAdoptionAdminInsights";

export function LumiAdoption({ state }: { state: PluginState }) {
  const latestScan = state.scans[state.scans.length - 1];
  const isAdmin = state.lumiAccess?.canViewAdminInsights ?? false;

  const adminMetrics = useMemo(
    () => computeLumiAdoptionAdminMetrics(state.scans, state.dsRegistrySyncedAt ?? null),
    [state.scans, state.dsRegistrySyncedAt]
  );

  if (!latestScan) {
    return (
      <>
        <EmptyPanel
          icon="📊"
          title="No scan data yet"
          body="Finish a work session with LUMI scan enabled to see adoption metrics."
        />
        {isAdmin && <LumiAdoptionAdminInsights metrics={adminMetrics} />}
      </>
    );
  }

  const raw = latestScan.figmaCalculationsRaw as {
    textStylePercent?: { full: number; partial: number };
    fillStylePercent?: { full: number; partial: number };
  } | undefined;

  return (
    <>
      <PageSection
        title="LUMI adoption summary"
        subtitle="Component, token, and style usage from your latest scan"
      >
        <div className="grid">
          <KpiCard label="LUMI adoption" value={`${latestScan.lumiAdoptionRate.toFixed(0)}%`} source="measured" />
          <KpiCard label="Text style adoption" value={`${latestScan.textStyleAdoptionRate.toFixed(0)}%`} source="measured" />
          <KpiCard label="Color style adoption" value={`${latestScan.colorStyleAdoptionRate.toFixed(0)}%`} source="measured" />
          <KpiCard label="Token adoption" value={`${latestScan.tokenAdoptionRate.toFixed(0)}%`} source="measured" />
          <KpiCard label="Total LUMI instances" value={String(latestScan.lumiComponentInstances)} source="measured" />
          <KpiCard label="Unique LUMI components" value={String(latestScan.uniqueLumiComponents)} source="measured" />
        </div>
      </PageSection>

      <PageSection title="Component usage" flush>
        <div className="table-scroll">
          <table className="trend-table">
            <thead>
              <tr><th>Component</th><th>Instances</th><th>Locations</th></tr>
            </thead>
            <tbody>
              {latestScan.lumiComponentUsage.length === 0 ? (
                <tr>
                  <td colSpan={3} className="empty">No LUMI components detected in this scan.</td>
                </tr>
              ) : (
                latestScan.lumiComponentUsage.map((c) => (
                  <tr key={c.componentKey}>
                    <td>{c.componentName}</td>
                    <td>{c.instances}</td>
                    <td>
                      <div className="btn-row btn-row-inline">
                        {c.locations.slice(0, 3).map((l) => (
                          <button
                            key={l.nodeId}
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => postMessage({ type: "ZOOM_TO_NODE", nodeId: l.nodeId })}
                          >
                            {l.sectionName ?? l.frameName ?? l.pageName}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PageSection>

      <PageSection title="Token / style adoption" flush>
        <div className="table-scroll">
          <table className="trend-table">
            <thead>
              <tr><th>Style type</th><th>Full matches</th><th>Partial matches</th><th>Adoption %</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Text</td>
                <td>{raw?.textStylePercent ? `${(raw.textStylePercent.full * 100).toFixed(1)}%` : "—"}</td>
                <td>{raw?.textStylePercent ? `${(raw.textStylePercent.partial * 100).toFixed(1)}%` : "—"}</td>
                <td>{latestScan.textStyleAdoptionRate.toFixed(0)}%</td>
              </tr>
              <tr>
                <td>Fill / Color</td>
                <td>{raw?.fillStylePercent ? `${(raw.fillStylePercent.full * 100).toFixed(1)}%` : "—"}</td>
                <td>{raw?.fillStylePercent ? `${(raw.fillStylePercent.partial * 100).toFixed(1)}%` : "—"}</td>
                <td>{latestScan.colorStyleAdoptionRate.toFixed(0)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </PageSection>

      <PageSection title="Quality signals" flush>
        {latestScan.qualitySignals.length === 0 ? (
          <p className="empty">No quality issues detected — great LUMI hygiene.</p>
        ) : (
          <div className="table-scroll">
            <table className="trend-table">
              <thead>
                <tr><th>Issue</th><th>Count</th><th>Severity</th><th>Recommendation</th></tr>
              </thead>
              <tbody>
                {latestScan.qualitySignals.map((q, i) => (
                  <tr key={i}>
                    <td>{q.type}</td>
                    <td>{q.count}</td>
                    <td>{q.severity}</td>
                    <td>{q.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageSection>

      {!isAdmin && (
        <PageSection title="Recommendations" subtitle="Actions for your current work">
          <ul className="consent-list">
            {latestScan.lumiAdoptionRate < 70 && (
              <li>Increase LUMI component usage — swap repeated patterns for library instances.</li>
            )}
            {latestScan.detachedCandidates > 0 && (
              <li>Replace {latestScan.detachedCandidates} detached candidate(s) with linked LUMI components.</li>
            )}
            {latestScan.customColors > 0 && (
              <li>Apply LUMI color styles instead of {latestScan.customColors} custom color node(s).</li>
            )}
            {latestScan.customTextStyles > 0 && (
              <li>Apply LUMI text styles to {latestScan.customTextStyles} unstyled text node(s).</li>
            )}
            {latestScan.qualityScore >= 80 && latestScan.detachedCandidates === 0 && (
              <li>Strong LUMI adoption — keep using library components and tokens in new work.</li>
            )}
          </ul>
        </PageSection>
      )}

      {isAdmin && <LumiAdoptionAdminInsights metrics={adminMetrics} />}
    </>
  );
}
