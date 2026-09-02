import type { ReactNode } from "react";
import type { DesignerTrendSeries, TrendMetric } from "../../types";
import type { buildTrendCardSummary } from "../../productivity/productivityTrendAggregator";
import { getMetricValue } from "../charts/chartUtils";
import { Sparkline, sparkTrend } from "../charts/Sparkline";

type Summary = ReturnType<typeof buildTrendCardSummary>;

type Props = {
  cards: Summary;
  series: DesignerTrendSeries[];
  onMetricClick?: (metric: TrendMetric) => void;
  activeMetric?: TrendMetric;
};

function seriesValues(series: DesignerTrendSeries[], metric: TrendMetric): number[] {
  const points: { key: string; val: number }[] = [];
  for (const s of series) {
    for (const p of s.points) {
      points.push({ key: p.periodKey, val: getMetricValue(p, metric) });
    }
  }
  const byPeriod = new Map<string, number>();
  for (const pt of points) {
    byPeriod.set(pt.key, (byPeriod.get(pt.key) ?? 0) + pt.val);
  }
  return [...byPeriod.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

function TrendBadge({ values }: { values: number[] }) {
  const trend = sparkTrend(values);
  if (!trend) return null;
  return (
    <span className={`dash-trend-badge ${trend.positive ? "dash-trend-up" : "dash-trend-down"}`}>
      {trend.positive ? "↑" : "↓"} {trend.delta.toFixed(0)}%
    </span>
  );
}

function MetricIcon({ kind }: { kind: string }) {
  const icons: Record<string, string> = {
    balance: "⏱",
    lumi: "◆",
    lift: "↗",
    token: "◎",
    quality: "✦",
    reuse: "⊞",
    bench: "≡",
    leverage: "◈",
  };
  return <span className="dash-icon">{icons[kind] ?? "•"}</span>;
}

function SegmentedBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  return (
    <div className="dash-segmented">
      <div className="dash-segmented-track">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className="dash-segmented-fill"
            style={{ width: `${(seg.value / total) * 100}%`, background: seg.color }}
            title={`${seg.label}: ${seg.value.toFixed(0)}%`}
          />
        ))}
      </div>
      <div className="dash-segmented-legend">
        {segments.map((seg) => (
          <span key={seg.label}>
            <i style={{ background: seg.color }} />
            {seg.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function EnablementMetricCards({ cards, series, onMetricClick, activeMetric }: Props) {
  const lift = cards.hasBenchmark && cards.benchmarkHours > 0
    ? Math.max(0, ((cards.benchmarkHours - cards.actualHours) / cards.benchmarkHours) * 100)
    : 0;

  const savedValues = seriesValues(series, "observedHoursSaved");
  const lumiValues = seriesValues(series, "lumiAdoptionRate");
  const liftValues = seriesValues(series, "productivityLiftPercent");
  const tokenValues = seriesValues(series, "tokenAdoptionRate");
  const qualityValues = seriesValues(series, "qualityScore");

  const click = (m: TrendMetric) => onMetricClick?.(m);

  return (
    <div className="dash-bento">
      <article className="dash-card dash-hero">
        <div className="dash-card-top">
          <div className="dash-card-title-row">
            <MetricIcon kind="balance" />
            <span className="dash-card-title">Observed hours saved</span>
          </div>
          {cards.hasLiveSession && <span className="dash-live-tag">Live</span>}
        </div>

        <div className="dash-hero-body">
          <div className="dash-hero-main">
            <div className="dash-hero-value-row">
              <span className="dash-hero-value">
                {cards.hasBenchmark ? `${cards.observedHoursSaved.toFixed(1)}h` : "—"}
              </span>
              {cards.hasBenchmark && (
                <span className="dash-trend-badge dash-trend-up">↑ {lift.toFixed(0)}% lift</span>
              )}
            </div>
            <p className="dash-insight-pill">
              {cards.hasBenchmark
                ? `${lift.toFixed(0)}% productivity lift vs benchmark — enablement insight, not ranking`
                : "Add benchmarks to calculate hours saved and lift"}
            </p>

            <div className="dash-breakdown-cols">
              <div className="dash-breakdown-col">
                <span className="dash-breakdown-label">Actual time</span>
                <strong>{cards.actualHours.toFixed(1)}h</strong>
              </div>
              <div className="dash-breakdown-col dash-breakdown-col-accent">
                <span className="dash-breakdown-label">Benchmark</span>
                <strong>{cards.hasBenchmark ? `${cards.benchmarkHours.toFixed(1)}h` : "N/A"}</strong>
              </div>
            </div>
          </div>

          <div className="dash-hero-chart">
            <Sparkline values={savedValues.length ? savedValues : [cards.observedHoursSaved]} variant="bars" width={140} height={72} color="#6c5ce7" />
          </div>
        </div>
      </article>

      <MetricCard
        title="LUMI adoption"
        icon="lumi"
        value={`${cards.averageLumiAdoption.toFixed(0)}%`}
        values={lumiValues.length ? lumiValues : [cards.averageLumiAdoption]}
        color="#2563eb"
        active={activeMetric === "lumiAdoptionRate"}
        onClick={() => click("lumiAdoptionRate")}
        footer={
          <SegmentedBar
            segments={[
              { label: "LUMI", value: cards.averageLumiAdoption, color: "#2563eb" },
              { label: "Custom", value: Math.max(0, 100 - cards.averageLumiAdoption), color: "#e5e7eb" },
            ]}
          />
        }
      />

      <MetricCard
        title="Productivity lift"
        icon="lift"
        value={cards.hasBenchmark ? `${lift.toFixed(0)}%` : "N/A"}
        values={liftValues.length ? liftValues : [lift]}
        color="#6c5ce7"
        active={activeMetric === "productivityLiftPercent"}
        onClick={() => click("productivityLiftPercent")}
      />

      <MetricCard
        title="Token adoption"
        icon="token"
        value={`${cards.averageTokenAdoption.toFixed(0)}%`}
        values={tokenValues.length ? tokenValues : [cards.averageTokenAdoption]}
        color="#84cc16"
        active={activeMetric === "tokenAdoptionRate"}
        onClick={() => click("tokenAdoptionRate")}
        footer={
          <SegmentedBar
            segments={[
              { label: "Tokens", value: cards.averageTokenAdoption, color: "#84cc16" },
              { label: "Custom", value: Math.max(0, 100 - cards.averageTokenAdoption), color: "#fde68a" },
            ]}
          />
        }
      />

      <MetricCard
        title="Quality score"
        icon="quality"
        value={cards.qualityScore > 0 ? cards.qualityScore.toFixed(0) : "—"}
        values={qualityValues.length ? qualityValues : [cards.qualityScore]}
        color="#db2777"
        active={activeMetric === "qualityScore"}
        onClick={() => click("qualityScore")}
      />

      <MetricCard
        title="Components / hr"
        icon="reuse"
        value={cards.averageComponentsPerHour.toFixed(1)}
        values={seriesValues(series, "componentsReusedPerHour")}
        color="#0891b2"
        active={activeMetric === "componentReuse"}
        onClick={() => click("componentReuse")}
      />

      <MetricCard
        title="LUMI leverage"
        icon="leverage"
        value={cards.averageLeverageScore.toFixed(0)}
        values={seriesValues(series, "lumiLeverageScore")}
        color="#7c3aed"
        active={activeMetric === "lumiLeverageScore"}
        onClick={() => click("lumiLeverageScore")}
      />

      <MetricCard
        title="Sessions tracked"
        icon="bench"
        value={String(cards.sessions)}
        values={[]}
        color="#64748b"
        hideSparkline
        subtitle={`${cards.actualHours.toFixed(1)}h actual work`}
      />
    </div>
  );
}

function MetricCard({
  title,
  icon,
  value,
  values,
  color,
  active,
  onClick,
  footer,
  hideSparkline,
  subtitle,
}: {
  title: string;
  icon: string;
  value: string;
  values: number[];
  color: string;
  active?: boolean;
  onClick?: () => void;
  footer?: ReactNode;
  hideSparkline?: boolean;
  subtitle?: string;
}) {
  const Tag = onClick ? "button" : "article";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={`dash-card dash-metric ${active ? "dash-card-active" : ""}`}
      onClick={onClick}
    >
      <div className="dash-card-top">
        <div className="dash-card-title-row">
          <MetricIcon kind={icon} />
          <span className="dash-card-title">{title}</span>
        </div>
        <TrendBadge values={values} />
      </div>
      <div className="dash-metric-body">
        <div>
          <div className="dash-metric-value">{value}</div>
          {subtitle && <div className="dash-metric-sub">{subtitle}</div>}
        </div>
        {!hideSparkline && (
          <Sparkline values={values.length ? values : [0]} width={72} height={36} color={color} />
        )}
      </div>
      {footer}
    </Tag>
  );
}
