import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  embedded?: boolean;
};

export function DashboardShell({ children, embedded = false }: Props) {
  return (
    <div className={`dash ${embedded ? "dash--embedded" : ""}`}>{children}</div>
  );
}
