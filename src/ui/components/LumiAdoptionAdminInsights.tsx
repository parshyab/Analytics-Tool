import type { LumiAdoptionAdminMetrics } from "../../backend/types/lumiAdoptionAdmin";

function pct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(0)}%`;
}

function statusClass(status: string): string {
  switch (status) {
    case "improved":
    case "positive":
      return "lumi-admin-badge lumi-admin-badge--good";
    case "at-risk":
      return "lumi-admin-badge lumi-admin-badge--risk";
    case "needs-monitoring":
      return "lumi-admin-badge lumi-admin-badge--warn";
    default:
      return "lumi-admin-badge lumi-admin-badge--neutral";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "improved":
      return "Improved";
    case "positive":
      return "On track";
    case "at-risk":
      return "At risk";
    case "needs-monitoring":
      return "Needs monitoring";
    case "baseline-unavailable":
      return "Baseline unavailable";
    default:
      return "Current";
  }
}

type Props = {
  metrics: LumiAdoptionAdminMetrics;
};

export function LumiAdoptionAdminInsights({ metrics }: Props) {
  const { rates, totals, comparison } = metrics;
  const hasBaseline = comparison?.hasBaseline ?? false;
  const gainScore = hasBaseline
    ? rates.productivityGainScore
    : rates.lumiEfficiencyScore;
  const showGainUnavailable = !hasBaseline && metrics.hasScanData;

  const metricCards = [
    {
      title: "LUMI Reuse",
      value: pct(rates.lumiReuseRate),
      description: "Share of UI using reusable LUMI components.",
      empty: totals.totalComponentInstances === 0,
    },
    {
      title: "Legacy DS Usage",
      value: pct(rates.legacyUsageRate),
      description: "Remaining dependency on older design systems.",
      empty: !metrics.hasClassificationData,
    },
    {
      title: "Custom Usage",
      value: totals.customUiCandidates === 0 ? "None" : pct(rates.customUsageRate),
      description:
        totals.customUiCandidates === 0
          ? "No custom UI detected in this scope."
          : "Custom UI patterns outside LUMI.",
      empty: false,
    },
    {
      title: "Detachment Rate",
      value: totals.detachedCandidates === 0 ? "None" : pct(rates.detachmentRate),
      description:
        totals.detachedCandidates === 0
          ? "No detached components detected."
          : "Detached components create design debt.",
      empty: false,
    },
    {
      title: "Custom Styles",
      value: pct(rates.customStyleRate),
      description: "Custom styles reduce consistency and handoff quality.",
      empty: totals.customColors + totals.customTextStyles === 0 && rates.customStyleRate === 0,
    },
    {
      title: "Rework Signal",
      value: metrics.reworkLevel,
      description: "Potential cleanup effort before handoff.",
      empty: false,
    },
    {
      title: "LUMI Efficiency Score",
      value: `${rates.lumiEfficiencyScore.toFixed(0)} / 100`,
      description: "Composite score for LUMI adoption vs custom/legacy patterns.",
      empty: !metrics.hasScanData,
    },
    {
      title: "Design Debt",
      value: pct(rates.designDebtRate),
      description: "Legacy + detached + custom design work.",
      empty: !metrics.hasScanData,
    },
  ];

  return (
    <section className="lumi-admin-section" aria-label="LUMI efficiency vs older design systems">
      <header className="lumi-admin-header">
        <p className="lumi-admin-eyebrow">Admin insights</p>
        <h2 className="lumi-admin-title">LUMI efficiency vs older design systems</h2>
        <p className="lumi-admin-subtitle">
          Measures how much LUMI improves productivity by reducing custom UI, detachments, custom
          styles, and rework compared with NDS Beauty, NDS Fashion, and legacy libraries.
        </p>
      </header>

      {!metrics.hasScanData ? (
        <div className="lumi-admin-empty">
          Run a LUMI adoption scan to calculate LUMI efficiency.
        </div>
      ) : (
        <>
          <div className="lumi-admin-hero-grid">
            <article className="lumi-admin-card lumi-admin-card--hero">
              <h3 className="lumi-admin-card-title">Productivity Gain</h3>
              {showGainUnavailable ? (
                <>
                  <p className="lumi-admin-hero-unavailable">Not enough baseline data yet</p>
                  <p className="lumi-admin-card-desc">
                    Productivity gain compares current scans against earlier sessions. Finish more
                    sessions with DS classification enabled to unlock trend comparison.
                  </p>
                  <div className="lumi-admin-efficiency-fallback">
                    <span className="lumi-admin-efficiency-label">LUMI efficiency</span>
                    <span className="lumi-admin-hero-score">{rates.lumiEfficiencyScore.toFixed(0)}</span>
                    <span className="lumi-admin-hero-denom">/ 100</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="lumi-admin-hero-score-row">
                    <span className="lumi-admin-hero-score">
                      {gainScore !== null ? gainScore.toFixed(0) : "—"}
                    </span>
                    <span className="lumi-admin-hero-denom">/ 100</span>
                  </div>
                  <p className="lumi-admin-card-desc">
                    Productivity gain is not only hours saved — it reflects reduced design debt and
                    increased reusable LUMI usage.
                  </p>
                </>
              )}

              <div className="lumi-admin-formula">
                <span className="lumi-admin-formula-label">Productivity Gain =</span>
                <ul className="lumi-admin-formula-list">
                  <li className="lumi-admin-formula-item lumi-admin-formula-item--down">↓ Custom usage</li>
                  <li className="lumi-admin-formula-item lumi-admin-formula-item--up">↑ LUMI reuse</li>
                  <li className="lumi-admin-formula-item lumi-admin-formula-item--down">↓ Detachment rate</li>
                  <li className="lumi-admin-formula-item lumi-admin-formula-item--down">↓ Custom styles</li>
                  <li className="lumi-admin-formula-item lumi-admin-formula-item--down">↓ Rework</li>
                </ul>
              </div>
            </article>

            <div className="lumi-admin-factors">
              <h3 className="lumi-admin-factors-title">Contributors</h3>
              <ul className="lumi-admin-contributors">
                {metrics.factorContributors.map((f) => (
                  <li key={f.id} className="lumi-admin-contributor">
                    <span className="lumi-admin-contributor-label">{f.label}</span>
                    <span className="lumi-admin-contributor-value">
                      {f.displayImprovement ?? f.displayValue}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lumi-admin-metrics-grid">
            {metricCards.map((card) => (
              <article key={card.title} className="lumi-admin-card lumi-admin-card--metric">
                <h4 className="lumi-admin-metric-title">{card.title}</h4>
                <p className="lumi-admin-metric-value">{card.empty ? "—" : card.value}</p>
                <p className="lumi-admin-card-desc">{card.description}</p>
              </article>
            ))}
          </div>

          <article className="lumi-admin-card lumi-admin-card--table">
            <h3 className="lumi-admin-card-title">LUMI vs older design systems</h3>
            {!hasBaseline && (
              <p className="lumi-admin-baseline-note">
                Legacy benchmark unavailable. Add NDS Beauty and NDS Fashion libraries to compare
                LUMI efficiency against older design systems.
              </p>
            )}
            <div className="table-scroll">
              <table className="trend-table lumi-admin-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Older DS / Legacy</th>
                    <th>LUMI</th>
                    <th>Improvement</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.comparisonRows.map((row) => (
                    <tr key={row.metric}>
                      <td>{row.metric}</td>
                      <td>{row.legacyLabel}</td>
                      <td>{row.lumiLabel}</td>
                      <td>{row.improvementLabel}</td>
                      <td>
                        <span className={statusClass(row.status)}>{statusLabel(row.status)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <section className="lumi-admin-breakdown">
            <h3 className="lumi-admin-card-title">What is driving productivity gain?</h3>
            <div className="lumi-admin-breakdown-grid">
              {metrics.factorContributors.map((f) => (
                <article key={f.id} className="lumi-admin-card lumi-admin-card--factor">
                  <div className="lumi-admin-factor-head">
                    <h4 className="lumi-admin-factor-title">{f.label}</h4>
                    <span className={statusClass(f.status)}>{statusLabel(f.status)}</span>
                  </div>
                  <p className="lumi-admin-card-desc">{f.description}</p>
                  <div className="lumi-admin-factor-stats">
                    <div>
                      <span className="lumi-admin-stat-label">Current</span>
                      <strong>{f.displayValue}</strong>
                    </div>
                    {f.displayPrevious && (
                      <div>
                        <span className="lumi-admin-stat-label">Previous</span>
                        <strong>{f.displayPrevious}</strong>
                      </div>
                    )}
                    {f.displayImprovement && (
                      <div>
                        <span className="lumi-admin-stat-label">Change</span>
                        <strong className="lumi-admin-stat-change">{f.displayImprovement}</strong>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          {metrics.insights.length > 0 && (
            <article className="lumi-admin-card lumi-admin-card--insights">
              <h3 className="lumi-admin-card-title">Recommended actions</h3>
              <ul className="lumi-admin-insights">
                {metrics.insights.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </article>
          )}
        </>
      )}
    </section>
  );
}
