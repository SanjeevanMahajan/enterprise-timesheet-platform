// In dev: NEXT_PUBLIC_AI_URL=http://localhost:8005 → calls http://localhost:8005/api/ai/...
// In prod: NEXT_PUBLIC_AI_URL=                    → calls /api/ai/... (Nginx proxies)
const AI_URL = process.env.NEXT_PUBLIC_AI_URL ?? "http://localhost:8005";

async function aiGet<T>(path: string): Promise<T> {
  const url = AI_URL ? `${AI_URL}${path}` : path;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("AI service unreachable");
  }
  if (!res.ok) throw new Error(`AI API error: ${res.status}`);
  return res.json() as Promise<T>;
}

async function aiPost<T>(path: string, body: unknown): Promise<T> {
  const url = AI_URL ? `${AI_URL}${path}` : path;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("AI service unreachable");
  }
  if (!res.ok) throw new Error(`AI API error: ${res.status}`);
  return res.json() as Promise<T>;
}

// -- Types -------------------------------------------------------------------

export interface Anomaly {
  time_log_id: string;
  user_id: string;
  anomaly_type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  log_date: string;
  hours: number;
}

export interface Suggestion {
  project_id: string;
  hours: number;
  description: string;
  confidence: number;
}

export interface ParsedTimeEntry {
  hours: number | null;
  project_name: string | null;
  description: string | null;
  date: string | null;
  raw_text: string;
}

export interface WeeklyInsight {
  tenant_id: string;
  period: string;
  narrative: string;
  stats: {
    total_hours: number;
    total_entries: number;
    billable_ratio: number;
    top_project: string;
    busiest_user: string;
    trend_vs_last_week: number;
  };
}

// -- API calls ---------------------------------------------------------------

export async function getAnomalies(tenantId: string): Promise<Anomaly[]> {
  return aiGet<Anomaly[]>(`/api/ai/anomalies?tenant_id=${tenantId}`);
}

export async function getSuggestions(userId: string): Promise<Suggestion[]> {
  return aiGet<Suggestion[]>(`/api/ai/suggestions?user_id=${userId}`);
}

export async function parseTimeEntry(text: string): Promise<ParsedTimeEntry> {
  return aiPost<ParsedTimeEntry>("/api/ai/parse", { text });
}

export async function getWeeklyInsights(
  tenantId: string
): Promise<WeeklyInsight> {
  return aiGet<WeeklyInsight>(`/api/ai/insights/weekly?tenant_id=${tenantId}`);
}
