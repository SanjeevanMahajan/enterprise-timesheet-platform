"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startTimer, stopTimer } from "@/lib/timelogs";
import { listProjects } from "@/lib/projects";
import { listTasks } from "@/lib/tasks";
import type { ProjectResponse, TaskResponse, TimeLogResponse } from "@/lib/types";

function formatElapsed(seconds: number): { h: string; m: string; s: string } {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return {
    h: String(h).padStart(2, "0"),
    m: String(m).padStart(2, "0"),
    s: String(s).padStart(2, "0"),
  };
}

export function LiveTimer({
  onTimerStopped,
}: {
  onTimerStopped?: (log: TimeLogResponse) => void;
}) {
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [description, setDescription] = useState("");
  const [activeLog, setActiveLog] = useState<TimeLogResponse | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load projects on mount
  useEffect(() => {
    listProjects()
      .then((p) => {
        setProjects(p);
        if (p.length > 0 && !selectedProjectId) {
          setSelectedProjectId(p[0].id);
        }
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load projects"),
      );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load tasks when project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setTasks([]);
      return;
    }
    listTasks(selectedProjectId)
      .then((t) => {
        setTasks(t);
        setSelectedTaskId("");
      })
      .catch(() => setTasks([]));
  }, [selectedProjectId]);

  // Tick the timer every second when active
  useEffect(() => {
    if (activeLog) {
      intervalRef.current = setInterval(() => {
        const started = new Date(activeLog.timer_started_at!).getTime();
        const now = Date.now();
        setElapsed(Math.floor((now - started) / 1000));
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeLog]);

  const handleStart = useCallback(async () => {
    if (!selectedProjectId) return;
    setError("");
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const log = await startTimer({
        project_id: selectedProjectId,
        task_id: selectedTaskId || null,
        log_date: today,
        description,
      });
      setActiveLog(log);
      setElapsed(0);
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start timer");
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, selectedTaskId, description]);

  const handleStop = useCallback(async () => {
    if (!activeLog) return;
    setError("");
    setLoading(true);
    try {
      const log = await stopTimer(activeLog.id);
      if (intervalRef.current) clearInterval(intervalRef.current);
      setActiveLog(null);
      setElapsed(0);
      onTimerStopped?.(log);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop timer");
    } finally {
      setLoading(false);
    }
  }, [activeLog, onTimerStopped]);

  const isRunning = activeLog !== null;
  const time = formatElapsed(elapsed);

  return (
    <div
      className={`rounded-2xl border bg-card overflow-hidden transition-all duration-300 ${
        isRunning
          ? "border-primary/30 animate-timer-glow"
          : "border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      }`}
    >
      {/* Timer header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-1">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            Timer
          </span>
        </div>
        {isRunning && (
          <span className="flex items-center gap-1.5 rounded-full bg-primary-light px-2.5 py-1 text-[11px] font-semibold text-primary uppercase tracking-wide">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-primary animate-live-pulse" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            Live
          </span>
        )}
      </div>

      {/* Timer display — clean sans-serif numbers */}
      <div className="px-6 py-6">
        <div className="flex items-baseline justify-center">
          <span className={`text-[52px] font-bold leading-none tracking-tight tabular-nums ${isRunning ? "text-foreground" : "text-muted-foreground"}`}>
            {time.h}
          </span>
          <span className={`text-[52px] font-light leading-none mx-0.5 ${isRunning ? "text-primary" : "text-border"}`}>:</span>
          <span className={`text-[52px] font-bold leading-none tracking-tight tabular-nums ${isRunning ? "text-foreground" : "text-muted-foreground"}`}>
            {time.m}
          </span>
          <span className={`text-[52px] font-light leading-none mx-0.5 ${isRunning ? "text-primary" : "text-border"}`}>:</span>
          <span className={`text-[52px] font-bold leading-none tracking-tight tabular-nums ${isRunning ? "text-primary" : "text-muted-foreground"}`}>
            {time.s}
          </span>
        </div>
        <p className="mt-2 text-center text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
          {isRunning ? "Elapsed time" : "Ready to track"}
        </p>
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-border" />

      {/* Controls */}
      <div className="p-5">
        {error && (
          <div className="mb-3 rounded-lg bg-danger-light border border-danger/15 px-3 py-2 text-xs font-medium text-danger">
            {error}
          </div>
        )}

        {!isRunning ? (
          <div className="space-y-2.5">
            {/* Project selector */}
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                Project
              </label>
              <div className="relative">
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 pr-8 text-[13px] outline-none transition-all duration-150 focus:border-primary focus:ring-2 focus:ring-primary/10"
                >
                  {projects.length === 0 && (
                    <option value="">Create a project first</option>
                  )}
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <svg className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>

            {/* Task selector */}
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                Task <span className="font-normal normal-case tracking-normal text-muted-foreground">(optional)</span>
              </label>
              <div className="relative">
                <select
                  value={selectedTaskId}
                  onChange={(e) => setSelectedTaskId(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 pr-8 text-[13px] outline-none transition-all duration-150 focus:border-primary focus:ring-2 focus:ring-primary/10"
                >
                  <option value="">No task selected</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
                <svg className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What are you working on?"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none transition-all duration-150 focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground"
              />
            </div>

            {/* No-projects hint */}
            {projects.length === 0 && !error && (
              <div className="rounded-lg bg-warning-light border border-warning/15 px-3 py-2 text-xs text-warning">
                No projects found. <a href="/projects" className="font-semibold underline underline-offset-2">Create a project</a> to start tracking time.
              </div>
            )}

            {/* Start button */}
            <button
              onClick={handleStart}
              disabled={loading || !selectedProjectId}
              className="group w-full rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(99,102,241,0.3)] transition-all duration-150 hover:bg-primary-hover hover:shadow-[0_2px_8px_rgba(99,102,241,0.3)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                </svg>
                {loading ? "Starting..." : "Start Timer"}
              </span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="rounded-lg bg-primary-light/60 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-primary/70 mb-0.5">
                Project
              </p>
              <p className="text-[13px] font-medium text-foreground">
                {projects.find((p) => p.id === activeLog.project_id)?.name ?? "Unknown"}
              </p>
            </div>

            {activeLog.task_id && (
              <div className="rounded-lg bg-background px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted mb-0.5">
                  Task
                </p>
                <p className="text-[13px] font-medium text-foreground">
                  {tasks.find((t) => t.id === activeLog.task_id)?.title ?? "—"}
                </p>
              </div>
            )}

            {activeLog.description && (
              <div className="rounded-lg bg-background px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted mb-0.5">
                  Description
                </p>
                <p className="text-[13px] font-medium text-foreground">
                  {activeLog.description}
                </p>
              </div>
            )}

            <button
              onClick={handleStop}
              disabled={loading}
              className="w-full rounded-lg bg-danger px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(239,68,68,0.3)] transition-all duration-150 hover:bg-danger/90 hover:shadow-[0_2px_8px_rgba(239,68,68,0.25)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
                {loading ? "Stopping..." : "Stop Timer"}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
