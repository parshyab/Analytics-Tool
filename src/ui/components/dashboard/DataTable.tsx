import type { ReactNode } from "react";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  width?: string;
};

function cellAlignClass(align?: DataTableColumn<unknown>["align"]): string {
  if (align === "right") return "dashboard-table__cell--numeric";
  if (align === "center") return "dashboard-table__cell--center";
  return "dashboard-table__cell--text";
}

type Props<T> = {
  title: string;
  subtitle?: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  emptyTitle?: string;
  emptyBody?: string;
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
  selectedKey?: string | null;
};

export function DataTable<T>({
  title,
  subtitle,
  columns,
  rows,
  emptyTitle = "No data yet",
  emptyBody = "Finish more sessions to populate this view.",
  onRowClick,
  rowKey,
  selectedKey,
}: Props<T>) {
  return (
    <section className="dash-card dash-card--table">
      <div className="dash-card__head">
        <div className="dash-card__label-text">
          <h3 className="dash-card__title">{title}</h3>
          {subtitle && <p className="dash-card__caption">{subtitle}</p>}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="dashboard-empty dashboard-empty--compact">
          <p className="dashboard-empty__title">{emptyTitle}</p>
          <p className="dashboard-empty__body">{emptyBody}</p>
        </div>
      ) : (
        <div className="dashboard-table-wrap">
          <table className="dashboard-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cellAlignClass(col.align)}
                    style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const key = rowKey(row);
                return (
                  <tr
                    key={key}
                    className={`${onRowClick ? "row-clickable" : ""} ${selectedKey === key ? "row-selected" : ""}`}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={cellAlignClass(col.align)}>
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
