import { ENABLEMENT_METRICS, ENABLEMENT_DISCLAIMER } from "../../types";

export function EnablementMetricsGlossary() {
  return (
    <section className="dash-card dash-card--insight enablement-glossary">
      <div className="trend-section-header">
        <div>
          <h3>What these metrics mean</h3>
          <p className="trend-section-desc">
            LUMI enablement insights for design system improvement — not performance ranking.
          </p>
        </div>
      </div>
      <div className="glossary-grid">
        {ENABLEMENT_METRICS.map((m) => (
          <div key={m.key} className="glossary-item">
            <div className="glossary-item-head">
              <span className="glossary-label">{m.label}</span>
              <span className={`badge badge-${m.source}`}>{m.source}</span>
            </div>
            <p className="glossary-meaning">{m.meaning}</p>
          </div>
        ))}
      </div>
      <p className="enablement-footnote">{ENABLEMENT_DISCLAIMER}</p>
    </section>
  );
}
