type Props = {
  icon?: string;
  title: string;
  body: string;
  compact?: boolean;
};

export function EmptyState({ icon = "📊", title, body, compact = false }: Props) {
  return (
    <div className={`dashboard-empty ${compact ? "dashboard-empty--compact" : ""}`}>
      <div className="dashboard-empty__icon">{icon}</div>
      <h4 className="dashboard-empty__title">{title}</h4>
      <p className="dashboard-empty__body">{body}</p>
    </div>
  );
}
