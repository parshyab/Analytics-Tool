import { useEffect, useMemo, useState } from "react";
import type {
  DesignerAggregate,
  PluginState,
  ProductivityConfidenceLabel,
  ProductivityResult,
  ProductivityTrendFilters,
  TeamAggregate,
  TrendMetric,
} from "../../types";
import { PRIMARY_TREND_CHARTS } from "../../types";
import {
  aggregateByDesigner,
  aggregateByTeam,
} from "../../productivity/dashboardAggregates";
import {
  buildTrendCardSummary,
  buildTrendSeries,
  extractFilterOptions,
  getDefaultTrendFilters,
} from "../../productivity/productivityTrendAggregator";
import {
  NYKAA_DESIGN_TEAMS,
  filterDesignerOptionsForTeam,
  resolvePluginTeamName,
} from "../../productivity/nykaaTeams";
import { LineChart } from "../charts/LineChart";
import { TrendChartPanel } from "../charts/TrendChartPanel";
import { EnablementMetricsGlossary } from "./EnablementMetricsGlossary";
import { TrendFiltersPanel } from "./TrendFiltersPanel";
import { postMessage } from "../hooks";
import { ChartCard } from "./dashboard/ChartCard";
import { ControlBar } from "./dashboard/ControlBar";
import { DashboardHeader } from "./dashboard/DashboardHeader";
import { DashboardShell } from "./dashboard/DashboardShell";
import { DataTable } from "./dashboard/DataTable";
import { EmptyState } from "./dashboard/EmptyState";
import { HeroMetricCard } from "./dashboard/HeroMetricCard";
import { InsightCard } from "./dashboard/InsightCard";
import { KpiCard } from "./dashboard/KpiCard";
import { MetricChip } from "./dashboard/MetricChip";
import { ProgressBar } from "./dashboard/ProgressBar";
import {
  aggregateQualityIssues,
  aggregateTopComponents,
  calcLiftPercent,
  chartEmptyMessage,
  getBenchmarkCoverage,
  getDashboardConfidence,
  getDataQualityWarnings,
  getExecutiveInsights,
  seriesValues,
  trendFromValues,
} from "./dashboard/dashboardUtils";

type Props = {
  state: PluginState;
  liveTick?: number;
  embedded?: boolean;
  monthLabel?: string;
};

const CHART_METRICS: TrendMetric[] = [
  "observedHoursSaved",
  ...PRIMARY_TREND_CHARTS.map((c) => c.metric),
];

const SECONDARY_CHARTS: { metric: TrendMetric; title: string }[] = [
  { metric: "lumiAdoptionRate", title: "LUMI adoption trend" },
  { metric: "qualityScore", title: "Quality score trend" },
  { metric: "componentReuse", title: "Component reuse trend" },
];

