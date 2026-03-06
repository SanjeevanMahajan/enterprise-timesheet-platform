"use client";

import { useCallback, useEffect, useState } from "react";
import { LiveTimer } from "@/components/live-timer";
import { TimeLogsTable } from "@/components/timelogs-table";
import { listTimeLogs } from "@/lib/timelogs";
import type { TimeLogResponse } from "@/lib/types";

interface Stats {
  hoursToday: number;
  hoursThisWeek: number;
  billableAmount: number;
  totalEntries: number;
}

function computeStats(logs: TimeLogResponse[]): Stats {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  const mondayStr = monday.toISOString().split("T")[0];

  let hoursToday = 0;
  let hoursThisWeek = 0;
  let billableAmount = 0;

  for (const log of logs) {
    if (log.log_date === todayStr) hoursToday += log.hours;
    if (log.log_date >= mondayStr) hoursThisWeek += log.hours;
    billableAmount += log.billable_amount;
  }

  return {
    hoursToday: Math.round(hoursToday * 100) / 100,
    hoursThisWeek: Math.round(hoursThisWeek * 100) / 100,
    billableAmount: Math.round(billableAmount * 100) / 100,
    totalEntries: logs.length,
  };
}

function formatHoursDisplay(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  if (hours === 0 && mins === 0) return "0h";
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

const STAT_CARDS = [
  {
    key: "hoursToday",
    label: "Hours Today",
    format: (v: number) => formatHoursDisplay(v),
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
      </svg>
    ),
    accent: "text-warning",
    accentBg: "bg-warning-light",
  },
  {
    key: "hoursThisWeek",
    label: "This Week",
    format: (v: number) => formatHoursDisplay(v),
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
    accent: "text-primary",
    accentBg: "bg-primary-light",
  },
  {
    key: "billableAmount",
    label: "Billable Total",
    format: (v: number) => `$${v.toFixed(2)}`,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
    accent: "text-success",
    accentBg: "bg-success-light",
  },
  {
    key: "totalEntries",
    label: "Total Entries",
    format: (v: number) => String(v),
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
      </svg>
    ),
    accent: "text-muted",
    accentBg: "bg-background",
  },
];

export default function DashboardPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    listTimeLogs()
      .then((logs) => setStats(computeStats(logs)))
      .catch(() => {});
  }, [refreshKey]);

  const handleTimerStopped = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
          {greeting}
        </h1>
        <p className="mt-0.5 text-[13px] text-muted">
          {today}
        </p>
      </div>

      {/* Stats row */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STAT_CARDS.map((card, i) => (
          <div
            key={card.key}
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
              {stats
                ? card.format(stats[card.key as keyof Stats] as number)
                : "—"}
            </p>
          </div>
        ))}
      </div>

      {/* Timer + Activity */}
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="animate-fade-in-up" style={{ animationDelay: "320ms" }}>
          <LiveTimer onTimerStopped={handleTimerStopped} />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "400ms" }}>
          <TimeLogsTable refreshKey={refreshKey} />
        </div>
      </div>
    </>
  );
}
