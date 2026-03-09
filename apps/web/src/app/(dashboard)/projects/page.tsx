"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listProjects, createProject } from "@/lib/projects";
import type { CreateProjectRequest, ProjectResponse } from "@/lib/types";

// ---------------------------------------------------------------------------
// Status badge config matching backend ProjectStatus enum
// ---------------------------------------------------------------------------
const STATUS_CONFIG: Record<string, { bg: string; dot: string; label: string }> = {
  active: { bg: "bg-success-light text-success", dot: "bg-success", label: "Active" },
  on_hold: { bg: "bg-warning-light text-warning", dot: "bg-warning", label: "On Hold" },
  completed: { bg: "bg-primary-light text-primary", dot: "bg-primary", label: "Completed" },
  archived: { bg: "bg-surface-inset text-muted", dot: "bg-muted-foreground", label: "Archived" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CONFIG[status] ?? STATUS_CONFIG.archived;
  return (
    <span className={`badge ${s.bg}`}>
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
          className={`animate-fade-in-up flex items-center gap-3 rounded-xl border px-4 py-3 shadow-[var(--shadow-lg)] backdrop-blur-sm ${
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
          <button onClick={() => onDismiss(t.id)} className="ml-2 shrink-0 opacity-60 hover:opacity-100 transition-opacity">
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
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col rounded-l-xl border-l border-border bg-card shadow-[var(--shadow-xl)] transition-transform duration-300 ease-out ${
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
            className="btn btn-ghost flex h-8 w-8 !p-0 items-center justify-center rounded-lg"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex-1 space-y-5 p-6">
            {error && (
              <div className="rounded-lg bg-danger-light border border-danger/15 px-3 py-2 text-[12px] font-medium text-danger">
                {error}
              </div>
            )}

            {/* Name */}
            <div>
              <label className="section-label mb-1.5 block">
                Project Name <span className="text-danger">*</span>
              </label>
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Website Redesign"
                className="input"
              />
            </div>

            {/* Description */}
            <div>
              <label className="section-label mb-1.5 block">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief project description..."
                rows={3}
                className="input resize-none"
              />
            </div>

            {/* Billable toggle + rate */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="section-label mb-1.5 block">
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
                <label className="section-label mb-1.5 block">
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
                    className="input !pl-7 tabular-nums"
                  />
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="section-label mb-1.5 block">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="section-label mb-1.5 block">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border px-6 py-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => { resetForm(); onClose(); }}
              className="btn btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary flex-1 font-semibold"
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
  const [search, setSearch] = useState("");

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

  // Client-side search filtering
  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, search]);

  return (
    <>
      {/* Page header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Projects</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            Manage your projects, track budgets, and monitor progress.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search input */}
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="input !w-[220px] !pl-9"
            />
          </div>
          <button
            onClick={() => setPanelOpen(true)}
            className="btn btn-primary font-semibold"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Project
          </button>
        </div>
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
            label: "Active Projects",
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
            label: "Billable Projects",
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
            className="animate-fade-in-up rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-xs)]"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                {card.label}
              </span>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.accentBg} ${card.accent}`}>
                {card.icon}
              </div>
            </div>
            <p className="stat-value mt-3">
              {loading ? "\u2014" : card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Projects table */}
      <div
        className="animate-fade-in-up rounded-xl border border-border bg-card shadow-[var(--shadow-xs)] overflow-hidden"
        style={{ animationDelay: "240ms" }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="inline-flex items-center gap-2 text-[13px] text-muted">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading projects...
            </div>
          </div>
        ) : filteredProjects.length === 0 && !search ? (
          <div className="empty-state">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
            </svg>
            <h3>No projects yet</h3>
            <p>
              Click <strong>New Project</strong> above to get started.
            </p>
          </div>
        ) : filteredProjects.length === 0 && search ? (
          <div className="empty-state">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <h3>No matching projects</h3>
            <p>
              No projects match &ldquo;{search}&rdquo;. Try a different search term.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header text-left">Project Name</th>
                  <th className="table-header text-left">Status</th>
                  <th className="table-header text-center">Billable</th>
                  <th className="table-header text-right">Rate</th>
                  <th className="table-header text-left">Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project, i) => {
                  const statusCfg = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.archived;
                  return (
                    <tr
                      key={project.id}
                      className="animate-fade-in-up"
                      style={{ animationDelay: `${300 + i * 40}ms` }}
                    >
                      <td className="table-cell">
                        <div className="flex items-center gap-2.5">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${statusCfg.dot}`} />
                          <div>
                            <p className="text-[13px] font-medium">{project.name}</p>
                            {project.description && (
                              <p className="text-[12px] text-muted mt-0.5 truncate max-w-xs">
                                {project.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <StatusBadge status={project.status} />
                      </td>
                      <td className="table-cell text-center">
                        {project.is_billable ? (
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-success-light text-success">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-surface-inset text-muted-foreground">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                          </span>
                        )}
                      </td>
                      <td className="table-cell text-right">
                        {project.default_hourly_rate != null ? (
                          <span className="text-[13px] font-medium tabular-nums">
                            ${project.default_hourly_rate.toFixed(2)}/hr
                          </span>
                        ) : (
                          <span className="text-[13px] text-muted-foreground">&mdash;</span>
                        )}
                      </td>
                      <td className="table-cell whitespace-nowrap text-muted">
                        {new Date(project.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  );
                })}
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
