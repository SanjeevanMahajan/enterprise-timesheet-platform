"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LiveTimer } from "@/components/live-timer";
import { TimeLogsTable } from "@/components/timelogs-table";
import { listTimeLogs } from "@/lib/timelogs";
import { listProjects } from "@/lib/projects";
import { getUserProfile } from "@/lib/auth";
import type { ProjectResponse, TimeLogResponse } from "@/lib/types";

/* ─────────────────────────── helpers ─────────────────────────── */

interface Stats {
  hoursToday: number;
  hoursYesterday: number;
  hoursThisWeek: number;
  billableAmount: number;
  totalHours: number;
  activeProjects: number;
}

function computeStats(
  logs: TimeLogResponse[],
  projectCount: number,
): Stats {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  const mondayStr = monday.toISOString().split("T")[0];

  let hoursToday = 0;
  let hoursYesterday = 0;
  let hoursThisWeek = 0;
  let billableAmount = 0;
  let totalHours = 0;

  for (const log of logs) {
    if (log.log_date === todayStr) hoursToday += log.hours;
    if (log.log_date === yesterdayStr) hoursYesterday += log.hours;
    if (log.log_date >= mondayStr) hoursThisWeek += log.hours;
    billableAmount += log.billable_amount;
    totalHours += log.hours;
  }

  return {
    hoursToday: Math.round(hoursToday * 100) / 100,
    hoursYesterday: Math.round(hoursYesterday * 100) / 100,
    hoursThisWeek: Math.round(hoursThisWeek * 100) / 100,
    billableAmount: Math.round(billableAmount * 100) / 100,
    totalHours: Math.round(totalHours * 100) / 100,
    activeProjects: projectCount,
  };
}

