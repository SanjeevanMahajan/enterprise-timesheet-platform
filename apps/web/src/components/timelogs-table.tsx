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
    <div className="rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
          </svg>
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            Recent Activity
          </h3>
        </div>
        <span className="rounded-full bg-background px-2.5 py-0.5 text-[11px] font-semibold text-muted tabular-nums">
          {logs.length} {logs.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {error && (
        <div className="px-6 py-3">
          <div className="rounded-lg bg-danger-light border border-danger/15 px-3 py-2 text-xs font-medium text-danger">
            {error}
          </div>
        </div>
      )}

      {loading ? (
        <div className="px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 text-[13px] text-muted">
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading activity...
          </div>
        </div>
      ) : logs.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-background">
            <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <p className="mt-3 text-[13px] font-medium text-foreground">No time entries yet</p>
          <p className="mt-1 text-xs text-muted">
            Start the timer to begin tracking your work.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="px-6 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                  Date
                </th>
                <th className="px-6 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                  Description
                </th>
                <th className="px-6 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                  Duration
                </th>
                <th className="px-6 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                  Amount
                </th>
                <th className="px-6 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                  Source
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-border-subtle last:border-0 transition-colors hover:bg-card-hover"
                >
                  <td className="px-6 py-3 whitespace-nowrap text-[13px] text-muted">
                    {formatDate(log.log_date)}
                  </td>
                  <td className="px-6 py-3 max-w-[240px] truncate text-[13px] font-medium">
                    {log.description || (
                      <span className="text-muted-foreground font-normal">Untitled</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right whitespace-nowrap">
                    <span className="text-[13px] font-semibold tabular-nums">
                      {formatHours(log.hours)}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right whitespace-nowrap">
                    {log.billable_amount > 0 ? (
                      <span className="text-[13px] font-medium text-success tabular-nums">
                        ${log.billable_amount.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-[13px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-center">
                    {log.is_timer_running ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-primary-light px-2 py-0.5 text-[11px] font-semibold text-primary">
                        <span className="h-1 w-1 rounded-full bg-primary animate-pulse" />
                        Live
                      </span>
                    ) : log.timer_started_at ? (
                      <span className="inline-flex items-center rounded-md bg-primary-light px-2 py-0.5 text-[11px] font-semibold text-primary">
                        Timer
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-background px-2 py-0.5 text-[11px] font-semibold text-muted">
                        Manual
                      </span>
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
