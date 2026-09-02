type Props = {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: string;
  variant?: "line" | "bars";
};

export function Sparkline({
  values,
  width = 120,
  height = 48,
  color = "#6c5ce7",
  fill = "rgba(108, 92, 231, 0.12)",
  variant = "line",
}: Props) {
  if (values.length === 0) {
    return (
      <svg width={width} height={height} className="sparkline sparkline-empty" aria-hidden>
        <rect x="0" y={height * 0.6} width={width} height={4} rx="2" fill="#e5e7eb" />
      </svg>
    );
  }

  const pad = 4;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;

  const coords = values.map((v, i) => ({
    x: pad + (values.length <= 1 ? innerW / 2 : (i / (values.length - 1)) * innerW),
    y: pad + innerH - ((v - min) / range) * innerH,
    v,
  }));

  if (variant === "bars") {
    const barW = Math.max(4, innerW / values.length - 3);
    return (
      <svg width={width} height={height} className="sparkline sparkline-bars" aria-hidden>
        {values.map((v, i) => {
          const barH = Math.max(4, ((v - min) / range) * innerH);
          const x = pad + i * (innerW / values.length) + 1;
          const y = pad + innerH - barH;
          const opacity = 0.45 + (i / values.length) * 0.55;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={3}
              fill={i === values.length - 1 ? color : color}
              opacity={opacity}
            />
          );
        })}
      </svg>
    );
  }

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${pad + innerH} L ${coords[0].x} ${pad + innerH} Z`;

  return (
    <svg width={width} height={height} className="sparkline" aria-hidden>
      <path d={areaPath} fill={fill} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r={3} fill={color} />
    </svg>
  );
}

export function sparkTrend(values: number[]): { delta: number; positive: boolean } | null {
  if (values.length < 2) return null;
  const mid = Math.floor(values.length / 2);
  const first = values.slice(0, mid);
  const second = values.slice(mid);
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const a = avg(first);
  const b = avg(second);
  if (a === 0) return b > 0 ? { delta: 100, positive: true } : null;
  const delta = ((b - a) / Math.abs(a)) * 100;
  return { delta: Math.abs(delta), positive: delta >= 0 };
}