function formatH(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  if (hours === 0 && mins === 0) return "0h";
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/** Returns Mon-Sun hours for the current week from logs */
function weeklyBarData(logs: TimeLogResponse[]): { day: string; hours: number }[] {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const buckets: number[] = [0, 0, 0, 0, 0, 0, 0];

  for (const log of logs) {
    const d = new Date(log.log_date + "T00:00:00");
    const mondayTime = new Date(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate(),
    ).getTime();
    const diff = d.getTime() - mondayTime;
    const idx = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (idx >= 0 && idx < 7) {
      buckets[idx] += log.hours;
    }
  }

  return days.map((day, i) => ({
    day,
    hours: Math.round(buckets[i] * 100) / 100,
  }));
}

/* ─────────────────────────── component ─────────────────────────── */

export default function DashboardPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [logs, setLogs] = useState<TimeLogResponse[]>([]);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const profile = getUserProfile();
    if (profile?.full_name) {
      setUserName(profile.full_name.split(" ")[0]);
    }
  }, []);

  useEffect(() => {
    listTimeLogs()
      .then((data) => setLogs(data))
      .catch(() => {});
    listProjects()
      .then((data) => setProjects(data))
      .catch(() => {});
  }, [refreshKey]);

  const handleTimerStopped = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const stats = useMemo(
    () => computeStats(logs, projects.filter((p) => p.status === "active").length),
    [logs, projects],
  );

  const weekData = useMemo(() => weeklyBarData(logs), [logs]);
  const maxWeekHours = Math.max(...weekData.map((d) => d.hours), 1);

  const billableRatio =
    stats.totalHours > 0
      ? Math.round(
          (logs.filter((l) => l.billable).reduce((s, l) => s + l.hours, 0) /
            stats.totalHours) *
            100,
        )
      : 0;

  const todayTrend =
    stats.hoursYesterday > 0
      ? Math.round(
          ((stats.hoursToday - stats.hoursYesterday) / stats.hoursYesterday) *
            100,
        )
      : null;

  const weekTarget = 40;
  const weekPct = Math.min(
    Math.round((stats.hoursThisWeek / weekTarget) * 100),
    100,
  );

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  /* ─── stat card config ─── */
  const statCards = [
    {
      label: "Hours Today",
      value: formatH(stats.hoursToday),
      sub:
        todayTrend !== null ? (
          <span
            className={
              todayTrend >= 0 ? "text-success" : "text-danger"
            }
          >
            {todayTrend >= 0 ? "\u2191" : "\u2193"} {Math.abs(todayTrend)}%
            vs yesterday
          </span>
        ) : (
          <span className="text-muted-foreground">No data yesterday</span>
        ),
      icon: (
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
          />
        </svg>
      ),
      accent: "text-warning",
      accentBg: "bg-warning-light",
    },
    {
      label: "This Week",
      value: formatH(stats.hoursThisWeek),
      sub: (
        <div className="flex items-center gap-2 mt-0.5">
          <div className="progress-track flex-1">
            <div
              className="progress-fill bg-primary"
              style={{ width: `${weekPct}%` }}
            />
          </div>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {weekPct}%
          </span>
        </div>
      ),
      icon: (
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
          />
        </svg>
      ),
      accent: "text-primary",
      accentBg: "bg-primary-light",
    },
    {
      label: "Billable Total",
      value: `$${stats.billableAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
      sub: (
        <span className="text-muted-foreground">
          {billableRatio}% billable ratio
        </span>
      ),
      icon: (
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
      ),
      accent: "text-success",
      accentBg: "bg-success-light",
    },
    {
      label: "Active Projects",
      value: String(stats.activeProjects),
      sub: (
        <span className="text-muted-foreground">
          {projects.length} total
        </span>
      ),
      icon: (
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
          />
        </svg>
      ),
      accent: "text-info",
      accentBg: "bg-info-light",
    },
  ];

  return (
    <>
      {/* ── Page header ── */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
            {greeting}{userName ? `, ${userName}` : ""}
          </h1>
          <p className="mt-0.5 text-[13px] text-muted">{today}</p>
        </div>
      </div>

      {/* ── Row 1: Stat cards ── */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((card, i) => (
          <div
            key={card.label}
            className="animate-fade-in-up rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-xs)] transition-shadow hover:shadow-[var(--shadow-sm)]"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                {card.label}
              </span>
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-lg ${card.accentBg} ${card.accent}`}
              >
                {card.icon}
              </div>
            </div>
            <p className="text-[28px] font-bold tracking-[-0.03em] tabular-nums leading-none">
              {card.value}
            </p>
            <div className="mt-2 text-[12px]">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Row 2: Timer + Weekly Chart ── */}
      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        {/* Live Timer — hero */}
        <div
          className="animate-fade-in-up"
          style={{ animationDelay: "320ms" }}
        >
          <LiveTimer onTimerStopped={handleTimerStopped} />
        </div>

        {/* Weekly bar chart */}
        <div
          className="animate-fade-in-up rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-xs)] transition-shadow hover:shadow-[var(--shadow-sm)]"
          style={{ animationDelay: "400ms" }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
              This Week
            </span>
            <span className="text-[12px] text-muted tabular-nums">
              {formatH(stats.hoursThisWeek)} / {weekTarget}h target
            </span>
          </div>

          {/* Bar chart */}
          <div className="flex items-end gap-2 h-[160px]">
            {weekData.map((d, i) => {
              const pct =
                maxWeekHours > 0
                  ? Math.max((d.hours / maxWeekHours) * 100, d.hours > 0 ? 6 : 0)
                  : 0;
              const isToday = i === ((new Date().getDay() + 6) % 7);
              return (
                <div
                  key={d.day}
                  className="flex flex-1 flex-col items-center gap-1.5"
                >
                  {/* Hour label */}
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {d.hours > 0 ? formatH(d.hours) : ""}
                  </span>
                  {/* Bar */}
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className={`w-full rounded-t-md transition-all duration-500 ${
                        isToday
                          ? "bg-primary"
                          : d.hours > 0
                            ? "bg-primary/30"
                            : "bg-surface-inset"
                      }`}
                      style={{
                        height: `${pct}%`,
                        minHeight: "4px",
                      }}
                    />
                  </div>
                  {/* Day label */}
                  <span
                    className={`text-[11px] font-medium ${
                      isToday ? "text-primary" : "text-muted"
                    }`}
                  >
                    {d.day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Row 3: Recent Activity ── */}
      <div
        className="animate-fade-in-up"
        style={{ animationDelay: "480ms" }}
      >
        <TimeLogsTable refreshKey={refreshKey} />
      </div>
    </>
  );
}
