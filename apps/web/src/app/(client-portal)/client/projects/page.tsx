"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { ProjectResponse, TimeLogResponse } from "@/lib/types";

// ---------------------------------------------------------------------------
// Status badge (reused from main projects page pattern)
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-success-light", text: "text-success", label: "Active" },
  on_hold: { bg: "bg-warning-light", text: "text-warning", label: "On Hold" },
  completed: { bg: "bg-primary-light", text: "text-primary", label: "Completed" },
  archived: { bg: "bg-background", text: "text-muted-foreground", label: "Archived" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.archived;
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ProjectWithStats extends ProjectResponse {
  totalHours: number;
  totalCost: number;
}

function computeProjectStats(
  projects: ProjectResponse[],
  timeLogs: TimeLogResponse[],
): ProjectWithStats[] {
  const hoursByProject: Record<string, number> = {};
  const costByProject: Record<string, number> = {};

  for (const log of timeLogs) {
    hoursByProject[log.project_id] = (hoursByProject[log.project_id] ?? 0) + log.hours;
    costByProject[log.project_id] = (costByProject[log.project_id] ?? 0) + log.billable_amount;
  }

  return projects.map((p) => ({
    ...p,
    totalHours: Math.round((hoursByProject[p.id] ?? 0) * 10) / 10,
    totalCost: Math.round((costByProject[p.id] ?? 0) * 100) / 100,
  }));
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ClientProjectsPage() {
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [p, tl] = await Promise.all([
          apiClient.get<ProjectResponse[]>("/projects"),
          apiClient.get<TimeLogResponse[]>("/timelogs?limit=500"),
        ]);
        setProjects(computeProjectStats(p, tl));
      } catch (err) {
        console.error("Failed to load client projects", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const activeCount = projects.filter((p) => p.status === "active").length;
  const totalHours = projects.reduce((s, p) => s + p.totalHours, 0);
  const totalCost = projects.reduce((s, p) => s + p.totalCost, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
          My Projects
        </h1>
        <p className="mt-0.5 text-[13px] text-muted">
          Projects assigned to your account with time and cost summaries.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Total Projects",
            value: String(projects.length),
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
              </svg>
            ),
            accent: "text-primary",
            accentBg: "bg-primary-light",
          },
          {
            label: "Active",
            value: String(activeCount),
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
              </svg>
            ),
            accent: "text-success",
            accentBg: "bg-success-light",
          },
          {
            label: "Total Cost",
            value: `$${totalCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
            icon: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            ),
            accent: "text-warning",
            accentBg: "bg-warning-light",
          },
        ].map((card, i) => (
          <div
            key={card.label}
            className="animate-fade-in-up rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                {card.label}
              </span>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.accentBg} ${card.accent}`}>
                {card.icon}
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Project cards */}
      {projects.length === 0 ? (
        <div className="animate-fade-in-up rounded-2xl border border-border bg-card p-16 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]" style={{ animationDelay: "240ms" }}>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-background">
            <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
            </svg>
          </div>
          <p className="mt-3 text-[13px] font-medium text-foreground">No projects assigned</p>
          <p className="mt-1 text-xs text-muted">
            Projects assigned to your account will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((project, i) => (
            <div
              key={project.id}
              className="animate-fade-in-up rounded-2xl border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]"
              style={{ animationDelay: `${240 + i * 60}ms` }}
            >
              {/* Project header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-semibold tracking-[-0.01em] truncate">
                    {project.name}
                  </h3>
                  {project.description && (
                    <p className="mt-1 text-[12px] text-muted line-clamp-2">
                      {project.description}
                    </p>
                  )}
                </div>
                <StatusBadge status={project.status} />
              </div>

              {/* Stats grid */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-background px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                    Total Hours
                  </p>
                  <p className="mt-1 text-[16px] font-bold tabular-nums tracking-tight">
                    {project.totalHours}h
                  </p>
                </div>
                <div className="rounded-lg bg-background px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                    Total Cost
                  </p>
                  <p className="mt-1 text-[16px] font-bold tabular-nums tracking-tight text-success">
                    ${project.totalCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Footer meta */}
              <div className="mt-4 flex items-center gap-3 text-[11px] text-muted">
                {project.is_billable && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-success-light px-2 py-0.5 text-[11px] font-semibold text-success">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    Billable
                  </span>
                )}
                {project.default_hourly_rate != null && (
                  <span className="tabular-nums">
                    ${project.default_hourly_rate.toFixed(2)}/hr
                  </span>
                )}
                {project.start_date && (
                  <span>
                    Started {new Date(project.start_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
