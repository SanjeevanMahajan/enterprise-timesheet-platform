"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startTimer, pauseTimer, resumeTimer, stopTimer } from "@/lib/timelogs";
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
  const [billable, setBillable] = useState(true);
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

  // Tick the timer every second when running (not paused)
  useEffect(() => {
    if (activeLog && activeLog.timer_status === "running" && activeLog.timer_started_at) {
      intervalRef.current = setInterval(() => {
        const started = new Date(activeLog.timer_started_at!).getTime();
        const now = Date.now();
        const currentSegment = Math.floor((now - started) / 1000);
        setElapsed(activeLog.accumulated_seconds + currentSegment);
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
        billable,
      });
      setActiveLog(log);
      setElapsed(0);
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start timer");
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, selectedTaskId, description, billable]);

  const handlePause = useCallback(async () => {
    if (!activeLog) return;
    setError("");
    setLoading(true);
    try {
      const log = await pauseTimer(activeLog.id);
      if (intervalRef.current) clearInterval(intervalRef.current);
      setActiveLog(log);
      setElapsed(log.accumulated_seconds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pause timer");
    } finally {
      setLoading(false);
    }
  }, [activeLog]);

  const handleResume = useCallback(async () => {
    if (!activeLog) return;
    setError("");
    setLoading(true);
    try {
      const log = await resumeTimer(activeLog.id);
      setActiveLog(log);
      // elapsed will be recalculated by the interval effect
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resume timer");
    } finally {
      setLoading(false);
    }
  }, [activeLog]);

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

  const isActive = activeLog !== null;
  const isRunning = activeLog?.timer_status === "running";
  const isPaused = activeLog?.timer_status === "paused";
  const time = formatElapsed(elapsed);

  // Format elapsed as human-readable
  const elapsedHours = Math.floor(elapsed / 3600);
  const elapsedMins = Math.floor((elapsed % 3600) / 60);
  const elapsedLabel =
    elapsedHours > 0
      ? `${elapsedHours}h ${elapsedMins}m elapsed`
      : elapsedMins > 0
        ? `${elapsedMins}m elapsed`
        : isActive
          ? "Just started"
          : "";

  return (
    <div
      className={`rounded-xl border bg-card overflow-hidden transition-all duration-300 ${
        isRunning
          ? "border-primary/30 animate-timer-glow shadow-[var(--shadow-sm)]"
          : isPaused
            ? "border-warning/30 shadow-[var(--shadow-sm)]"
            : "border-border shadow-[var(--shadow-xs)]"
      }`}
    >
      {/* Status bar */}
      <div className="flex items-center justify-between px-5 pt-4 pb-0">
        <div className="flex items-center gap-2">
          {isRunning ? (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-success animate-live-pulse" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
          ) : isPaused ? (
            <span className="inline-flex h-2 w-2 rounded-full bg-warning" />
          ) : (
            <span className="inline-flex h-2 w-2 rounded-full bg-muted-foreground" />
          )}
          <span
            className={`text-[11px] font-semibold uppercase tracking-[0.06em] ${
              isRunning
                ? "text-success"
                : isPaused
                  ? "text-warning"
                  : "text-muted"
            }`}
          >
            {isRunning ? "Recording" : isPaused ? "Paused" : "Ready to track"}
          </span>
        </div>
        {isActive && (
          <span className="text-[11px] text-muted tabular-nums">
            {elapsedLabel}
          </span>
        )}
      </div>

      {/* Timer display */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-baseline justify-center gap-0.5">
          <span
            className={`font-mono text-[36px] font-bold tracking-[-0.02em] tabular-nums leading-none ${
              isActive ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {time.h}
          </span>
          <span
            className={`font-mono text-[36px] font-light leading-none ${
              isRunning
                ? "text-primary"
                : isPaused
                  ? "text-warning"
                  : "text-border"
            }`}
          >
            :
          </span>
          <span
            className={`font-mono text-[36px] font-bold tracking-[-0.02em] tabular-nums leading-none ${
              isActive ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {time.m}
          </span>
          <span
            className={`font-mono text-[36px] font-light leading-none ${
              isRunning
                ? "text-primary"
                : isPaused
                  ? "text-warning"
                  : "text-border"
            }`}
          >
            :
          </span>
          <span
            className={`font-mono text-[36px] font-bold tracking-[-0.02em] tabular-nums leading-none ${
              isRunning
                ? "text-primary"
                : isPaused
                  ? "text-warning"
                  : "text-muted-foreground"
            }`}
          >
            {time.s}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-border" />

      {/* Controls */}
      <div className="p-5 space-y-3">
        {error && (
          <div className="rounded-lg bg-danger-light border border-danger/15 px-3 py-2 text-[12px] font-medium text-danger">
            {error}
          </div>
        )}

        {!isActive ? (
          <>
            {/* Project selector */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                Project
              </label>
              <div className="relative">
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="input appearance-none pr-8"
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
                <svg
                  className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m19.5 8.25-7.5 7.5-7.5-7.5"
                  />
                </svg>
              </div>
            </div>

            {/* Task selector — appears when a project is selected */}
            {selectedProjectId && tasks.length > 0 && (
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                  Task{" "}
                  <span className="font-normal normal-case tracking-normal text-muted-foreground">
                    (optional)
                  </span>
                </label>
                <div className="relative">
                  <select
                    value={selectedTaskId}
                    onChange={(e) => setSelectedTaskId(e.target.value)}
                    className="input appearance-none pr-8"
                  >
                    <option value="">No task selected</option>
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                  <svg
                    className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m19.5 8.25-7.5 7.5-7.5-7.5"
                    />
                  </svg>
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What are you working on?"
                className="input"
              />
            </div>

            {/* Billable toggle */}
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted">Billable</span>
              <button
                type="button"
                role="switch"
                aria-checked={billable}
                onClick={() => setBillable(!billable)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                  billable ? "bg-primary" : "bg-border-strong"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-[var(--shadow-xs)] transition-transform duration-200 translate-y-0.5 ${
                    billable ? "translate-x-[18px]" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {/* No-projects hint */}
            {projects.length === 0 && !error && (
              <div className="rounded-lg bg-warning-light border border-warning/15 px-3 py-2 text-[12px] text-warning">
                No projects found.{" "}
                <a
                  href="/projects"
                  className="font-semibold underline underline-offset-2"
                >
                  Create a project
                </a>{" "}
                to start tracking time.
              </div>
            )}

            {/* Start button */}
            <button
              onClick={handleStart}
              disabled={loading || !selectedProjectId}
              className="btn btn-primary w-full py-2.5"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
                />
              </svg>
              {loading ? "Starting..." : "Start Timer"}
            </button>
          </>
        ) : (
          <>
            {/* Active session info */}
            <div className="rounded-lg bg-surface-inset px-3 py-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                  Project
                </span>
                <span className="text-[13px] font-medium text-foreground">
                  {projects.find((p) => p.id === activeLog.project_id)?.name ??
                    "Unknown"}
                </span>
              </div>
              {activeLog.task_id && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Task
                  </span>
                  <span className="text-[13px] font-medium text-foreground">
                    {tasks.find((t) => t.id === activeLog.task_id)?.title ??
                      "\u2014"}
                  </span>
                </div>
              )}
              {activeLog.description && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Note
                  </span>
                  <span className="text-[13px] text-foreground max-w-[180px] truncate">
                    {activeLog.description}
                  </span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              {isRunning ? (
                <button
                  onClick={handlePause}
                  disabled={loading}
                  className="btn btn-secondary flex-1 py-2.5"
                >
                  <svg
                    className="h-4 w-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                  {loading ? "Pausing..." : "Pause"}
                </button>
              ) : (
                <button
                  onClick={handleResume}
                  disabled={loading}
                  className="btn btn-primary flex-1 py-2.5"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
                    />
                  </svg>
                  {loading ? "Resuming..." : "Resume"}
                </button>
              )}

              <button
                onClick={handleStop}
                disabled={loading}
                className="btn btn-danger flex-1 py-2.5"
              >
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
                {loading ? "Stopping..." : "Stop"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
