"use client";

import { useEffect, useState } from "react";
import { listProjects } from "@/lib/projects";
import { listTimeLogs } from "@/lib/timelogs";
import type { ProjectResponse, TimeLogResponse } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────

interface ProjectCapacity {
  project: ProjectResponse;
  totalHours: number;
  budgetHours: number | null;
  utilization: number; // 0-100+
  userCount: number;
  trend: "on_track" | "at_risk" | "over_budget";
}

interface UserWorkload {
  userId: string;
  weeklyHours: number;
  projectCount: number;
  status: "light" | "optimal" | "heavy" | "overloaded";
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  return monday.toISOString().split("T")[0];
}

function computeCapacity(
  projects: ProjectResponse[],
  logs: TimeLogResponse[]
): ProjectCapacity[] {
  const hoursByProject: Record<string, { hours: number; users: Set<string> }> = {};

  for (const log of logs) {
    if (!hoursByProject[log.project_id]) {
      hoursByProject[log.project_id] = { hours: 0, users: new Set() };
    }
    hoursByProject[log.project_id].hours += log.hours;
    hoursByProject[log.project_id].users.add(log.user_id);
  }

  return projects
    .filter((p) => p.status === "active")
    .map((project) => {
      const data = hoursByProject[project.id] || { hours: 0, users: new Set() };
      const budgetHours = project.estimated_hours ?? null;
      const utilization = budgetHours ? (data.hours / budgetHours) * 100 : 0;
      let trend: ProjectCapacity["trend"] = "on_track";
      if (budgetHours && utilization > 100) trend = "over_budget";
      else if (budgetHours && utilization > 80) trend = "at_risk";
      return {
        project,
        totalHours: Math.round(data.hours * 10) / 10,
        budgetHours,
        utilization: Math.round(utilization),
        userCount: data.users.size,
        trend,
      };
    })
    .sort((a, b) => b.totalHours - a.totalHours);
}

function computeWorkloads(logs: TimeLogResponse[]): UserWorkload[] {
  const weekStart = getWeekStart();
  const byUser: Record<string, { hours: number; projects: Set<string> }> = {};

  for (const log of logs) {
    if (log.log_date >= weekStart) {
      if (!byUser[log.user_id]) {
        byUser[log.user_id] = { hours: 0, projects: new Set() };
      }
      byUser[log.user_id].hours += log.hours;
      byUser[log.user_id].projects.add(log.project_id);
    }
  }

  return Object.entries(byUser)
    .map(([userId, data]) => {
      let status: UserWorkload["status"] = "optimal";
      if (data.hours < 20) status = "light";
      else if (data.hours > 45) status = "overloaded";
      else if (data.hours > 40) status = "heavy";
      return {
        userId,
        weeklyHours: Math.round(data.hours * 10) / 10,
        projectCount: data.projects.size,
        status,
      };
    })
    .sort((a, b) => b.weeklyHours - a.weeklyHours);
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  light: { bg: "bg-primary-light", text: "text-primary", label: "Light" },
  optimal: { bg: "bg-success-light", text: "text-success", label: "Optimal" },
  heavy: { bg: "bg-warning-light", text: "text-warning", label: "Heavy" },
  overloaded: { bg: "bg-danger-light", text: "text-danger", label: "Overloaded" },
};

const TREND_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  on_track: { bg: "bg-success-light", text: "text-success", label: "On Track" },
  at_risk: { bg: "bg-warning-light", text: "text-warning", label: "At Risk" },
  over_budget: { bg: "bg-danger-light", text: "text-danger", label: "Over Budget" },
};

const STAT_ICONS = {
  projects: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
    </svg>
  ),
  hours: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  ),
  atRisk: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  ),
  overloaded: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z" />
    </svg>
  ),
};

// ── Page ───────────────────────────────────────────────────────────────────

