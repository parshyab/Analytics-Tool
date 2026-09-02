import type { ReactNode } from "react";

type PageLayoutProps = {
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  narrow?: boolean;
  compact?: boolean;
};

export function PageLayout({
  title,
  subtitle,
  eyebrow,
  actions,
  children,
  className = "",
  narrow = false,
  compact = false,
}: PageLayoutProps) {
  return (
    <div
      className={`page ${narrow ? "page-narrow" : ""} ${compact ? "page-compact" : ""} ${className}`.trim()}
    >
      {(title || subtitle || eyebrow || actions) && (
        <header className="page-header">
          <div className="page-header-text">
            {eyebrow && <span className="page-eyebrow">{eyebrow}</span>}
            {title && <h2 className="page-title">{title}</h2>}
            {subtitle && <p className="page-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="page-actions">{actions}</div>}
        </header>
      )}
      <div className="page-body">{children}</div>
    </div>
  );
}

export function PageSection({
  title,
  subtitle,
  children,
  className = "",
  flush = false,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={`page-section card ${flush ? "card-flush" : ""} ${className}`.trim()}>
      {(title || subtitle) && (
        <div className="section-header">
          {title && <h3 className="section-title">{title}</h3>}
          {subtitle && <p className="section-subtitle">{subtitle}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyPanel({ icon, title, body }: { icon?: string; title: string; body: string }) {
  return (
    <div className="empty-panel">
      {icon && <div className="empty-panel-icon">{icon}</div>}
      <h4>{title}</h4>
      <p>{body}</p>
    </div>
  );
}
