type Props = {
  title: string;
  subtitle: string;
  monthLabel?: string;
  live?: boolean;
};

export function DashboardHeader({ title, subtitle, monthLabel, live }: Props) {
  return (
    <header className="dashboard-header">
      <div className="dashboard-header__text">
        <h1 className="dashboard-header__title">{title}</h1>
        <p className="dashboard-header__subtitle">{subtitle}</p>
      </div>
      <div className="dashboard-header__meta">
        {monthLabel && <div className="dashboard-month-pill">{monthLabel}</div>}
        {live && <span className="dashboard-status dashboard-status--live">Live session</span>}
      </div>
    </header>
  );
}
