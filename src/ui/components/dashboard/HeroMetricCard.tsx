import { MetricChip, MetricTypeChip } from "./MetricChip";

type Props = {
  title: string;
  value: string;
  trendLabel?: string;
  actualLabel: string;
  actualValue: string;
  benchmarkLabel: string;
  benchmarkValue: string;
  caption?: string;
  actualHours?: number;
  benchmarkHours?: number;
  live?: boolean;
};

export function HeroMetricCard({
  title,
  value,
  trendLabel,
  actualLabel,
  actualValue,
  benchmarkLabel,
  benchmarkValue,
  caption,
  actualHours = 0,
  benchmarkHours = 0,
  live,
}: Props) {
  const maxBar = Math.max(actualHours, benchmarkHours, 0.1);
  const actualPct = Math.max(4, (actualHours / maxBar) * 100);
  const benchPct = Math.max(4, (benchmarkHours / maxBar) * 100);

  return (
    <article className="dash-card dash-card--hero">
      <div className="dash-card__head dash-card__head--hero">
        <div className="dash-card__label-group">
          <span className="dash-card__icon" aria-hidden>
            ⏱
          </span>
          <div className="dash-card__label-text">
            <h3 className="dash-card__title">{title}</h3>
            <p className="dash-card__meta-line">
              <MetricTypeChip type="calculated" />
              {live && <MetricChip label="Live" tone="positive" />}
            </p>
          </div>
        </div>
      </div>

      <div className="dash-hero__layout">
        <div className="dash-hero__main">
          <div className="dash-hero__value-row">
            <span className="dash-hero__value">{value}</span>
            {trendLabel && (
              <MetricChip label={trendLabel} direction="up" tone="positive" />
            )}
          </div>
          {caption && <p className="dash-card__caption dash-hero__caption">{caption}</p>}

          <div className="dash-hero__stats">
            <div className="dash-hero__stat">
              <span>{actualLabel}</span>
              <strong>{actualValue}</strong>
            </div>
            <div className="dash-hero__stat dash-hero__stat--muted">
              <span>{benchmarkLabel}</span>
              <strong>{benchmarkValue}</strong>
            </div>
          </div>
        </div>

        <div className="dash-hero__compare" aria-hidden>
          <div className="dash-hero__compare-row">
            <span className="dash-hero__compare-label">Actual</span>
            <div className="dash-hero__compare-track">
              <div
                className="dash-hero__compare-fill dash-hero__compare-fill--actual"
                style={{ width: `${actualPct}%` }}
              />
            </div>
          </div>
          <div className="dash-hero__compare-row">
            <span className="dash-hero__compare-label">Benchmark</span>
            <div className="dash-hero__compare-track">
              <div
                className="dash-hero__compare-fill dash-hero__compare-fill--bench"
                style={{ width: `${benchPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