export function ProductivityInsights({
  state,
  liveTick = 0,
  embedded = true,
  monthLabel,
}: Props) {
  const [filters, setFilters] = useState<ProductivityTrendFilters>(() => {
    const defaults = getDefaultTrendFilters();
    const team = resolvePluginTeamName(state);
    if (team) defaults.teamNames = [team];
    return defaults;
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [chartMetric, setChartMetric] = useState<TrendMetric>("observedHoursSaved");
  const [selectedDesignerId, setSelectedDesignerId] = useState<string | null>(null);

  const options = useMemo(
    () => extractFilterOptions(state.productivityResults, state.sessions),
    [state.productivityResults, state.sessions]
  );

  const trendOpts = useMemo(
    () => ({
      consent: state.consent,
      currentUserId: state.currentUser?.id ?? state.profile?.userId,
      teamName: state.settings.teamName ?? state.profile?.teamName,
    }),
    [state.consent, state.currentUser, state.profile, state.settings.teamName]
  );

  const series = useMemo(() => {
    void liveTick;
    return buildTrendSeries(state.productivityResults, state.sessions, filters, trendOpts);
  }, [state.productivityResults, state.sessions, filters, trendOpts, liveTick]);

  const cards = useMemo(
    () => buildTrendCardSummary(state.productivityResults, state.sessions, filters, trendOpts),
    [state.productivityResults, state.sessions, filters, trendOpts, liveTick]
  );

  const filteredResults = useMemo(
    () => state.productivityResults.filter((r) => matchResultFilters(r, filters)),
    [state.productivityResults, filters]
  );

  const designerRows = useMemo(
    () => aggregateByDesigner(filteredResults),
    [filteredResults]
  );

  const teamRows = useMemo(
    () => aggregateByTeam(filteredResults),
    [filteredResults]
  );

  const topComponents = useMemo(
    () => aggregateTopComponents(state.scans),
    [state.scans]
  );

  const qualityIssues = useMemo(
    () => aggregateQualityIssues(state.scans),
    [state.scans]
  );

  const lift = calcLiftPercent(cards);
  const coverage = getBenchmarkCoverage(filteredResults);
  const confidence = getDashboardConfidence(cards, filteredResults);
  const warnings = getDataQualityWarnings(cards);
  const insights = getExecutiveInsights(cards, filteredResults);
  const mainChartEmpty = chartEmptyMessage(series);

  const displayMonth =
    monthLabel ??
    (filters.month
      ? formatMonth(filters.month)
      : new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" }));

  const userTeam = resolvePluginTeamName(state);

  const resetFilters = () => {
    const defaults = getDefaultTrendFilters();
    if (userTeam) defaults.teamNames = [userTeam];
    setFilters(defaults);
  };

  useEffect(() => {
    if (state.consent?.mode === "anonymous" && filters.viewScope === "full-designer-view") {
      setFilters((f) => ({ ...f, viewScope: "my-data" }));
    }
  }, [state.consent?.mode, filters.viewScope]);

  const activeFilterCount = countActiveFilters(filters);

  return (
    <DashboardShell embedded={embedded}>
      <DashboardHeader
        title="Productivity insights"
        subtitle="Track hours saved, adoption, and quality — for coaching and planning, not performance ranking."
        monthLabel={displayMonth}
        live={cards.hasLiveSession}
      />

      <ControlBar
        filterCount={activeFilterCount}
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen(!filtersOpen)}
        glossaryOpen={glossaryOpen}
        onToggleGlossary={() => setGlossaryOpen(!glossaryOpen)}
        designers={filterDesignerOptionsForTeam(
          options.designers,
          (filters.teamNames[0] as typeof userTeam) ?? userTeam,
          state.sessions,
          state.productivityResults
        ).map((d) => ({ value: d.id, label: d.name }))}
        designerValue={filters.designerUserIds[0] ?? ""}
        onDesignerChange={(value) =>
          setFilters((f) => ({ ...f, designerUserIds: value ? [value] : [] }))
        }
        teams={NYKAA_DESIGN_TEAMS.map((t) => ({ value: t, label: t }))}
        teamValue={filters.teamNames[0] ?? ""}
        onTeamChange={(value) =>
          setFilters((f) => ({
            ...f,
            teamNames: value ? [value] : [],
            designerUserIds: [],
          }))
        }
        metric={chartMetric}
        onMetricChange={setChartMetric}
        metrics={CHART_METRICS}
        onReset={resetFilters}
        onRefresh={() => postMessage({ type: "INIT" })}
        onExport={() =>
          postMessage({ type: "GET_TREND_EXPORT", filters: { ...filters, metric: chartMetric } })
        }
      />

      {glossaryOpen && <EnablementMetricsGlossary />}

      {filtersOpen && (
        <section className="dash-card dashboard-filters-panel">
          <TrendFiltersPanel
            filters={filters}
            setFilters={setFilters}
            options={options}
            sessions={state.sessions}
            results={state.productivityResults}
            onReset={resetFilters}
          />
        </section>
      )}

      {warnings.length > 0 && (
        <div className="dashboard-warning-banner">
          <strong>Data quality check</strong>
          <div>{warnings[0]}</div>
        </div>
      )}

      <section className="dash-section">
        <div className="dash-section__head">
          <h2 className="dash-section__title">Value created this period</h2>
        </div>

        <div className="dash-kpi-row">
          <HeroMetricCard
            title="Observed hours saved"
            value={cards.hasBenchmark ? `${cards.observedHoursSaved.toFixed(1)}h` : "—"}
            trendLabel={cards.hasBenchmark ? `${lift.toFixed(0)}% lift` : undefined}
            actualLabel="Actual time"
            actualValue={`${cards.actualHours.toFixed(1)}h`}
            benchmarkLabel="Benchmark"
            benchmarkValue={cards.hasBenchmark ? `${cards.benchmarkHours.toFixed(1)}h` : "N/A"}
            caption="Calculated from actual session time vs benchmark."
            actualHours={cards.actualHours}
            benchmarkHours={cards.benchmarkHours}
            live={cards.hasLiveSession}
          />

          <KpiCard
            title="LUMI adoption"
            value={`${cards.averageLumiAdoption.toFixed(0)}%`}
            metricType="measured"
            icon="◆"
            variant="primary"
            trend={trendFromValues(seriesValues(series, "lumiAdoptionRate"))}
            active={chartMetric === "lumiAdoptionRate"}
            onClick={() => setChartMetric("lumiAdoptionRate")}
            footer={
              <ProgressBar
                segments={[
                  { label: "LUMI", value: cards.averageLumiAdoption, color: "#6554f2" },
                  { label: "Custom", value: Math.max(0, 100 - cards.averageLumiAdoption), color: "#e5e7eb" },
                ]}
              />
            }
          />

          <KpiCard
            title="Productivity lift"
            value={cards.hasBenchmark ? `${lift.toFixed(0)}%` : "N/A"}
            subtitle="vs benchmark"
            metricType="calculated"
            icon="↗"
            variant="primary"
            trend={trendFromValues(seriesValues(series, "productivityLiftPercent"))}
            active={chartMetric === "productivityLiftPercent"}
            onClick={() => setChartMetric("productivityLiftPercent")}
          />

          <KpiCard
            title="Quality score"
            value={cards.qualityScore > 0 ? cards.qualityScore.toFixed(0) : "—"}
            subtitle={
              cards.qualityScore > 0 && cards.qualityScore < 40
                ? "Needs cleanup"
                : "Design output health"
            }
            metricType="measured"
            icon="✦"
            variant="primary"
            alert={cards.qualityScore > 0 && cards.qualityScore < 40}
            trend={trendFromValues(seriesValues(series, "qualityScore"))}
            active={chartMetric === "qualityScore"}
            onClick={() => setChartMetric("qualityScore")}
          />
        </div>
      </section>

      <section className="dash-section">
        <div className="dash-section__head">
          <h2 className="dash-section__title">Supporting metrics</h2>
        </div>
        <div className="dash-kpi-secondary">
          <KpiCard
            title="Sessions tracked"
            value={cards.sessions}
            subtitle={`${cards.actualHours.toFixed(1)}h actual work`}
            variant="secondary"
          />
          <KpiCard
            title="Components / hr"
            value={cards.averageComponentsPerHour.toFixed(1)}
            subtitle="Reuse per work hour"
            variant="secondary"
            trend={trendFromValues(seriesValues(series, "componentsReusedPerHour"))}
          />
          <KpiCard
            title="Component reuse"
            value={String(cards.componentReuse)}
            subtitle="Total LUMI instances"
            variant="secondary"
          />
          <KpiCard
            title="Token adoption"
            value={`${cards.averageTokenAdoption.toFixed(0)}%`}
            variant="secondary"
            footer={
              <ProgressBar
                segments={[
                  { label: "Tokens", value: cards.averageTokenAdoption, color: "#16a34a" },
                  { label: "Custom", value: Math.max(0, 100 - cards.averageTokenAdoption), color: "#e5e7eb" },
                ]}
              />
            }
          />
          <KpiCard
            title="LUMI leverage"
            value={cards.averageLeverageScore.toFixed(0)}
            subtitle="Composite DS score"
            variant="secondary"
          />
          <KpiCard
            title="Benchmark coverage"
            value={`${coverage.percent.toFixed(0)}%`}
            subtitle={`${coverage.withBenchmark} of ${coverage.total || cards.sessions} sessions`}
            variant="secondary"
          />
        </div>
      </section>

      <InsightCard
        title="What to focus on next"
        insights={insights}
        confidence={
          confidence === "needs-review"
            ? "Needs review"
            : confidence === "directional"
              ? "Directional — early data"
              : confidence.charAt(0).toUpperCase() + confidence.slice(1)
        }
      />

      <section className="dash-section">
        <div className="dash-section__head">
          <h2 className="dash-section__title">Trends over time</h2>
        </div>

        <div className="dash-chart-grid">
          <ChartCard
            title="Designer productivity trend"
            subtitle="Hours saved, productivity lift, and adoption over time."
            actions={
              <div className="dashboard-select-wrap">
                <label htmlFor="dash-group">Group by</label>
                <select
                  id="dash-group"
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
              </div>
            }
          >
            {!cards.hasBenchmark &&
              (chartMetric === "observedHoursSaved" || chartMetric === "productivityLiftPercent") && (
                <div className="dashboard-warning-banner" style={{ marginBottom: 16 }}>
                  Actual work time is available, but hours saved and lift need a benchmark.
                </div>
              )}

            {mainChartEmpty ? (
              <EmptyState title="Not enough trend data" body={mainChartEmpty} />
            ) : (
              <TrendChartPanel
                series={series}
                activeMetric={chartMetric}
                onMetricChange={setChartMetric}
                showComparison
              />
            )}
          </ChartCard>

          <div className="dash-chart-row">
            {SECONDARY_CHARTS.map(({ metric, title }) => {
              const empty = chartEmptyMessage(series, 1);
              const values = seriesValues(series, metric);
              return (
                <ChartCard key={metric} title={title}>
                  {empty || values.length === 0 ? (
                    <EmptyState
                      compact
                      title="No trend yet"
                      body={empty ?? "Finish more sessions to see this trend."}
                    />
                  ) : (
                    <LineChart series={series} metric={metric} height={200} showLegend={false} />
                  )}
                </ChartCard>
              );
            })}
          </div>
        </div>
      </section>

      <section className="dash-section dash-section--stack dash-section--breakdown">
        <div className="dash-section__head">
          <div>
            <h2 className="dash-section__title">Breakdown &amp; details</h2>
            <p className="dash-section__desc">
              Designer and team summaries from finished work sessions in this period.
            </p>
          </div>
        </div>

        <div className="dash-table-stack">
          <DataTable<DesignerAggregate>
            title="Designer enablement insights"
            subtitle="Individual LUMI adoption and productivity — for coaching, not ranking"
            rows={designerRows}
            rowKey={(r) => r.designerUserId}
            selectedKey={selectedDesignerId}
            onRowClick={(r) =>
              setSelectedDesignerId(selectedDesignerId === r.designerUserId ? null : r.designerUserId)
            }
            columns={[
              {
                key: "name",
                header: "Designer",
                width: "140px",
                render: (r) => <span className="cell-strong cell-name">{r.designerName}</span>,
              },
              { key: "sessions", header: "Sessions", align: "right", width: "88px", render: (r) => r.sessions },
              {
                key: "actual",
                header: "Actual hours",
                align: "right",
                width: "104px",
                render: (r) => `${r.actualHours.toFixed(1)}h`,
              },
              {
                key: "bench",
                header: "Benchmark hours",
                align: "right",
                width: "120px",
                render: (r) => (r.benchmarkHours > 0 ? `${r.benchmarkHours.toFixed(1)}h` : "—"),
              },
              {
                key: "saved",
                header: "Hours saved",
                align: "right",
                width: "104px",
                render: (r) => (r.observedHoursSaved > 0 ? `${r.observedHoursSaved.toFixed(1)}h` : "N/A"),
              },
              {
                key: "lumi",
                header: "LUMI adoption",
                align: "right",
                width: "112px",
                render: (r) => `${r.lumiAdoptionRate.toFixed(0)}%`,
              },
              {
                key: "quality",
                header: "Quality",
                align: "right",
                width: "80px",
                render: (r) => r.qualityScore.toFixed(0),
              },
              {
                key: "conf",
                header: "Confidence",
                align: "center",
                width: "108px",
                render: (r) => <ConfidenceBadge label={r.confidence} />,
              },
            ]}
            emptyTitle="No designer data"
            emptyBody="Finish a work session to see enablement insights."
          />

          <DataTable<TeamAggregate>
            title="Team productivity summary"
            subtitle="Beauty, Man, and Fashion — aggregated adoption and hours saved by team"
            rows={teamRows}
            rowKey={(r) => r.teamName}
            columns={[
              {
                key: "team",
                header: "Team",
                width: "120px",
                render: (r) => <span className="cell-strong cell-name">{r.teamName}</span>,
              },
              {
                key: "designers",
                header: "Designers",
                align: "right",
                width: "96px",
                render: (r) => r.designers,
              },
              { key: "sessions", header: "Sessions", align: "right", width: "88px", render: (r) => r.sessions },
              {
                key: "saved",
                header: "Hours saved",
                align: "right",
                width: "104px",
                render: (r) => `${r.observedHoursSaved.toFixed(1)}h`,
              },
              {
                key: "lumi",
                header: "LUMI adoption",
                align: "right",
                width: "112px",
                render: (r) => `${r.lumiAdoptionRate.toFixed(0)}%`,
              },
              {
                key: "quality",
                header: "Quality",
                align: "right",
                width: "80px",
                render: (r) => r.qualityScore.toFixed(0),
              },
              {
                key: "lift",
                header: "Lift",
                align: "right",
                width: "72px",
                render: (r) => `${r.productivityLiftPercent.toFixed(0)}%`,
              },
            ]}
            emptyTitle="No team data"
            emptyBody="Assign Beauty, Man, or Fashion on consent to see team summaries."
          />

          <DataTable<{ name: string; instances: number }>
            title="Top components driving reuse"
            subtitle="Most-used LUMI components from session scans"
            rows={topComponents}
            rowKey={(r) => r.name}
            columns={[
              {
                key: "name",
                header: "Component",
                render: (r) => <span className="cell-strong cell-name">{r.name}</span>,
              },
              {
                key: "instances",
                header: "Instances",
                align: "right",
                width: "100px",
                render: (r) => r.instances,
              },
            ]}
            emptyTitle="No component data"
            emptyBody="Finish a session with LUMI scan enabled."
          />

          <DataTable<{ type: string; count: number; severity: string; message: string }>
            title="Quality opportunities"
            subtitle="Issues detected in LUMI scans — recommendations for cleanup"
            rows={qualityIssues}
            rowKey={(r) => r.type}
            columns={[
              {
                key: "type",
                header: "Issue",
                width: "140px",
                render: (r) => <span className="cell-strong cell-name">{r.type}</span>,
              },
              { key: "count", header: "Count", align: "right", width: "72px", render: (r) => r.count },
              { key: "severity", header: "Impact", width: "88px", render: (r) => r.severity },
              { key: "message", header: "Recommendation", render: (r) => r.message },
            ]}
            emptyTitle="No quality issues"
            emptyBody="Scans did not detect cleanup opportunities."
          />
        </div>
      </section>
    </DashboardShell>
  );
}

function ConfidenceBadge({ label }: { label: ProductivityConfidenceLabel }) {
  const tone =
    label === "high"
      ? "positive"
      : label === "low" || label === "unavailable"
        ? "warning"
        : "neutral";
  return <MetricChip label={label} tone={tone} />;
}

function matchResultFilters(r: ProductivityResult, filters: ProductivityTrendFilters): boolean {
  if (filters.designerUserIds.length && !filters.designerUserIds.includes(r.designerUserId)) return false;
  if (filters.teamNames.length && !filters.teamNames.includes(r.teamName ?? "Unassigned")) return false;
  if (filters.dateFrom && r.createdAt.slice(0, 10) < filters.dateFrom) return false;
  if (filters.dateTo && r.createdAt.slice(0, 10) > filters.dateTo) return false;
  if (filters.projectNames.length && !filters.projectNames.includes(r.projectName ?? "")) return false;
  if (filters.jiraTicketIds.length && !filters.jiraTicketIds.includes(r.jiraTicketId ?? "")) return false;
  if (filters.flowNames.length && !filters.flowNames.includes(r.flowName ?? "")) return false;
  if (filters.workTypes.length && !filters.workTypes.includes(r.workType ?? "")) return false;
  if (filters.complexities.length && !filters.complexities.includes(r.complexity ?? "")) return false;
  if (filters.confidenceLabels.length && !filters.confidenceLabels.includes(r.confidence.label)) return false;
  return true;
}

function countActiveFilters(filters: ProductivityTrendFilters): number {
  let n = 0;
  if (filters.designerUserIds.length) n++;
  if (filters.teamNames.length) n++;
  if (filters.projectNames.length) n++;
  if (filters.flowNames.length) n++;
  if (filters.jiraTicketIds.length) n++;
  if (filters.workTypes.length) n++;
  if (filters.complexities.length) n++;
  if (filters.confidenceLabels.length) n++;
  if (filters.dateFrom) n++;
  if (filters.dateTo) n++;
  return n;
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}
