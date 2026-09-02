import type { ReactNode } from "react";

export type NavTab = {
  id: string;
  label: string;
  icon?: ReactNode;
  show?: boolean;
};

export function HorizontalNav({
  tabs,
  activeId,
  onChange,
}: {
  tabs: NavTab[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  const visible = tabs.filter((t) => t.show !== false);
  if (visible.length <= 1) return null;

  return (
    <nav className="horiz-nav" aria-label="Main navigation">
      {visible.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`horiz-nav__item${activeId === t.id ? " horiz-nav__item--active" : ""}`}
          onClick={() => onChange(t.id)}
        >
          {t.icon ? <span className="horiz-nav__icon">{t.icon}</span> : null}
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
