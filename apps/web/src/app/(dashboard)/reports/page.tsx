"use client";

import { useEffect, useState } from "react";
import {
  getBurnRate,
  getProductivity,
  getReportSummary,
  getExportUrl,
  type BurnRateEntry,
  type ProductivityEntry,
  type ReportSummary,
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

export default function ReportsPage() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [burnRate, setBurnRate] = useState<BurnRateEntry[]>([]);
  const [productivity, setProductivity] = useState<ProductivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [s, b, p] = await Promise.all([
          getReportSummary(),
          getBurnRate(),
          getProductivity(),
        ]);
        setSummary(s);
        setBurnRate(b);
        setProductivity(p);
      } catch {
        setOffline(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function handleDownloadCSV() {
    window.open(getExportUrl(), "_blank");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (offline) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <svg className="mb-3 h-10 w-10 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
        <h2 className="text-[15px] font-semibold mb-1">Reporting service unavailable</h2>
        <p className="text-[13px] text-muted max-w-sm">
          The reporting service is not running. Start your Docker containers with{" "}
          <code className="rounded bg-background px-1.5 py-0.5 text-[12px] font-mono">docker compose up</code>{" "}
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
        <button
          onClick={handleDownloadCSV}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-[13px] font-medium transition-colors hover:bg-card-hover"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download CSV
        </button>
      </div>

      {/* Summary KPIs */}
      {summary && (
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Total Entries", value: summary.total_entries.toLocaleString(), mono: false },
            { label: "Total Hours", value: `${summary.total_hours.toFixed(1)}h`, mono: true },
            { label: "Total Cost", value: `$${summary.total_cost.toFixed(2)}`, mono: true },
            { label: "Avg Quality", value: summary.avg_quality_score > 0 ? `${summary.avg_quality_score}/100` : "—", mono: true },
          ].map((kpi, i) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-border bg-card px-5 py-4 animate-fade-in-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <p className="text-[11px] font-medium text-muted uppercase tracking-wide">
                {kpi.label}
              </p>
              <p className={`text-xl font-semibold mt-1 ${kpi.mono ? "font-mono tabular-nums" : ""}`}>
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Burn Rate Chart */}
      <div className="mb-8 rounded-xl border border-border bg-card p-6">
        <h2 className="text-[15px] font-semibold mb-1">Weekly Burn Rate</h2>
        <p className="text-[12px] text-muted mb-5">
          Hours and cost aggregated by ISO week across all projects.
        </p>
        {burnRate.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-muted">
            No data yet. Approved time logs will appear here.
          </div>
        ) : (
          <div className="h-[320px]">
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
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-[15px] font-semibold mb-1">Productivity by Category</h2>
        <p className="text-[12px] text-muted mb-5">
          Time distribution across AI-assigned work categories.
        </p>
        {productivity.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-muted">
            No categorised data yet. AI insights will populate this chart.
          </div>
        ) : (
          <div className="space-y-3">
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
                <div className="h-2 rounded-full bg-background overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
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
  );
}
