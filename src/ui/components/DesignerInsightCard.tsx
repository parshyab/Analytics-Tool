import type { DesignerAggregate } from "../../types";

type Props = {
  designer: DesignerAggregate;
  selected?: boolean;
  onClick?: () => void;
};

export function DesignerInsightCard({ designer, selected, onClick }: Props) {
  const hasBenchmark = designer.benchmarkHours > 0;

  return (
    <button
      type="button"
      className={`dash-insight-card ${selected ? "dash-insight-selected" : ""}`}
      onClick={onClick}
    >
      <div className="dash-insight-head">
        <div className="dash-insight-profile">
          <div className="dash-insight-avatar">{designer.designerName.charAt(0).toUpperCase()}</div>
          <div>
            <strong className="dash-insight-name">{designer.designerName}</strong>
            <span className="dash-insight-team">{designer.teamName ?? "Unassigned"}</span>
          </div>
        </div>
        <span className={`confidence-pill confidence-${designer.confidence}`}>
          {designer.confidence}
        </span>
      </div>

      <div className="dash-insight-hero">
        <span className="dash-insight-hero-label">Observed saved</span>
        <div className="dash-insight-hero-row">
          <span className="dash-insight-hero-value">
            {hasBenchmark && designer.observedHoursSaved > 0
              ? `${designer.observedHoursSaved.toFixed(1)}h`
              : "—"}
          </span>
          <span className="dash-trend-badge dash-trend-up">
            ↑ {designer.productivityLiftPercent.toFixed(0)}% lift
          </span>
        </div>
      </div>

      <div className="dash-insight-grid">
        <InsightStat label="Actual" value={`${designer.actualHours.toFixed(1)}h`} accent="blue" />
        <InsightStat
          label="Benchmark"
          value={hasBenchmark ? `${designer.benchmarkHours.toFixed(1)}h` : "N/A"}
          accent="lime"
        />
        <InsightStat label="LUMI adoption" value={`${designer.lumiAdoptionRate.toFixed(0)}%`} />
        <InsightStat label="Quality" value={designer.qualityScore.toFixed(0)} />
      </div>

      <div className="dash-insight-bar">
        <div
          className="dash-insight-bar-fill"
          style={{ width: `${Math.min(100, designer.lumiAdoptionRate)}%` }}
        />
      </div>

      <div className="dash-insight-foot">
        {designer.sessions} session{designer.sessions !== 1 ? "s" : ""} · {designer.tickets} ticket
        {designer.tickets !== 1 ? "s" : ""} · {designer.componentsReusedPerHour.toFixed(1)} comp/hr
      </div>
    </button>
  );
}

function InsightStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "blue" | "lime";
}) {
  return (
    <div className={`dash-insight-stat ${accent ? `dash-insight-stat-${accent}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
