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
        {[
          { label: "Active Projects", value: String(projects.length), accent: "text-primary", accentBg: "bg-primary-light" },
          { label: "Total Hours", value: `${totalActiveHours.toFixed(0)}h`, accent: "text-success", accentBg: "bg-success-light" },
          { label: "At-Risk Projects", value: String(atRiskProjects), accent: "text-warning", accentBg: "bg-warning-light" },
          { label: "Overloaded Users", value: String(overloadedCount), accent: "text-danger", accentBg: "bg-danger-light" },
        ].map((card, i) => (
          <div
            key={card.label}
            className="animate-fade-in-up rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              {card.label}
            </span>
            <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Project Capacity */}
      <div className="mb-8 rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden animate-fade-in-up" style={{ animationDelay: "320ms" }}>
        <div className="border-b border-border px-6 py-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            Project Capacity
          </h3>
        </div>
        {projects.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-muted">
            No active projects found.
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {projects.map((p) => {
              const trend = TREND_STYLES[p.trend];
              return (
                <div key={p.project.id} className="flex items-center gap-4 px-6 py-4 hover:bg-card-hover transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium truncate">{p.project.name}</p>
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${trend.bg} ${trend.text}`}>
                        {trend.label}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-[11px] text-muted">
                      <span className="tabular-nums font-medium text-foreground">{p.totalHours}h</span>
                      {p.budgetHours && (
                        <span className="tabular-nums">of {p.budgetHours}h budget</span>
                      )}
                      <span>{p.userCount} team member{p.userCount !== 1 ? "s" : ""}</span>
                    </div>
                    {p.budgetHours && (
                      <div className="mt-2 h-1.5 rounded-full bg-background overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            p.utilization > 100 ? "bg-danger" : p.utilization > 80 ? "bg-warning" : "bg-success"
                          }`}
                          style={{ width: `${Math.min(p.utilization, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  {p.budgetHours && (
                    <span className="shrink-0 text-[14px] font-bold tabular-nums">
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
      <div className="rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden animate-fade-in-up" style={{ animationDelay: "400ms" }}>
        <div className="border-b border-border px-6 py-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            Team Workload — This Week
          </h3>
        </div>
        {workloads.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-muted">
            No time entries this week yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="px-6 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">User</th>
                  <th className="px-6 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Weekly Hours</th>
                  <th className="px-6 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Projects</th>
                  <th className="px-6 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Capacity</th>
                  <th className="px-6 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Load</th>
                </tr>
              </thead>
              <tbody>
                {workloads.map((w) => {
                  const s = STATUS_STYLES[w.status];
                  const pct = Math.min((w.weeklyHours / 40) * 100, 100);
                  return (
                    <tr key={w.userId} className="border-b border-border-subtle last:border-0 hover:bg-card-hover transition-colors">
                      <td className="px-6 py-3.5">
                        <span className="font-mono text-[12px] text-muted">{w.userId.slice(0, 8)}…</span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <span className="text-[13px] font-semibold tabular-nums">{w.weeklyHours}h</span>
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold text-muted tabular-nums">
                          {w.projectCount}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${s.bg} ${s.text}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="h-1.5 w-24 rounded-full bg-background overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              w.status === "overloaded" ? "bg-danger" :
                              w.status === "heavy" ? "bg-warning" :
                              w.status === "light" ? "bg-primary" : "bg-success"
                            }`}
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
