import type { ReactNode } from "react";
import { MetricChip, MetricTypeChip } from "./MetricChip";
import { Sparkline } from "./Sparkline";

type Trend = {
  value: string;
  direction: "up" | "down" | "flat";
  tone: "positive" | "negative" | "neutral" | "warning";
};

export type KpiCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: Trend;
  metricType?: "measured" | "benchmarked" | "calculated";
  icon?: ReactNode;
  sparkline?: number[];
  accent?: "purple" | "green" | "red" | "amber" | "neutral";
  active?: boolean;
  onClick?: () => void;
  footer?: ReactNode;
  variant?: "primary" | "secondary";
  alert?: boolean;
};

const accentColors: Record<string, string> = {
  purple: "#6554f2",
  green: "#16a34a",
  red: "#dc2626",
  amber: "#d97706",
  neutral: "#98a2b3",
};

export function KpiCard({
  title,
  value,
  subtitle,
  trend,
  metricType,
  icon,
  sparkline,
  accent = "purple",
  active,
  onClick,
  footer,
  variant = "secondary",
  alert,
}: KpiCardProps) {
  const Tag = onClick ? "button" : "article";
  const isPrimary = variant === "primary";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={[
        "dash-card",
        isPrimary ? "dash-card--primary" : "dash-card--secondary",
        active ? "dash-card--active" : "",
        alert ? "dash-card--warn" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
    >
      <div className="dash-card__head">
        <div className="dash-card__label-group">
          {isPrimary && icon && (
            <span className="dash-card__icon" aria-hidden>
              {icon}
            </span>
          )}
          <div className="dash-card__label-text">
            <h3 className="dash-card__title">{title}</h3>
          </div>
        </div>
      </div>

      {(metricType || trend) && (
        <div className="dash-card__meta">
          {metricType ? <MetricTypeChip type={metricType} /> : <span />}
          {trend ? (
            <MetricChip label={trend.value} direction={trend.direction} tone={trend.tone} />
          ) : (
            <span />
          )}
        </div>
      )}

      <div className="dash-card__body">
        <div className="dash-card__metric-wrap">
          <div
            className={
              isPrimary ? "dash-card__metric" : "dash-card__metric dash-card__metric--sm"
            }
          >
            {value}
          </div>
          {subtitle && <p className="dash-card__caption">{subtitle}</p>}
        </div>
        {isPrimary && sparkline && sparkline.length > 0 && (
          <div className="dash-card__spark">
            <Sparkline values={sparkline} width={64} height={28} color={accentColors[accent]} />
          </div>
        )}
      </div>

      {footer && <div className="dash-card__footer">{footer}</div>}
    </Tag>
  );
}
