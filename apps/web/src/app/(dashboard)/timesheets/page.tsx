"use client";

import { useEffect, useState } from "react";
import { listTimeLogs } from "@/lib/timelogs";
import { listMyTimesheets, submitTimesheet } from "@/lib/timesheets";
import type { TimeLogResponse, TimesheetResponse } from "@/lib/types";

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

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-background text-muted",
  submitted: "bg-primary-light text-primary",
  approved: "bg-success-light text-success",
  rejected: "bg-danger-light text-danger",
};

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

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
          Timesheets
        </h1>
        <p className="mt-0.5 text-[13px] text-muted">
          Submit and track your weekly timesheets.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg bg-background p-1 w-fit border border-border">
        {(["current", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-[13px] font-medium transition-all duration-150 capitalize ${
              tab === t
                ? "bg-card text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t === "current" ? "Current Week" : "History"}
          </button>
        ))}
      </div>

      {tab === "current" ? (
        <>
          {/* Week navigator */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setWeekOffset((v) => v - 1)}
                className="rounded-lg border border-border px-2.5 py-1.5 text-[13px] text-muted hover:text-foreground hover:bg-card transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
              </button>
              <span className="text-[14px] font-medium min-w-[180px] text-center">
                {fmtDateDisplay(weekStart)} – {fmtDateDisplay(weekEnd)}
              </span>
              <button
                onClick={() => setWeekOffset((v) => v + 1)}
                className="rounded-lg border border-border px-2.5 py-1.5 text-[13px] text-muted hover:text-foreground hover:bg-card transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>
              {weekOffset !== 0 && (
                <button
                  onClick={() => setWeekOffset(0)}
                  className="rounded-md px-2.5 py-1 text-[12px] text-primary hover:text-primary-hover transition-colors"
                >
                  Today
                </button>
              )}
            </div>
            <button
              onClick={handleSubmitWeek}
              disabled={!canSubmit || submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                </svg>
              )}
              Submit Week for Approval
            </button>
          </div>

          {/* Summary bar */}
          <div className="mb-4 flex gap-4">
            <div className="rounded-xl border border-border bg-card px-4 py-3 flex-1">
              <p className="text-[11px] font-medium text-muted uppercase tracking-wide">Entries</p>
              <p className="text-lg font-semibold mt-0.5">{logs.length}</p>
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-3 flex-1">
              <p className="text-[11px] font-medium text-muted uppercase tracking-wide">Total Hours</p>
              <p className="text-lg font-semibold mt-0.5 font-mono tabular-nums">{totalHours.toFixed(1)}h</p>
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-3 flex-1">
              <p className="text-[11px] font-medium text-muted uppercase tracking-wide">Billable Amount</p>
              <p className="text-lg font-semibold mt-0.5 font-mono tabular-nums">${totalBillable.toFixed(2)}</p>
            </div>
          </div>

          {/* Time logs table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : logs.length === 0 ? (
              <div className="px-6 py-16 text-center text-[13px] text-muted">
                No time entries for this week. Start a timer from the Dashboard.
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-background/50 text-left text-muted">
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Description</th>
                    <th className="px-4 py-2.5 font-medium text-right">Hours</th>
                    <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                    <th className="px-4 py-2.5 font-medium text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-border-subtle last:border-0 hover:bg-card-hover transition-colors"
                    >
                      <td className="px-4 py-3 text-muted whitespace-nowrap">
                        {new Date(log.log_date).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 max-w-[300px] truncate">
                        {log.description || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        {log.hours.toFixed(1)}h
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        ${log.billable_amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[log.approval_status] ?? ""}`}>
                          {log.approval_status === "pending_manager"
                            ? "Pending"
                            : log.approval_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        /* History tab */
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : timesheets.length === 0 ? (
            <div className="px-6 py-16 text-center text-[13px] text-muted">
              No timesheets submitted yet.
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-background/50 text-left text-muted">
                  <th className="px-4 py-2.5 font-medium">Week</th>
                  <th className="px-4 py-2.5 font-medium text-right">Hours</th>
                  <th className="px-4 py-2.5 font-medium text-center">Status</th>
                  <th className="px-4 py-2.5 font-medium">Submitted</th>
                  <th className="px-4 py-2.5 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {timesheets.map((ts) => (
                  <tr
                    key={ts.id}
                    className="border-b border-border-subtle last:border-0 hover:bg-card-hover transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap font-medium">
                      {new Date(ts.week_start).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      –{" "}
                      {new Date(ts.week_end).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {ts.total_hours.toFixed(1)}h
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[ts.status] ?? ""}`}>
                        {ts.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {new Date(ts.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-muted max-w-[200px] truncate">
                      {ts.rejection_reason || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
