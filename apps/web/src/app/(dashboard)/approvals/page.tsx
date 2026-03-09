"use client";

import { useEffect, useState } from "react";
import { getUserProfile } from "@/lib/auth";
import { listTimeLogs, managerApprove, managerReject } from "@/lib/timelogs";
import {
  listPendingTimesheets,
  approveTimesheet,
  rejectTimesheet,
} from "@/lib/timesheets";
import { listProjects } from "@/lib/projects";
import type {
  ProjectResponse,
  TimeLogResponse,
  TimesheetResponse,
} from "@/lib/types";

type LogTab = "pending" | "approved" | "rejected";
type TopTab = "logs" | "timesheets";

export default function ApprovalsPage() {
  const [topTab, setTopTab] = useState<TopTab>("logs");
  const [logs, setLogs] = useState<TimeLogResponse[]>([]);
  const [timesheets, setTimesheets] = useState<TimesheetResponse[]>([]);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [logTab, setLogTab] = useState<LogTab>("pending");

  const profile = getUserProfile();
  const canApprove = profile?.role === "admin" || profile?.role === "manager";

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (topTab === "logs") {
          const [p, tl] = await Promise.all([
            listProjects(),
            listTimeLogs({
              approval_status:
                logTab === "pending" ? "pending_manager" : logTab,
            }),
          ]);
          setProjects(p);
          setLogs(tl);
        } else {
          const ts = await listPendingTimesheets();
          setTimesheets(ts);
        }
      } catch (err) {
        console.error("Failed to load approvals", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [topTab, logTab]);

  function projectName(id: string): string {
    return projects.find((p) => p.id === id)?.name ?? id.slice(0, 8);
  }

  async function handleApprove(logId: string) {
    setActingOn(logId);
    try {
      await managerApprove(logId);
      setLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch (err) {
      console.error("Approve failed", err);
    } finally {
      setActingOn(null);
    }
  }

  async function handleReject(logId: string) {
    const reason = prompt("Rejection reason (optional):");
    if (reason === null) return; // cancelled
    setActingOn(logId);
    try {
      await managerReject(logId, reason);
      setLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch (err) {
      console.error("Reject failed", err);
    } finally {
      setActingOn(null);
    }
  }

  async function handleApproveTimesheet(id: string) {
    setActingOn(id);
    try {
      await approveTimesheet(id);
      setTimesheets((prev) => prev.filter((ts) => ts.id !== id));
    } catch (err) {
      console.error("Approve timesheet failed", err);
    } finally {
      setActingOn(null);
    }
  }

  async function handleRejectTimesheet(id: string) {
    const reason = prompt("Rejection reason (optional):");
    if (reason === null) return;
    setActingOn(id);
    try {
      await rejectTimesheet(id, reason);
      setTimesheets((prev) => prev.filter((ts) => ts.id !== id));
    } catch (err) {
      console.error("Reject timesheet failed", err);
    } finally {
      setActingOn(null);
    }
  }

  if (!canApprove) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-xl font-semibold mb-2">Access Restricted</h1>
        <p className="text-[14px] text-muted">
          Only managers and admins can approve time entries.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
          Time Approvals
        </h1>
        <p className="mt-0.5 text-[13px] text-muted">
          Review and approve team time entries and weekly timesheets.
        </p>
      </div>

      {/* Top-level tabs: Logs vs Timesheets */}
      <div className="mb-6 flex gap-1 rounded-lg bg-background p-1 w-fit border border-border">
        {(["logs", "timesheets"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTopTab(t)}
            className={`rounded-md px-4 py-1.5 text-[13px] font-medium transition-all duration-150 capitalize ${
              topTab === t
                ? "bg-card text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t === "logs" ? "Individual Logs" : "Timesheets"}
          </button>
        ))}
      </div>

      {topTab === "logs" ? (
        <>
          {/* Sub-tabs for log status */}
          <div className="mb-6 flex gap-1 rounded-lg bg-background p-1 w-fit border border-border">
            {(["pending", "approved", "rejected"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setLogTab(t)}
                className={`rounded-md px-4 py-1.5 text-[13px] font-medium transition-all duration-150 capitalize ${
                  logTab === t
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {t === "pending" ? "Pending Review" : t}
              </button>
            ))}
          </div>

          {/* Logs table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : logs.length === 0 ? (
              <div className="px-6 py-16 text-center text-[13px] text-muted">
                {logTab === "pending"
                  ? "No time entries awaiting approval."
                  : `No ${logTab} entries found.`}
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-background/50 text-left text-muted">
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">User</th>
                    <th className="px-4 py-2.5 font-medium">Project</th>
                    <th className="px-4 py-2.5 font-medium">Description</th>
                    <th className="px-4 py-2.5 font-medium text-right">
                      Hours
                    </th>
                    <th className="px-4 py-2.5 font-medium text-right">
                      Amount
                    </th>
                    {logTab === "pending" && (
                      <th className="px-4 py-2.5 font-medium text-right">
                        Actions
                      </th>
                    )}
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
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px]">
                        {log.user_id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {projectName(log.project_id)}
                      </td>
                      <td className="px-4 py-3 text-muted max-w-[280px] truncate">
                        {log.description || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        {log.hours.toFixed(1)}h
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        ${log.billable_amount.toFixed(2)}
                      </td>
                      {logTab === "pending" && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleApprove(log.id)}
                              disabled={actingOn === log.id}
                              className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2.5 py-1.5 text-[12px] font-medium text-success transition-colors hover:bg-success/20 disabled:opacity-50"
                            >
                              <svg
                                className="h-3.5 w-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={2}
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="m4.5 12.75 6 6 9-13.5"
                                />
                              </svg>
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(log.id)}
                              disabled={actingOn === log.id}
                              className="inline-flex items-center gap-1 rounded-md bg-danger/10 px-2.5 py-1.5 text-[12px] font-medium text-danger transition-colors hover:bg-danger/20 disabled:opacity-50"
                            >
                              <svg
                                className="h-3.5 w-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={2}
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M6 18 18 6M6 6l12 12"
                                />
                              </svg>
                              Reject
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        /* Timesheets tab */
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : timesheets.length === 0 ? (
            <div className="px-6 py-16 text-center text-[13px] text-muted">
              No timesheets awaiting approval.
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-background/50 text-left text-muted">
                  <th className="px-4 py-2.5 font-medium">User</th>
                  <th className="px-4 py-2.5 font-medium">Week</th>
                  <th className="px-4 py-2.5 font-medium text-right">
                    Total Hours
                  </th>
                  <th className="px-4 py-2.5 font-medium">Submitted</th>
                  <th className="px-4 py-2.5 font-medium text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {timesheets.map((ts) => (
                  <tr
                    key={ts.id}
                    className="border-b border-border-subtle last:border-0 hover:bg-card-hover transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-[12px]">
                      {ts.user_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
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
                    <td className="px-4 py-3 text-muted">
                      {new Date(ts.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleApproveTimesheet(ts.id)}
                          disabled={actingOn === ts.id}
                          className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2.5 py-1.5 text-[12px] font-medium text-success transition-colors hover:bg-success/20 disabled:opacity-50"
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="m4.5 12.75 6 6 9-13.5"
                            />
                          </svg>
                          Approve All
                        </button>
                        <button
                          onClick={() => handleRejectTimesheet(ts.id)}
                          disabled={actingOn === ts.id}
                          className="inline-flex items-center gap-1 rounded-md bg-danger/10 px-2.5 py-1.5 text-[12px] font-medium text-danger transition-colors hover:bg-danger/20 disabled:opacity-50"
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 18 18 6M6 6l12 12"
                            />
                          </svg>
                          Reject
                        </button>
                      </div>
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
