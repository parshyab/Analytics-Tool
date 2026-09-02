import type { ReactNode } from "react";
import type {
  ProductivityConfidenceLabel,
  ProductivityTrendFilters,
  TrendViewScope,
} from "../../types";
import { WORK_TYPE_OPTIONS } from "../../types";
import { NYKAA_DESIGN_TEAMS, filterDesignerOptionsForTeam, type NykaaDesignTeam } from "../../productivity/nykaaTeams";
import type { ProductivityResult, WorkSession } from "../../types";
import type { extractFilterOptions } from "../../productivity/productivityTrendAggregator";

type FilterOptions = ReturnType<typeof extractFilterOptions>;

const CONFIDENCE_OPTS: ProductivityConfidenceLabel[] = [
  "high", "medium", "low", "directional", "unavailable",
];

const COMPLEXITY_OPTS = ["low", "medium", "high", "very-high"] as const;

const VIEW_SCOPES: { value: TrendViewScope; label: string }[] = [
  { value: "my-data", label: "My data only" },
  { value: "team-summary", label: "Team summary" },
  { value: "full-designer-view", label: "Full designer view" },
];

type Props = {
  filters: ProductivityTrendFilters;
  setFilters: React.Dispatch<React.SetStateAction<ProductivityTrendFilters>>;
  options: FilterOptions;
  sessions: WorkSession[];
  results: ProductivityResult[];
  onReset: () => void;
};

export function TrendFiltersPanel({ filters, setFilters, options, sessions, results, onReset }: Props) {
  const selectedTeam = filters.teamNames[0] as NykaaDesignTeam | undefined;
  const designers = filterDesignerOptionsForTeam(
    options.designers,
    selectedTeam,
    sessions,
    results
  );
  return (
    <div className="dash-filters">
      <div className="dash-filters-head">
        <span className="dash-filters-label">Filter insights</span>
        <button type="button" className="dash-link-btn" onClick={onReset}>
          Clear all
        </button>
      </div>

      <div className="dash-filters-sections">
        <FilterGroup title="People & scope">
          <FilterField label="Designer">
            <select
              className="dash-select"
              value={filters.designerUserIds[0] ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  designerUserIds: e.target.value ? [e.target.value] : [],
                }))
              }
            >
              <option value="">All designers</option>
              {designers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Team">
            <select
              className="dash-select"
              value={filters.teamNames[0] ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, teamNames: e.target.value ? [e.target.value] : [] }))
              }
            >
              <option value="">All teams</option>
              {NYKAA_DESIGN_TEAMS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </FilterField>

          <FilterField label="View">
            <select
              className="dash-select"
              value={filters.viewScope}
              onChange={(e) =>
                setFilters((f) => ({ ...f, viewScope: e.target.value as TrendViewScope }))
              }
            >
              {VIEW_SCOPES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </FilterField>
        </FilterGroup>

        <FilterGroup title="Work context">
          <FilterField label="Project">
            <select
              className="dash-select"
              value={filters.projectNames[0] ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, projectNames: e.target.value ? [e.target.value] : [] }))
              }
            >
              <option value="">All projects</option>
              {options.projects.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </FilterField>

          <FilterField label="Jira ticket">
            <select
              className="dash-select"
              value={filters.jiraTicketIds[0] ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, jiraTicketIds: e.target.value ? [e.target.value] : [] }))
              }
            >
              <option value="">All tickets</option>
              {options.tickets.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </FilterField>

          <FilterField label="Flow">
            <select
              className="dash-select"
              value={filters.flowNames[0] ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, flowNames: e.target.value ? [e.target.value] : [] }))
              }
            >
              <option value="">All flows</option>
              {options.flows.map((fl) => <option key={fl} value={fl}>{fl}</option>)}
            </select>
          </FilterField>

          <FilterField label="Work type">
            <select
              className="dash-select"
              value={filters.workTypes[0] ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, workTypes: e.target.value ? [e.target.value] : [] }))
              }
            >
              <option value="">All types</option>
              {options.workTypes.map((wt) => {
                const label = WORK_TYPE_OPTIONS.find((o) => o.value === wt)?.label ?? wt;
                return <option key={wt} value={wt}>{label}</option>;
              })}
            </select>
          </FilterField>

          <FilterField label="Complexity">
            <select
              className="dash-select"
              value={filters.complexities[0] ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, complexities: e.target.value ? [e.target.value] : [] }))
              }
            >
              <option value="">All</option>
              {COMPLEXITY_OPTS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </FilterField>

          <FilterField label="Confidence">
            <select
              className="dash-select"
              value={filters.confidenceLabels[0] ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  confidenceLabels: e.target.value
                    ? [e.target.value as ProductivityConfidenceLabel]
                    : [],
                }))
              }
            >
              <option value="">All</option>
              {CONFIDENCE_OPTS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </FilterField>
        </FilterGroup>

        <FilterGroup title="Time range">
          <FilterField label="From">
            <input
              type="date"
              className="dash-select"
              value={filters.dateFrom ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            />
          </FilterField>

          <FilterField label="To">
            <input
              type="date"
              className="dash-select"
              value={filters.dateTo ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            />
          </FilterField>

          <FilterField label="Group by">
            <select
              className="dash-select"
              value={filters.groupBy}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  groupBy: e.target.value as ProductivityTrendFilters["groupBy"],
                }))
              }
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </FilterField>
        </FilterGroup>
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="dash-filter-group">
      <span className="dash-filter-group-title">{title}</span>
      <div className="dash-filter-group-fields">{children}</div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="dash-filter-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
