// In dev: NEXT_PUBLIC_REPORTING_URL=http://localhost:8002 → calls http://localhost:8002/api/reports/burn-rate
// In prod: NEXT_PUBLIC_REPORTING_URL=                     → calls /api/reports/burn-rate (Nginx proxies directly)
const REPORTING_URL =
  process.env.NEXT_PUBLIC_REPORTING_URL ?? "http://localhost:8002";

async function reportingGet<T>(path: string): Promise<T> {
  const url = REPORTING_URL ? `${REPORTING_URL}${path}` : path;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Reporting service unreachable");
  }
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
  const base = REPORTING_URL || "";
  return `${base}/api/reports/export`;
}

// -- Team Report --------------------------------------------------------------

export interface TeamUserEntry {
  user_id: string;
  user_name: string;
  total_hours: number;
  billable_hours: number;
  non_billable_hours: number;
  total_cost: number;
  entry_count: number;
}

export interface TeamReport {
  users: TeamUserEntry[];
  total_hours: number;
  total_cost: number;
}

export async function getTeamReport(tenantId?: string): Promise<TeamReport> {
  const qs = tenantId ? `?tenant_id=${tenantId}` : "";
  return reportingGet<TeamReport>(`/api/reports/team${qs}`);
}

// -- Individual Report --------------------------------------------------------

export interface IndividualReport {
  user_id: string;
  total_hours: number;
  billable_hours: number;
  non_billable_hours: number;
  total_cost: number;
  entries_by_week: BurnRateEntry[];
}

export async function getIndividualReport(userId: string): Promise<IndividualReport> {
  return reportingGet<IndividualReport>(`/api/reports/individual?user_id=${userId}`);
}

// -- Wellness Report ----------------------------------------------------------

export type WellnessRiskLevel = "healthy" | "watch" | "at_risk" | "critical";

export interface WellnessUserEntry {
  user_id: string;
  user_name: string;
  avg_daily_hours: number;
  overtime_hours: number;
  risk_level: WellnessRiskLevel;
  consecutive_overtime_days: number;
  recommendation: string;
}

export interface WellnessReport {
  users: WellnessUserEntry[];
  overall_risk: WellnessRiskLevel;
}

export async function getWellnessReport(tenantId?: string): Promise<WellnessReport> {
  const qs = tenantId ? `?tenant_id=${tenantId}` : "";
  return reportingGet<WellnessReport>(`/api/reports/wellness${qs}`);
}

// -- Digest Report ------------------------------------------------------------

export interface DigestReport {
  tenant_id: string;
  period: string;
  narrative: string;
  highlights: string[];
  generated_at: string;
}

export async function getDigest(tenantId?: string): Promise<DigestReport> {
  const qs = tenantId ? `?tenant_id=${tenantId}` : "";
  return reportingGet<DigestReport>(`/api/reports/digest${qs}`);
}

// -- PDF Export ----------------------------------------------------------------

export function getPdfExportUrl(tenantId?: string): string {
  const base = REPORTING_URL || "";
  const qs = tenantId ? `?tenant_id=${tenantId}` : "";
  return `${base}/api/reports/export/pdf${qs}`;
}