export default function CapacityPage() {
  const [projects, setProjects] = useState<ProjectCapacity[]>([]);
  const [workloads, setWorkloads] = useState<UserWorkload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [projs, logs] = await Promise.all([listProjects(), listTimeLogs()]);
        setProjects(computeCapacity(projs, logs));
        setWorkloads(computeWorkloads(logs));
      } catch {
        // graceful fallback
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const overloadedCount = workloads.filter((w) => w.status === "overloaded").length;
  const atRiskProjects = projects.filter((p) => p.trend !== "on_track").length;
  const totalActiveHours = projects.reduce((sum, p) => sum + p.totalHours, 0);

  const statCards = [
    { label: "Active Projects", value: String(projects.length), accent: "text-primary", accentBg: "bg-primary-light", icon: STAT_ICONS.projects },
    { label: "Total Hours", value: `${totalActiveHours.toFixed(0)}h`, accent: "text-success", accentBg: "bg-success-light", icon: STAT_ICONS.hours },
    { label: "At-Risk Projects", value: String(atRiskProjects), accent: "text-warning", accentBg: "bg-warning-light", icon: STAT_ICONS.atRisk },
    { label: "Overloaded Users", value: String(overloadedCount), accent: "text-danger", accentBg: "bg-danger-light", icon: STAT_ICONS.overloaded },
  ];

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
          Resource Planning
        </h1>
        <p className="mt-0.5 text-[13px] text-muted">
          Capacity utilization, workload balance, and project health.
        </p>
      </div>

      {/* Summary cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((card, i) => (
          <div
            key={card.label}
            className="animate-fade-in-up rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-xs)]"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                {card.label}
              </span>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.accentBg} ${card.accent}`}>
                {card.icon}
              </div>
            </div>
            <p className="stat-value">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Project Capacity */}
      <div
        className="mb-8 rounded-xl border border-border bg-card shadow-[var(--shadow-xs)] overflow-hidden animate-fade-in-up"
        style={{ animationDelay: "320ms" }}
      >
        <div className="border-b border-border px-5 py-3.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
            Project Capacity
          </h3>
        </div>
        {projects.length === 0 ? (
          <div className="empty-state">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
            </svg>
            <h3>No active projects</h3>
            <p>Active projects with logged hours will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {projects.map((p) => {
              const trend = TREND_STYLES[p.trend];
              const barColor =
                p.utilization > 100 ? "bg-danger" : p.utilization > 80 ? "bg-warning" : "bg-success";
              return (
                <div
                  key={p.project.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-card-hover transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium truncate">{p.project.name}</p>
                      <span className={`badge ${trend.bg} ${trend.text}`}>
                        {trend.label}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-4 text-[12px] text-muted">
                      <span className="tabular-nums font-medium text-foreground">{p.totalHours}h</span>
                      {p.budgetHours && (
                        <span className="tabular-nums">of {p.budgetHours}h budget</span>
                      )}
                      <span>{p.userCount} member{p.userCount !== 1 ? "s" : ""}</span>
                    </div>
                    {p.budgetHours && (
                      <div className="progress-track mt-2.5">
                        <div
                          className={`progress-fill ${barColor}`}
                          style={{ width: `${Math.min(p.utilization, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  {p.budgetHours && (
                    <span className="shrink-0 font-mono text-[14px] font-bold tabular-nums">
                      {p.utilization}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* User Workloads */}
      <div
        className="rounded-xl border border-border bg-card shadow-[var(--shadow-xs)] overflow-hidden animate-fade-in-up"
        style={{ animationDelay: "400ms" }}
      >
        <div className="border-b border-border px-5 py-3.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
            Team Workload — This Week
          </h3>
        </div>
        {workloads.length === 0 ? (
          <div className="empty-state">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
            </svg>
            <h3>No time entries this week</h3>
            <p>Team workload data will appear once time is logged.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header text-left">User</th>
                  <th className="table-header text-right">Weekly Hours</th>
                  <th className="table-header text-center">Projects</th>
                  <th className="table-header text-center">Status</th>
                  <th className="table-header text-left">Load</th>
                </tr>
              </thead>
              <tbody>
                {workloads.map((w) => {
                  const s = STATUS_STYLES[w.status];
                  const pct = Math.min((w.weeklyHours / 40) * 100, 100);
                  const barColor =
                    w.status === "overloaded"
                      ? "bg-danger"
                      : w.status === "heavy"
                        ? "bg-warning"
                        : w.status === "light"
                          ? "bg-primary"
                          : "bg-success";
                  return (
                    <tr key={w.userId}>
                      <td className="table-cell">
                        <span className="font-mono text-[12px] text-muted">{w.userId.slice(0, 8)}...</span>
                      </td>
                      <td className="table-cell text-right">
                        <span className="font-mono font-semibold tabular-nums">{w.weeklyHours}h</span>
                      </td>
                      <td className="table-cell text-center">
                        <span className="badge bg-surface-inset text-muted tabular-nums">
                          {w.projectCount}
                        </span>
                      </td>
                      <td className="table-cell text-center">
                        <span className={`badge ${s.bg} ${s.text}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="progress-track w-24">
                          <div
                            className={`progress-fill ${barColor}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
