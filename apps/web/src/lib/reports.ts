const REPORTING_URL =
  process.env.NEXT_PUBLIC_REPORTING_URL ?? "http://localhost:8002";

async function reportingGet<T>(path: string): Promise<T> {
  const res = await fetch(`${REPORTING_URL}${path}`);
  if (!res.ok) {
    throw new Error(`Reporting API error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// -- Types -------------------------------------------------------------------

export interface BurnRateEntry {
  week: string;
  total_hours: number;
  total_cost: number;
  entry_count: number;
  billable_hours: number;
  non_billable_hours: number;
}

export interface ProductivityEntry {
  category: string;
  hours: number;
  percentage: number;
  entry_count: number;
  avg_quality_score: number | null;
}

export interface ReportSummary {
  total_entries: number;
  total_hours: number;
  total_cost: number;
  total_paid: number;
  avg_quality_score: number;
}

// -- API calls ---------------------------------------------------------------

export async function getBurnRate(params?: {
  project_id?: string;
}): Promise<BurnRateEntry[]> {
  const qs = params?.project_id
    ? `?project_id=${params.project_id}`
    : "";
  return reportingGet<BurnRateEntry[]>(`/api/reports/burn-rate${qs}`);
}

export async function getProductivity(params?: {
  project_id?: string;
}): Promise<ProductivityEntry[]> {
  const qs = params?.project_id
    ? `?project_id=${params.project_id}`
    : "";
  return reportingGet<ProductivityEntry[]>(`/api/reports/productivity${qs}`);
}

export async function getReportSummary(): Promise<ReportSummary> {
  return reportingGet<ReportSummary>("/api/reports/summary");
}

export function getExportUrl(): string {
  return `${REPORTING_URL}/api/reports/export`;
}
