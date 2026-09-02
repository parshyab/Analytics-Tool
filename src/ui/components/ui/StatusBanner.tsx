import type { ReactNode } from "react";

type Variant = "error" | "success" | "warning" | "info" | "reimport";

export function StatusBanner({
  variant,
  children,
  onDismiss,
}: {
  variant: Variant;
  children: ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div className={`status-banner status-banner--${variant}`} role={variant === "error" ? "alert" : "status"}>
      <div className="status-banner__body">{children}</div>
      {onDismiss ? (
        <button type="button" className="btn btn-ghost btn-sm status-banner__dismiss" onClick={onDismiss}>
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
