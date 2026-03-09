"use client";

import { useEffect, useState } from "react";
import {
  getBurnRate,
  getProductivity,
  getReportSummary,
  getExportUrl,
  getTeamReport,
  getWellnessReport,
  getDigest,
  getPdfExportUrl,
  type BurnRateEntry,
  type ProductivityEntry,
  type ReportSummary,
  type TeamReport,
  type WellnessReport,
  type WellnessRiskLevel,
  type DigestReport,
} from "@/lib/reports";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const CATEGORY_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#f97316", "#14b8a6", "#a855f7",
];

type ReportTab = "overview" | "team" | "wellness" | "digest";

const RISK_COLORS: Record<WellnessRiskLevel, { bg: string; text: string; label: string }> = {
  healthy: { bg: "bg-success-light", text: "text-success", label: "Healthy" },
  watch: { bg: "bg-warning-light", text: "text-warning", label: "Watch" },
  at_risk: { bg: "bg-[#f97316]/10", text: "text-[#f97316]", label: "At Risk" },
  critical: { bg: "bg-danger-light", text: "text-danger", label: "Critical" },
};

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>("overview");
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [burnRate, setBurnRate] = useState<BurnRateEntry[]>([]);
  const [productivity, setProductivity] = useState<ProductivityEntry[]>([]);
  const [teamReport, setTeamReport] = useState<TeamReport | null>(null);
  const [wellnessReport, setWellnessReport] = useState<WellnessReport | null>(null);
  const [digestReport, setDigestReport] = useState<DigestReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (tab === "overview") {
          const [s, b, p] = await Promise.all([
            getReportSummary(),
            getBurnRate(),
            getProductivity(),
          ]);
          setSummary(s);
          setBurnRate(b);
          setProductivity(p);
        } else if (tab === "team") {
          const t = await getTeamReport();
          setTeamReport(t);
        } else if (tab === "wellness") {
          const w = await getWellnessReport();
          setWellnessReport(w);
        } else if (tab === "digest") {
          const d = await getDigest();
          setDigestReport(d);
        }
      } catch {
        setOffline(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tab]);

  function handleDownloadCSV() {
    window.open(getExportUrl(), "_blank");
  }

  function handleDownloadPDF() {
    window.open(getPdfExportUrl(), "_blank");
  }

  if (offline) {
    return (
      <div className="empty-state py-32">
        <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
        <h3>Reporting service unavailable</h3>
        <p>
          The reporting service is not running. Start your Docker containers with{" "}
          <code className="rounded bg-surface-inset px-1.5 py-0.5 text-[12px] font-mono border border-border">docker compose up</code>{" "}
          to enable analytics.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
            Reports & Analytics
          </h1>
          <p className="mt-0.5 text-[13px] text-muted">
            Enterprise-grade visibility into time, cost, and productivity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPDF}
            className="btn btn-secondary"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            Export PDF
          </button>
          <button
            onClick={handleDownloadCSV}
            className="btn btn-secondary"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download CSV
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="tab-bar mb-6">
        {(["overview", "team", "wellness", "digest"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`tab-item capitalize ${tab === t ? "tab-item-active" : ""}`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {tab === "overview" && (
            <>
              {/* Summary KPIs */}
              {summary && (
                <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
                  {[
                    { label: "Total Entries", value: summary.total_entries.toLocaleString(), mono: false },
                    { label: "Total Hours", value: `${summary.total_hours.toFixed(1)}h`, mono: true },
                    { label: "Total Cost", value: `$${summary.total_cost.toFixed(2)}`, mono: true },
                    { label: "Avg Quality", value: summary.avg_quality_score > 0 ? `${summary.avg_quality_score}/100` : "--", mono: true },
                  ].map((kpi, i) => (
                    <div
                      key={kpi.label}
                      className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-xs)] animate-fade-in-up"
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                        {kpi.label}
                      </p>
                      <p className={`stat-value mt-2 ${kpi.mono ? "font-mono" : ""}`}>
                        {kpi.value}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Burn Rate Chart */}
              <div className="mb-8 rounded-xl border border-border bg-card shadow-[var(--shadow-xs)] overflow-hidden animate-fade-in-up" style={{ animationDelay: "240ms" }}>
                <div className="border-b border-border px-5 py-3.5">
                  <h2 className="text-[14px] font-semibold">Weekly Burn Rate</h2>
                  <p className="text-[12px] text-muted mt-0.5">
                    Hours and cost aggregated by ISO week across all projects.
                  </p>
                </div>
                {burnRate.length === 0 ? (
                  <div className="empty-state">
                    <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                    </svg>
                    <h3>No burn data yet</h3>
                    <p>Approved time logs will appear here.</p>
                  </div>
                ) : (
                  <div className="h-[320px] p-5 pt-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={burnRate} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis
                          dataKey="week"
                          tick={{ fontSize: 11, fill: "var(--muted)" }}
                          tickLine={false}
                          axisLine={{ stroke: "var(--border)" }}
                        />
                        <YAxis
                          yAxisId="hours"
                          tick={{ fontSize: 11, fill: "var(--muted)" }}
                          tickLine={false}
                          axisLine={false}
                          width={50}
                          tickFormatter={(v) => `${v}h`}
                        />
                        <YAxis
                          yAxisId="cost"
                          orientation="right"
                          tick={{ fontSize: 11, fill: "var(--muted)" }}
                          tickLine={false}
                          axisLine={false}
                          width={60}
                          tickFormatter={(v) => `$${v}`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--card)",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            fontSize: 12,
                            boxShadow: "var(--shadow-md)",
                          }}
                          formatter={(value, name) => {
                            const v = Number(value);
                            if (name === "Billable Hours" || name === "Non-billable") return [`${v.toFixed(1)}h`, name];
                            return [`$${v.toFixed(2)}`, name];
                          }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: 11 }}
                          iconType="square"
                          iconSize={10}
                        />
                        <Bar yAxisId="hours" dataKey="billable_hours" name="Billable Hours" fill="#6366f1" radius={[3, 3, 0, 0]} />
                        <Bar yAxisId="hours" dataKey="non_billable_hours" name="Non-billable" fill="#a1a1aa" radius={[3, 3, 0, 0]} />
                        <Bar yAxisId="cost" dataKey="total_cost" name="Cost" fill="#10b981" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Productivity Breakdown */}
              <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-xs)] overflow-hidden animate-fade-in-up" style={{ animationDelay: "320ms" }}>
                <div className="border-b border-border px-5 py-3.5">
                  <h2 className="text-[14px] font-semibold">Productivity by Category</h2>
                  <p className="text-[12px] text-muted mt-0.5">
                    Time distribution across AI-assigned work categories.
                  </p>
                </div>
                {productivity.length === 0 ? (
                  <div className="empty-state">
                    <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                    </svg>
                    <h3>No categorised data yet</h3>
                    <p>AI insights will populate this chart.</p>
                  </div>
                ) : (
                  <div className="space-y-3 p-5">
                    {productivity.map((cat, i) => (
                      <div key={cat.category} className="animate-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2.5 w-2.5 rounded-sm"
                              style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                            />
                            <span className="text-[13px] font-medium">{cat.category}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[12px] text-muted font-mono tabular-nums">
                              {cat.hours.toFixed(1)}h
                            </span>
                            <span className="text-[12px] font-medium font-mono tabular-nums w-[52px] text-right">
                              {cat.percentage.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <div className="progress-track">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${cat.percentage}%`,
                              backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Team Tab */}
          {tab === "team" && (
            <>
              {teamReport && (
                <>
                  {/* Team KPIs */}
                  <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3">
                    {[
                      { label: "Team Members", value: teamReport.users.length.toString(), mono: false },
                      { label: "Total Hours", value: `${teamReport.total_hours.toFixed(1)}h`, mono: true },
                      { label: "Total Cost", value: `$${teamReport.total_cost.toFixed(2)}`, mono: true },
                    ].map((kpi, i) => (
                      <div
                        key={kpi.label}
                        className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-xs)] animate-fade-in-up"
                        style={{ animationDelay: `${i * 60}ms` }}
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                          {kpi.label}
                        </p>
                        <p className={`stat-value mt-2 ${kpi.mono ? "font-mono" : ""}`}>
                          {kpi.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* User Breakdown Table */}
                  <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-xs)] overflow-hidden animate-fade-in-up" style={{ animationDelay: "180ms" }}>
                    <div className="border-b border-border px-5 py-3.5">
                      <h2 className="text-[14px] font-semibold">Hours by Team Member</h2>
                      <p className="text-[12px] text-muted mt-0.5">
                        Breakdown of billable and non-billable hours per user.
                      </p>
                    </div>
                    {teamReport.users.length === 0 ? (
                      <div className="empty-state">
                        <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                        </svg>
                        <h3>No team data available</h3>
                        <p>Team member data will appear once time is logged.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr>
                              <th className="table-header text-left">Member</th>
                              <th className="table-header text-right">Billable</th>
                              <th className="table-header text-right">Non-billable</th>
                              <th className="table-header text-right">Total Hours</th>
                              <th className="table-header text-right">Cost</th>
                              <th className="table-header text-right">Entries</th>
                            </tr>
                          </thead>
                          <tbody>
                            {teamReport.users.map((user, i) => (
                              <tr
                                key={user.user_id}
                                className="animate-fade-in-up"
                                style={{ animationDelay: `${i * 30}ms` }}
                              >
                                <td className="table-cell font-medium">
                                  {user.user_name || user.user_id.slice(0, 8)}
                                </td>
                                <td className="table-cell text-right font-mono tabular-nums">
                                  {user.billable_hours.toFixed(1)}h
                                </td>
                                <td className="table-cell text-right font-mono tabular-nums text-muted">
                                  {user.non_billable_hours.toFixed(1)}h
                                </td>
                                <td className="table-cell text-right font-mono tabular-nums font-semibold">
                                  {user.total_hours.toFixed(1)}h
                                </td>
                                <td className="table-cell text-right font-mono tabular-nums">
                                  ${user.total_cost.toFixed(2)}
                                </td>
                                <td className="table-cell text-right font-mono tabular-nums text-muted">
                                  {user.entry_count}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {/* Wellness Tab */}
          {tab === "wellness" && (
            <>
              {wellnessReport && (
                <>
                  {/* Overall Risk Badge */}
                  <div className="mb-6 flex items-center gap-3 animate-fade-in-up">
                    <span className="text-[13px] font-medium text-muted">Overall Team Risk:</span>
                    <span className={`badge ${RISK_COLORS[wellnessReport.overall_risk].bg} ${RISK_COLORS[wellnessReport.overall_risk].text}`}>
                      {RISK_COLORS[wellnessReport.overall_risk].label}
                    </span>
                  </div>

                  {/* Wellness Cards */}
                  {wellnessReport.users.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-xs)]">
                      <div className="empty-state">
                        <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                        </svg>
                        <h3>No wellness data available</h3>
                        <p>Wellness metrics will appear once team members have logged time.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {wellnessReport.users.map((user, i) => {
                        const risk = RISK_COLORS[user.risk_level];
                        return (
                          <div
                            key={user.user_id}
                            className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-xs)] animate-fade-in-up"
                            style={{ animationDelay: `${i * 60}ms` }}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h3 className="text-[14px] font-semibold">
                                  {user.user_name || user.user_id.slice(0, 8)}
                                </h3>
                                <p className="text-[12px] text-muted mt-0.5">
                                  Avg {user.avg_daily_hours.toFixed(1)}h/day
                                </p>
                              </div>
                              <span className={`badge ${risk.bg} ${risk.text}`}>
                                {risk.label}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <div className="rounded-lg bg-surface-inset px-3 py-2">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Overtime</p>
                                <p className="text-[14px] font-semibold font-mono tabular-nums mt-0.5">
                                  {user.overtime_hours.toFixed(1)}h
                                </p>
                              </div>
                              <div className="rounded-lg bg-surface-inset px-3 py-2">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Consecutive OT Days</p>
                                <p className="text-[14px] font-semibold font-mono tabular-nums mt-0.5">
                                  {user.consecutive_overtime_days}
                                </p>
                              </div>
                            </div>

                            {user.recommendation && (
                              <p className="text-[12px] text-muted leading-relaxed">
                                {user.recommendation}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Digest Tab */}
          {tab === "digest" && (
            <>
              {digestReport && (
                <div className="space-y-6">
                  {/* Digest Card */}
                  <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-xs)] overflow-hidden animate-fade-in-up">
                    <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
                      <div>
                        <h2 className="text-[14px] font-semibold">Weekly Digest</h2>
                        <p className="text-[12px] text-muted mt-0.5">
                          {digestReport.period}
                        </p>
                      </div>
                      <span className="text-[11px] text-muted">
                        Generated {new Date(digestReport.generated_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="p-5 text-[13px] leading-relaxed text-foreground">
                      {digestReport.narrative.split("\n").map((paragraph, i) => (
                        <p key={i} className="mb-3 last:mb-0">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </div>

                  {/* Highlights */}
                  {digestReport.highlights.length > 0 && (
                    <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-xs)] overflow-hidden animate-fade-in-up" style={{ animationDelay: "100ms" }}>
                      <div className="border-b border-border px-5 py-3.5">
                        <h2 className="text-[14px] font-semibold">Key Highlights</h2>
                      </div>
                      <ul className="p-5 space-y-2.5">
                        {digestReport.highlights.map((highlight, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-3 text-[13px] animate-fade-in-up"
                            style={{ animationDelay: `${(i + 2) * 60}ms` }}
                          >
                            <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                            <span className="leading-relaxed">{highlight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
