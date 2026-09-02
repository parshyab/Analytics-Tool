type Props = {
  label: string;
  direction?: "up" | "down" | "flat";
  tone?: "positive" | "negative" | "neutral" | "warning";
};

export function MetricChip({ label, direction, tone = "neutral" }: Props) {
  const prefix =
    direction === "up" ? "↑ " : direction === "down" ? "↓ " : direction === "flat" ? "→ " : "";
  return (
    <span className={`dashboard-metric-chip dashboard-metric-chip--${tone}`}>
      {prefix}
      {label}
    </span>
  );
}

type TypeChipProps = {
  type: "measured" | "benchmarked" | "calculated";
};

export function MetricTypeChip({ type }: TypeChipProps) {
  const labels = {
    measured: "Measured",
    benchmarked: "Benchmarked",
    calculated: "Calculated",
  };
  return <span className={`dashboard-type-chip dashboard-type-chip--${type}`}>{labels[type]}</span>;
}
