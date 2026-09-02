import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function ChartCard({ title, subtitle, actions, children }: Props) {
  return (
    <section className="dash-card dash-card--chart">
      <div className="dash-card__head">
        <div>
          <h3 className="dash-card__title">{title}</h3>
          {subtitle && <p className="dash-card__caption">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
