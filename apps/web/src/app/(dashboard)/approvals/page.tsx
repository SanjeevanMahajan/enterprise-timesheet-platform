"use client";

import { useEffect, useState, useRef } from "react";
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

  // Inline rejection reason state
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const rejectInputRef = useRef<HTMLInputElement>(null);

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

  // Focus reject input when it appears
  useEffect(() => {
    if (rejectingId && rejectInputRef.current) {
      rejectInputRef.current.focus();
    }
  }, [rejectingId]);

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

  function initiateReject(logId: string) {
    setRejectingId(logId);
    setRejectReason("");
  }

  async function confirmReject(logId: string) {
    setActingOn(logId);
    try {
      await managerReject(logId, rejectReason);
      setLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch (err) {
      console.error("Reject failed", err);
    } finally {
      setActingOn(null);
      setRejectingId(null);
      setRejectReason("");
    }
  }

  function cancelReject() {
    setRejectingId(null);
    setRejectReason("");
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

  // Timesheet rejection with inline input
  const [rejectingTimesheetId, setRejectingTimesheetId] = useState<string | null>(null);
  const [rejectTimesheetReason, setRejectTimesheetReason] = useState("");
  const rejectTimesheetInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (rejectingTimesheetId && rejectTimesheetInputRef.current) {
      rejectTimesheetInputRef.current.focus();
    }
  }, [rejectingTimesheetId]);

  function initiateRejectTimesheet(id: string) {
    setRejectingTimesheetId(id);
    setRejectTimesheetReason("");
  }

  async function confirmRejectTimesheet(id: string) {
    setActingOn(id);
    try {
      await rejectTimesheet(id, rejectTimesheetReason);
      setTimesheets((prev) => prev.filter((ts) => ts.id !== id));
    } catch (err) {
      console.error("Reject timesheet failed", err);
    } finally {
      setActingOn(null);
      setRejectingTimesheetId(null);
      setRejectTimesheetReason("");
    }
  }

  function cancelRejectTimesheet() {
    setRejectingTimesheetId(null);
    setRejectTimesheetReason("");
  }

  if (!canApprove) {
    return (
      <div className="empty-state" style={{ minHeight: "60vh" }}>
        <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
        <h3>Access Restricted</h3>
        <p>Only managers and admins can approve time entries.</p>
      </div>
    );
  }

  return (
    <>
      {/* Page header */}
      <div className="mb-6 animate-fade-in-up">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
          Approvals
        </h1>
        <p className="mt-0.5 text-[13px] text-muted">
          Review and approve team time entries and weekly timesheets
          {topTab === "logs" && logTab === "pending" && logs.length > 0 && !loading && (
            <span className="ml-1.5 text-foreground font-medium">
              &mdash; {logs.length} pending
            </span>
          )}
        </p>
      </div>

      {/* Top-level tab bar */}
      <div className="mb-6 animate-fade-in-up" style={{ animationDelay: "60ms" }}>
        <div className="tab-bar">
          <button
            onClick={() => setTopTab("logs")}
            className={`tab-item ${topTab === "logs" ? "tab-item-active" : ""}`}
          >
            Time Entries
          </button>
          <button
            onClick={() => setTopTab("timesheets")}
            className={`tab-item ${topTab === "timesheets" ? "tab-item-active" : ""}`}
          >
            Timesheets
          </button>
        </div>
      </div>

      {topTab === "logs" ? (
        <>
          {/* Sub-tabs for status filtering */}
          <div className="mb-5 flex items-center gap-1 animate-fade-in-up" style={{ animationDelay: "120ms" }}>
            {(["pending", "approved", "rejected"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setLogTab(t)}
                className={`relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-all duration-150 capitalize ${
                  logTab === t
                    ? "bg-primary/10 text-primary"
                    : "text-muted hover:text-foreground hover:bg-surface-inset"
                }`}
              >
                {t === "pending" ? "Pending" : t}
                {t === "pending" && !loading && logs.length > 0 && logTab === "pending" && (
                  <span className="badge bg-primary/10 text-primary text-[10px] ml-0.5">
                    {logs.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Time entries table */}
          <div
            className="animate-fade-in-up rounded-xl border border-border bg-card shadow-[var(--shadow-xs)] overflow-hidden"
            style={{ animationDelay: "180ms" }}
          >
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex items-center gap-2.5 text-[13px] text-muted">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading entries...
                </div>
              </div>
            ) : logs.length === 0 ? (
              <div className="empty-state">
                <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <h3>
                  {logTab === "pending"
                    ? "No entries awaiting approval"
                    : `No ${logTab} entries`}
                </h3>
                <p>
                  {logTab === "pending"
                    ? "All time entries have been reviewed. Check back later."
                    : `There are no ${logTab} time entries to display.`}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header text-left">Date</th>
                      <th className="table-header text-left">User</th>
                      <th className="table-header text-left">Project</th>
                      <th className="table-header text-left">Description</th>
                      <th className="table-header text-right">Hours</th>
                      <th className="table-header text-right">Amount</th>
                      {logTab === "pending" && (
                        <th className="table-header text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id}>
                          <td className="table-cell whitespace-nowrap text-muted">
                            {new Date(log.log_date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </td>
                          <td className="table-cell">
                            <span className="font-mono text-[12px] text-muted">
                              {log.user_id.slice(0, 8)}
                            </span>
                          </td>
                          <td className="table-cell font-medium">
                            {projectName(log.project_id)}
                          </td>
                          <td className="table-cell text-muted max-w-[280px] truncate">
                            {log.description || "\u2014"}
                          </td>
                          <td className="table-cell text-right font-mono tabular-nums">
                            {log.hours.toFixed(1)}h
                          </td>
                          <td className="table-cell text-right font-mono tabular-nums">
                            ${log.billable_amount.toFixed(2)}
                          </td>
                          {logTab === "pending" && (
                            <td className="table-cell text-right">
                              {rejectingId === log.id ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <input
                                    ref={rejectInputRef}
                                    type="text"
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") confirmReject(log.id);
                                      if (e.key === "Escape") cancelReject();
                                    }}
                                    placeholder="Reason (optional)"
                                    className="input !w-40 !py-1 !text-[12px]"
                                  />
                                  <button
                                    onClick={() => confirmReject(log.id)}
                                    disabled={actingOn === log.id}
                                    className="btn btn-danger !py-1 !px-2.5 !text-[12px]"
                                  >
                                    {actingOn === log.id ? (
                                      <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                      </svg>
                                    ) : "Confirm"}
                                  </button>
                                  <button
                                    onClick={cancelReject}
                                    className="btn btn-ghost !py-1 !px-2 !text-[12px]"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleApprove(log.id)}
                                    disabled={actingOn === log.id}
                                    className="inline-flex items-center gap-1 rounded-md bg-[#059669]/10 px-2.5 py-1.5 text-[12px] font-medium text-[#059669] transition-colors hover:bg-[#059669]/20 disabled:opacity-50"
                                  >
                                    {actingOn === log.id ? (
                                      <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                      </svg>
                                    ) : (
                                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                      </svg>
                                    )}
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => initiateReject(log.id)}
                                    disabled={actingOn === log.id}
                                    className="inline-flex items-center gap-1 rounded-md bg-[#dc2626]/10 px-2.5 py-1.5 text-[12px] font-medium text-[#dc2626] transition-colors hover:bg-[#dc2626]/20 disabled:opacity-50"
                                  >
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                    </svg>
                                    Reject
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                    </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Timesheets tab */
        <div
          className="animate-fade-in-up rounded-xl border border-border bg-card shadow-[var(--shadow-xs)] overflow-hidden"
          style={{ animationDelay: "120ms" }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-2.5 text-[13px] text-muted">
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <h3>No timesheets awaiting approval</h3>
              <p>All submitted timesheets have been reviewed.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header text-left">User</th>
                    <th className="table-header text-left">Week Range</th>
                    <th className="table-header text-right">Hours</th>
                    <th className="table-header text-left">Submitted</th>
                    <th className="table-header text-left">Status</th>
                    <th className="table-header text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {timesheets.map((ts) => (
                    <tr key={ts.id}>
                      <td className="table-cell">
                        <span className="font-mono text-[12px] text-muted">
                          {ts.user_id.slice(0, 8)}
                        </span>
                      </td>
                      <td className="table-cell font-medium whitespace-nowrap">
                        {new Date(ts.week_start).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        &ndash;{" "}
                        {new Date(ts.week_end).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="table-cell text-right font-mono tabular-nums">
                        {ts.total_hours.toFixed(1)}h
                      </td>
                      <td className="table-cell text-muted whitespace-nowrap">
                        {new Date(ts.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="table-cell">
                        <span className="badge bg-[#0284c7]/10 text-[#0284c7]">
                          {ts.status}
                        </span>
                      </td>
                      <td className="table-cell text-right">
                        {rejectingTimesheetId === ts.id ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <input
                              ref={rejectTimesheetInputRef}
                              type="text"
                              value={rejectTimesheetReason}
                              onChange={(e) => setRejectTimesheetReason(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") confirmRejectTimesheet(ts.id);
                                if (e.key === "Escape") cancelRejectTimesheet();
                              }}
                              placeholder="Reason (optional)"
                              className="input !w-40 !py-1 !text-[12px]"
                            />
                            <button
                              onClick={() => confirmRejectTimesheet(ts.id)}
                              disabled={actingOn === ts.id}
                              className="btn btn-danger !py-1 !px-2.5 !text-[12px]"
                            >
                              {actingOn === ts.id ? (
                                <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                              ) : "Confirm"}
                            </button>
                            <button
                              onClick={cancelRejectTimesheet}
                              className="btn btn-ghost !py-1 !px-2 !text-[12px]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleApproveTimesheet(ts.id)}
                              disabled={actingOn === ts.id}
                              className="inline-flex items-center gap-1 rounded-md bg-[#059669]/10 px-2.5 py-1.5 text-[12px] font-medium text-[#059669] transition-colors hover:bg-[#059669]/20 disabled:opacity-50"
                            >
                              {actingOn === ts.id ? (
                                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                              ) : (
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                              )}
                              Approve
                            </button>
                            <button
                              onClick={() => initiateRejectTimesheet(ts.id)}
                              disabled={actingOn === ts.id}
                              className="inline-flex items-center gap-1 rounded-md bg-[#dc2626]/10 px-2.5 py-1.5 text-[12px] font-medium text-[#dc2626] transition-colors hover:bg-[#dc2626]/20 disabled:opacity-50"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                              </svg>
                              Reject
                            </button>
                          </div>
                        )}
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
