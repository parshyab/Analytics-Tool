type Props = {
  title: string;
  insights: string[];
  confidence?: string;
};

export function InsightCard({ title, insights, confidence }: Props) {
  return (
    <section className="dash-card dash-card--insight">
      <div className="dash-card__head">
        <div className="dash-card__label-text">
          <h3 className="dash-card__title">{title}</h3>
          {confidence && (
            <p className="dash-card__caption">Confidence: {confidence}</p>
          )}
        </div>
      </div>
      <ul className="dashboard-insight-list">
        {insights.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
