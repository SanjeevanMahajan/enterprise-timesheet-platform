"use client";

import { useEffect, useState } from "react";
import { listTimeLogs } from "@/lib/timelogs";
import type { TimeLogResponse } from "@/lib/types";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Development: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" },
  Maintenance: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400" },
  Meetings: { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400" },
  Testing: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
  "Code Review": { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400" },
  Documentation: { bg: "bg-pink-500/10", text: "text-pink-600 dark:text-pink-400" },
  DevOps: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400" },
  Design: { bg: "bg-fuchsia-500/10", text: "text-fuchsia-600 dark:text-fuchsia-400" },
  Refactoring: { bg: "bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-400" },
  Research: { bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400" },
  General: { bg: "bg-zinc-500/10", text: "text-zinc-500" },
};

function CategoryBadge({ category }: { category: string }) {
  const colors = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.General;
  return (
    <span
      className={`badge ${colors.bg} ${colors.text}`}
    >
      {category}
    </span>
  );
}

function DescriptionTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);

  if (text.length <= 48) {
    return <span>{text}</span>;
  }

  return (
    <span
      className="relative cursor-default"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="truncate block max-w-[220px]">{text}</span>
      {show && (
        <span className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-lg border border-border bg-card px-3 py-2 text-[12px] text-foreground shadow-[var(--shadow-lg)] leading-relaxed">
          {text}
          <span className="absolute left-4 top-full border-4 border-transparent border-t-border" />
        </span>
      )}
    </span>
  );
}

function QualityIndicator({ score, suggestion }: { score: number; suggestion: string }) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (score >= 50) {
    return (
      <svg className="h-3.5 w-3.5 text-success" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75" />
      </svg>
    );
  }

  return (
    <span
      className="relative inline-flex cursor-help"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <svg
        className="h-3.5 w-3.5 text-warning"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
        />
      </svg>
      {showTooltip && (
        <span className="absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-lg border border-border bg-card px-3 py-2 text-[12px] text-foreground shadow-[var(--shadow-lg)]">
          <span className="font-semibold text-warning">Quality: {score}/100</span>
          <br />
          <span className="text-muted">{suggestion}</span>
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-border" />
        </span>
      )}
    </span>
  );
}

export function TimeLogsTable({ refreshKey }: { refreshKey?: number }) {
  const [logs, setLogs] = useState<TimeLogResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    listTimeLogs()
      .then((data) => {
        setLogs(data);
        setError("");
      })
      .catch(() => setError("Failed to load time logs"))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  return (
    <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-xs)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
          </svg>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
            Recent Activity
          </h3>
        </div>
        <span className="badge bg-surface-inset text-muted tabular-nums">
          {logs.length} {logs.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {error && (
        <div className="px-5 py-3">
          <div className="rounded-lg bg-danger-light border border-danger/15 px-3 py-2 text-[12px] font-medium text-danger">
            {error}
          </div>
        </div>
      )}

      {loading ? (
        <div className="empty-state">
          <svg className="h-5 w-5 animate-spin !mb-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-[13px] text-muted">Loading activity...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <h3>No time entries yet</h3>
          <p>Start the timer to begin tracking your work.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header text-left">Date</th>
                <th className="table-header text-left">Project</th>
                <th className="table-header text-left">Description</th>
                <th className="table-header text-right">Duration</th>
                <th className="table-header text-right">Amount</th>
                <th className="table-header text-center">Source</th>
                <th className="table-header text-center">Quality</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr
                  key={log.id}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <td className="table-cell whitespace-nowrap text-muted">
                    {formatDate(log.log_date)}
                  </td>
                  <td className="table-cell whitespace-nowrap font-medium">
                    {log.project_id ? (
                      <span className="text-[13px]">{log.project_id.slice(0, 8)}</span>
                    ) : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </td>
                  <td className="table-cell max-w-[240px]">
                    <div className="flex items-center gap-2">
                      {log.description ? (
                        <DescriptionTooltip text={log.description} />
                      ) : (
                        <span className="text-muted-foreground">Untitled</span>
                      )}
                      {log.ai_category && (
                        <CategoryBadge category={log.ai_category} />
                      )}
                    </div>
                  </td>
                  <td className="table-cell text-right whitespace-nowrap">
                    <span className="font-mono font-semibold tabular-nums">
                      {formatHours(log.hours)}
                    </span>
                  </td>
                  <td className="table-cell text-right whitespace-nowrap">
                    {log.billable_amount > 0 ? (
                      <span className="font-mono font-medium text-success tabular-nums">
                        ${log.billable_amount.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </td>
                  <td className="table-cell text-center">
                    {log.is_timer_running ? (
                      <span className="badge bg-primary-light text-primary">
                        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-primary animate-pulse inline-block" />
                        Live
                      </span>
                    ) : log.timer_started_at ? (
                      <span className="badge bg-primary-light text-primary">
                        Timer
                      </span>
                    ) : (
                      <span className="badge bg-surface-inset text-muted">
                        Manual
                      </span>
                    )}
                  </td>
                  <td className="table-cell text-center">
                    {log.ai_quality_score !== null && log.ai_suggestion ? (
                      <QualityIndicator
                        score={log.ai_quality_score}
                        suggestion={log.ai_suggestion}
                      />
                    ) : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
