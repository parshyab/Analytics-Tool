import type { PluginState } from "../../types";
import { aggregateByMonth } from "../../productivity/dashboardAggregates";
import { ProductivityInsights } from "./ProductivityInsights";
import { usePluginState } from "../hooks";

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function MonthlyDashboard({ state }: { state: PluginState }) {
  const { liveTick } = usePluginState();
  const months = aggregateByMonth(state.productivityResults);
  const latest = months[months.length - 1];

  return (
    <ProductivityInsights
      state={state}
      liveTick={liveTick}
      embedded
      monthLabel={latest ? formatMonthLabel(latest.month) : undefined}
    />
  );
}
