"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listProjects, createProject } from "@/lib/projects";
import type { CreateProjectRequest, ProjectResponse } from "@/lib/types";

// ---------------------------------------------------------------------------
// Status badge styles matching backend ProjectStatus enum
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
// Toast notification
// ---------------------------------------------------------------------------
interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

let toastId = 0;

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-fade-in-up flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm ${
            t.type === "success"
              ? "border-success/20 bg-success-light text-success"
              : "border-danger/20 bg-danger-light text-danger"
          }`}
        >
          {t.type === "success" ? (
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          ) : (
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          )}
          <span className="text-[13px] font-medium">{t.message}</span>
          <button onClick={() => onDismiss(t.id)} className="ml-2 shrink-0 opacity-60 hover:opacity-100">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Project Slide-over
// ---------------------------------------------------------------------------
function CreateProjectPanel({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (project: ProjectResponse) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isBillable, setIsBillable] = useState(true);
  const [hourlyRate, setHourlyRate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  // Focus the name field when the panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => nameRef.current?.focus(), 150);
    }
  }, [open]);

  function resetForm() {
    setName("");
    setDescription("");
    setIsBillable(true);
    setHourlyRate("");
    setStartDate("");
    setEndDate("");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const payload: CreateProjectRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
        is_billable: isBillable,
        default_hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
        start_date: startDate || null,
        end_date: endDate || null,
      };
      const project = await createProject(payload);
      resetForm();
      onCreated(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-card border-l border-border shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">New Project</h2>
            <p className="text-[12px] text-muted mt-0.5">Fill in the details to create a project.</p>
          </div>
          <button
            onClick={() => { resetForm(); onClose(); }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-background hover:text-foreground"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex-1 space-y-4 p-6">
            {error && (
              <div className="rounded-lg bg-danger-light border border-danger/15 px-3 py-2 text-xs font-medium text-danger">
                {error}
              </div>
            )}

            {/* Name */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                Project Name <span className="text-danger">*</span>
              </label>
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Website Redesign"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[13px] outline-none transition-all duration-150 focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground"
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief project description..."
                rows={3}
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-[13px] outline-none transition-all duration-150 focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground"
              />
            </div>

            {/* Billable toggle + rate */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                  Billable
                </label>
                <button
                  type="button"
                  onClick={() => setIsBillable(!isBillable)}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                    isBillable ? "bg-primary" : "bg-border"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      isBillable ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                  Hourly Rate
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-border bg-background py-2.5 pl-7 pr-3 text-[13px] tabular-nums outline-none transition-all duration-150 focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground"
                  />
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[13px] outline-none transition-all duration-150 focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[13px] outline-none transition-all duration-150 focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border px-6 py-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => { resetForm(); onClose(); }}
              className="flex-1 rounded-lg border border-border px-4 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-background"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(99,102,241,0.3)] transition-all duration-150 hover:bg-primary-hover hover:shadow-[0_2px_8px_rgba(99,102,241,0.3)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating...
                </span>
              ) : (
                "Create Project"
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Projects Page
// ---------------------------------------------------------------------------
export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: Toast["type"], message: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchProjects = useCallback(() => {
    setLoading(true);
    listProjects()
      .then(setProjects)
      .catch((err) => addToast("error", err instanceof Error ? err.message : "Failed to load projects"))
      .finally(() => setLoading(false));
  }, [addToast]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  function handleCreated(project: ProjectResponse) {
    setPanelOpen(false);
    setProjects((prev) => [project, ...prev]);
    addToast("success", `Project "${project.name}" created successfully.`);
  }

  // Stats derived from projects
  const activeCount = projects.filter((p) => p.status === "active").length;
  const billableCount = projects.filter((p) => p.is_billable).length;

  return (
    <>
      {/* Page header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Projects</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            Manage your projects and track progress.
          </p>
        </div>
        <button
          onClick={() => setPanelOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(99,102,241,0.3)] transition-all duration-150 hover:bg-primary-hover hover:shadow-[0_2px_8px_rgba(99,102,241,0.3)] active:scale-[0.98]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Project
        </button>
      </div>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-3 gap-4">
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
            label: "Billable",
            value: String(billableCount),
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
              {loading ? "—" : card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Projects table */}
      <div className="animate-fade-in-up rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden" style={{ animationDelay: "240ms" }}>
        {/* Table header bar */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
            </svg>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
              All Projects
            </h3>
          </div>
          <span className="rounded-full bg-background px-2.5 py-0.5 text-[11px] font-semibold text-muted tabular-nums">
            {projects.length} {projects.length === 1 ? "project" : "projects"}
          </span>
        </div>

        {loading ? (
          <div className="px-6 py-16 text-center">
            <div className="inline-flex items-center gap-2 text-[13px] text-muted">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading projects...
            </div>
          </div>
        ) : projects.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-background">
              <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
              </svg>
            </div>
            <p className="mt-3 text-[13px] font-medium text-foreground">No projects yet</p>
            <p className="mt-1 text-xs text-muted">
              Click <strong>New Project</strong> above to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="px-6 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Name
                  </th>
                  <th className="px-6 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Status
                  </th>
                  <th className="px-6 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Billable
                  </th>
                  <th className="px-6 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Rate
                  </th>
                  <th className="px-6 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr
                    key={project.id}
                    className="border-b border-border-subtle last:border-0 transition-colors hover:bg-card-hover"
                  >
                    <td className="px-6 py-3.5">
                      <p className="text-[13px] font-medium">{project.name}</p>
                      {project.description && (
                        <p className="text-[11px] text-muted mt-0.5 truncate max-w-xs">
                          {project.description}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusBadge status={project.status} />
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {project.is_billable ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-success-light px-2 py-0.5 text-[11px] font-semibold text-success">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-background px-2 py-0.5 text-[11px] font-semibold text-muted">
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {project.default_hourly_rate != null ? (
                        <span className="text-[13px] font-medium tabular-nums text-success">
                          ${project.default_hourly_rate.toFixed(2)}/hr
                        </span>
                      ) : (
                        <span className="text-[13px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap text-[13px] text-muted">
                      {new Date(project.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create project slide-over */}
      <CreateProjectPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onCreated={handleCreated}
      />

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
