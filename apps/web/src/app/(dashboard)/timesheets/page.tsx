"use client";

import { useEffect, useMemo, useState } from "react";
import { listTimeLogs } from "@/lib/timelogs";
import { listMyTimesheets, submitTimesheet } from "@/lib/timesheets";
import type { TimeLogResponse, TimesheetResponse } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getWeekBounds(d: Date): { start: Date; end: Date } {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  const start = new Date(d);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtDateDisplay(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtDateDisplayYear(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Day names for weekly grid
// ---------------------------------------------------------------------------
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ---------------------------------------------------------------------------
// Status badge configs
// ---------------------------------------------------------------------------
const LOG_STATUS_STYLES: Record<string, string> = {
  draft: "bg-surface-inset text-muted",
  pending_manager: "bg-warning-light text-warning",
  approved: "bg-success-light text-success",
  rejected: "bg-danger-light text-danger",
};

const TIMESHEET_STATUS_STYLES: Record<string, string> = {
  draft: "bg-surface-inset text-muted",
  submitted: "bg-info-light text-info",
  approved: "bg-success-light text-success",
  rejected: "bg-danger-light text-danger",
};

// ---------------------------------------------------------------------------
// Timesheets Page
// ---------------------------------------------------------------------------
export default function TimesheetsPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [logs, setLogs] = useState<TimeLogResponse[]>([]);
  const [timesheets, setTimesheets] = useState<TimesheetResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<"current" | "history">("current");

  const now = new Date();
  now.setDate(now.getDate() + weekOffset * 7);
  const { start: weekStart, end: weekEnd } = getWeekBounds(now);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (tab === "current") {
          const tl = await listTimeLogs({});
          // Filter client-side to the current week
          const filtered = tl.filter((l) => {
            const d = new Date(l.log_date);
            return d >= weekStart && d <= weekEnd;
          });
          setLogs(filtered);
        } else {
          const ts = await listMyTimesheets();
          setTimesheets(ts);
        }
      } catch (err) {
        console.error("Failed to load", err);
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset, tab]);

  async function handleSubmitWeek() {
    setSubmitting(true);
    try {
      await submitTimesheet({
        week_start: fmtDate(weekStart),
        week_end: fmtDate(weekEnd),
      });
      // Reload to show updated status
      const tl = await listTimeLogs({});
      const filtered = tl.filter((l) => {
        const d = new Date(l.log_date);
        return d >= weekStart && d <= weekEnd;
      });
      setLogs(filtered);
    } catch (err) {
      console.error("Submit failed", err);
    } finally {
      setSubmitting(false);
    }
  }

  const totalHours = logs.reduce((sum, l) => sum + l.hours, 0);
  const totalBillable = logs.reduce((sum, l) => sum + l.billable_amount, 0);
  const allPending = logs.length > 0 && logs.every(
    (l) => l.approval_status === "pending_manager" || l.approval_status === "approved"
  );
  const canSubmit = logs.length > 0 && !allPending;

  // Compute daily hours for the weekly bar chart
  const dailyHours = useMemo(() => {
    const map: number[] = [0, 0, 0, 0, 0, 0, 0]; // Mon-Sun
    for (const log of logs) {
      const d = new Date(log.log_date);
      let dayIdx = d.getDay() - 1; // getDay: 0=Sun, 1=Mon ... => shift so Mon=0
      if (dayIdx < 0) dayIdx = 6; // Sunday becomes 6
      map[dayIdx] += log.hours;
    }
    return map;
  }, [logs]);

  const maxDailyHours = Math.max(...dailyHours, 1); // avoid division by zero

  return (
    <>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Timesheets</h1>
        <p className="mt-0.5 text-[13px] text-muted">
          Submit and track your weekly timesheets.
        </p>
      </div>

      {/* Tab bar */}
      <div className="tab-bar mb-6">
        <button
          onClick={() => setTab("current")}
          className={`tab-item ${tab === "current" ? "tab-item-active" : ""}`}
        >
          Current Week
        </button>
        <button
          onClick={() => setTab("history")}
          className={`tab-item ${tab === "history" ? "tab-item-active" : ""}`}
        >
          History
        </button>
      </div>

      {tab === "current" ? (
        <>
          {/* Week navigator */}
          <div
            className="animate-fade-in-up mb-5 flex items-center justify-between"
            style={{ animationDelay: "0ms" }}
          >
            <div className="flex items-center gap-2">
              <button
                onClick={() => setWeekOffset((v) => v - 1)}
                className="btn btn-secondary !px-2.5"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
              </button>
              <span className="text-[14px] font-semibold min-w-[200px] text-center tracking-[-0.01em]">
                {fmtDateDisplay(weekStart)}, {weekStart.getFullYear()} &ndash; {fmtDateDisplay(weekEnd)}, {weekEnd.getFullYear()}
              </span>
              <button
                onClick={() => setWeekOffset((v) => v + 1)}
                className="btn btn-secondary !px-2.5"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>
              {weekOffset !== 0 && (
                <button
                  onClick={() => setWeekOffset(0)}
                  className="btn btn-ghost text-[12px]"
                >
                  Today
                </button>
              )}
            </div>
            <button
              onClick={handleSubmitWeek}
              disabled={!canSubmit || submitting}
              className="btn btn-primary font-semibold"
            >
              {submitting ? (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                </svg>
              )}
              Submit Week
            </button>
          </div>

          {/* Summary bar */}
          <div
            className="animate-fade-in-up mb-5 grid grid-cols-3 gap-4"
            style={{ animationDelay: "60ms" }}
          >
            <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-xs)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Entries</p>
              <p className="stat-value mt-2">{loading ? "\u2014" : logs.length}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-xs)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Total Hours</p>
              <p className="stat-value mt-2 tabular-nums">{loading ? "\u2014" : `${totalHours.toFixed(1)}h`}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-xs)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Billable Amount</p>
              <p className="stat-value mt-2 tabular-nums">{loading ? "\u2014" : `$${totalBillable.toFixed(2)}`}</p>
            </div>
          </div>

          {/* Weekly hours breakdown bar chart */}
          {!loading && logs.length > 0 && (
            <div
              className="animate-fade-in-up mb-5 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-xs)]"
              style={{ animationDelay: "120ms" }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted mb-4">
                Weekly Breakdown
              </p>
              <div className="grid grid-cols-7 gap-3">
                {DAY_LABELS.map((day, i) => {
                  const hrs = dailyHours[i];
                  const pct = maxDailyHours > 0 ? (hrs / maxDailyHours) * 100 : 0;
                  return (
                    <div key={day} className="flex flex-col items-center gap-2">
                      <div className="relative flex h-[100px] w-full items-end justify-center">
                        <div
                          className="w-full max-w-[36px] rounded-t-md transition-all duration-500 ease-out"
                          style={{
                            height: `${Math.max(pct, 4)}%`,
                            background: hrs > 0 ? "var(--primary)" : "var(--surface-inset)",
                            opacity: hrs > 0 ? 1 : 0.5,
                          }}
                        />
                      </div>
                      <span className="text-[12px] font-medium tabular-nums text-foreground">
                        {hrs > 0 ? `${hrs.toFixed(1)}h` : "\u2014"}
                      </span>
                      <span className="text-[11px] font-medium text-muted">{day}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Time logs table */}
          <div
            className="animate-fade-in-up rounded-xl border border-border bg-card shadow-[var(--shadow-xs)] overflow-hidden"
            style={{ animationDelay: "180ms" }}
          >
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="inline-flex items-center gap-2 text-[13px] text-muted">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading time entries...
                </div>
              </div>
            ) : logs.length === 0 ? (
              <div className="empty-state">
                <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <h3>No time entries this week</h3>
                <p>Start a timer from the Dashboard to log your hours.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header text-left">Date</th>
                      <th className="table-header text-left">Description</th>
                      <th className="table-header text-right">Hours</th>
                      <th className="table-header text-right">Amount</th>
                      <th className="table-header text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, i) => (
                      <tr
                        key={log.id}
                        className="animate-fade-in-up"
                        style={{ animationDelay: `${220 + i * 35}ms` }}
                      >
                        <td className="table-cell whitespace-nowrap text-muted">
                          {new Date(log.log_date).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="table-cell max-w-[300px] truncate">
                          {log.description || "\u2014"}
                        </td>
                        <td className="table-cell text-right tabular-nums font-medium">
                          {log.hours.toFixed(1)}h
                        </td>
                        <td className="table-cell text-right tabular-nums font-medium">
                          ${log.billable_amount.toFixed(2)}
                        </td>
                        <td className="table-cell text-center">
                          <span className={`badge ${LOG_STATUS_STYLES[log.approval_status] ?? ""}`}>
                            {log.approval_status === "pending_manager"
                              ? "Pending"
                              : log.approval_status.charAt(0).toUpperCase() + log.approval_status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* History tab */
        <div
          className="animate-fade-in-up rounded-xl border border-border bg-card shadow-[var(--shadow-xs)] overflow-hidden"
          style={{ animationDelay: "80ms" }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="inline-flex items-center gap-2 text-[13px] text-muted">
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading timesheets...
              </div>
            </div>
          ) : timesheets.length === 0 ? (
            <div className="empty-state">
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              <h3>No timesheets submitted yet</h3>
              <p>Submit your current week to see it appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header text-left">Week Range</th>
                    <th className="table-header text-right">Total Hours</th>
                    <th className="table-header text-center">Status</th>
                    <th className="table-header text-left">Submitted</th>
                    <th className="table-header text-left">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {timesheets.map((ts, i) => (
                    <tr
                      key={ts.id}
                      className="animate-fade-in-up"
                      style={{ animationDelay: `${120 + i * 35}ms` }}
                    >
                      <td className="table-cell whitespace-nowrap font-medium">
                        {fmtDateDisplay(new Date(ts.week_start))} &ndash; {fmtDateDisplay(new Date(ts.week_end))}
                      </td>
                      <td className="table-cell text-right tabular-nums font-medium">
                        {ts.total_hours.toFixed(1)}h
                      </td>
                      <td className="table-cell text-center">
                        <span className={`badge ${TIMESHEET_STATUS_STYLES[ts.status] ?? ""}`}>
                          {ts.status.charAt(0).toUpperCase() + ts.status.slice(1)}
                        </span>
                      </td>
                      <td className="table-cell text-muted">
                        {fmtDateDisplayYear(new Date(ts.created_at))}
                      </td>
                      <td className="table-cell text-muted max-w-[200px] truncate">
                        {ts.rejection_reason || "\u2014"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
