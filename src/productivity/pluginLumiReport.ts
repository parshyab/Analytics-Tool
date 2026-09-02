import {
  buildLumiReport,
  type LumiReportBundle,
  type ReportPeriod,
} from "../backend/services/lumiReportService";
import type { LumiScanSnapshot, ProductivityResult } from "../types";
import { extractScanPayloads } from "./dsBenchmarkLocal";

export function buildPluginLumiReport(
  period: ReportPeriod,
  results: ProductivityResult[],
  scans: LumiScanSnapshot[]
): LumiReportBundle {
  return buildLumiReport({
    period,
    results,
    scanPayloads: extractScanPayloads(scans),
  });
}
