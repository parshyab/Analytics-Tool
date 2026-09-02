type Segment = { label: string; value: number; color: string };

type Props = {
  segments: Segment[];
};

export function ProgressBar({ segments }: Props) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  return (
    <div className="dashboard-progress">
      <div className="dashboard-progress__track">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className="dashboard-progress__fill"
            style={{ width: `${(seg.value / total) * 100}%`, background: seg.color }}
          />
        ))}
      </div>
      <div className="dashboard-progress__legend">
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
