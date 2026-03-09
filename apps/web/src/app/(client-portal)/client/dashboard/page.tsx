"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import {
  getBillingStats,
  listInvoices,
  simulatePayment,
} from "@/lib/billing";
import type {
  BillingInvoice,
  BillingStats,
  ProjectResponse,
  TimeLogResponse,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Stat Card (matches main dashboard rounded-2xl card pattern)
// ---------------------------------------------------------------------------

const STAT_CARD_CONFIG = [
  {
    key: "activeProjects" as const,
    label: "Active Projects",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
      </svg>
    ),
    accent: "text-primary",
    accentBg: "bg-primary-light",
  },
  {
    key: "totalHoursThisMonth" as const,
    label: "Hours This Month",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
    accent: "text-success",
    accentBg: "bg-success-light",
  },
  {
    key: "outstandingInvoices" as const,
    label: "Outstanding Invoices",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
    ),
    accent: "text-warning",
    accentBg: "bg-warning-light",
  },
  {
    key: "totalBilled" as const,
    label: "Total Billed",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
    accent: "text-primary",
    accentBg: "bg-primary-light",
  },
];

interface DashboardStats {
  activeProjects: string;
  totalHoursThisMonth: string;
  outstandingInvoices: string;
  totalBilled: string;
}

function computeDashboardStats(
  projects: ProjectResponse[],
  timeLogs: TimeLogResponse[],
  invoices: BillingInvoice[],
  billingStats: BillingStats | null,
): DashboardStats {
  const activeCount = projects.filter((p) => p.status === "active").length;

  // Hours this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  let monthHours = 0;
  for (const log of timeLogs) {
    if (log.log_date >= monthStart) {
      monthHours += log.hours;
    }
  }

  const unpaidCount = invoices.filter((i) => i.status !== "paid").length;

  const totalBilled = billingStats
    ? billingStats.total_invoiced
    : invoices.reduce((sum, inv) => sum + inv.total, 0);

  return {
    activeProjects: String(activeCount),
    totalHoursThisMonth: `${Math.round(monthHours * 10) / 10}h`,
    outstandingInvoices: String(unpaidCount),
    totalBilled: `$${totalBilled.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ClientDashboardPage() {
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLogResponse[]>([]);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [billingStats, setBillingStats] = useState<BillingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);

  const paid = searchParams.get("paid") === "true";
  const cancelled = searchParams.get("cancelled") === "true";

  useEffect(() => {
    async function load() {
      try {
        const [p, tl, inv, st] = await Promise.all([
          apiClient.get<ProjectResponse[]>("/projects"),
          apiClient.get<TimeLogResponse[]>("/timelogs?limit=20"),
          listInvoices(),
          getBillingStats(),
        ]);
        setProjects(p);
        setTimeLogs(tl);
        setInvoices(inv);
        setBillingStats(st);
      } catch (err) {
        console.error("Failed to load client dashboard data", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function projectName(id: string): string {
    return projects.find((p) => p.id === id)?.name ?? id.slice(0, 8);
  }

  async function handlePay(invoice: BillingInvoice) {
    if (invoice.payment_url) {
      window.location.href = invoice.payment_url;
      return;
    }
    setPayingId(invoice.id);
    try {
      const updated = await simulatePayment(invoice.id);
      setInvoices((prev) =>
        prev.map((i) => (i.id === updated.id ? updated : i))
      );
      const newStats = await getBillingStats();
      setBillingStats(newStats);
    } finally {
      setPayingId(null);
    }
  }

  const unpaidInvoices = invoices.filter((i) => i.status !== "paid");

  const dashStats = computeDashboardStats(projects, timeLogs, invoices, billingStats);

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
          Client Dashboard
        </h1>
        <p className="mt-0.5 text-[13px] text-muted">
          View recent work on your projects and manage invoices.
        </p>
      </div>

      {/* Flash messages from Stripe redirect */}
      {paid && (
        <div className="rounded-lg border border-success/30 bg-success-light px-4 py-3 text-[13px] text-success">
          Payment successful! Thank you.
        </div>
      )}
      {cancelled && (
        <div className="rounded-lg border border-warning/30 bg-warning-light px-4 py-3 text-[13px] text-warning">
          Payment was cancelled. You can try again anytime.
        </div>
      )}

      {/* Summary stats row — matches main dashboard rounded-2xl card design */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STAT_CARD_CONFIG.map((card, i) => (
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
              {dashStats[card.key]}
            </p>
          </div>
        ))}
      </div>

      {/* Recent Activity Feed */}
      <div
        className="animate-fade-in-up rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden"
        style={{ animationDelay: "320ms" }}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
              Recent Activity
            </h3>
          </div>
          <span className="rounded-full bg-background px-2.5 py-0.5 text-[11px] font-semibold text-muted tabular-nums">
            {timeLogs.length} {timeLogs.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        {timeLogs.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-background">
              <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <p className="mt-3 text-[13px] font-medium text-foreground">No time entries yet</p>
            <p className="mt-1 text-xs text-muted">
              Time entries on your projects will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="px-6 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Date
                  </th>
                  <th className="px-6 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Project
                  </th>
                  <th className="px-6 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Description
                  </th>
                  <th className="px-6 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Hours
                  </th>
                  <th className="px-6 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Amount
                  </th>
                  <th className="px-6 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Category
                  </th>
                </tr>
              </thead>
              <tbody>
                {timeLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-border-subtle last:border-0 hover:bg-card-hover transition-colors"
                  >
                    <td className="px-6 py-3.5 whitespace-nowrap text-[13px] text-muted">
                      {new Date(log.log_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-3.5 text-[13px] font-medium">
                      {projectName(log.project_id)}
                    </td>
                    <td className="px-6 py-3.5 text-[13px] text-muted max-w-[280px] truncate">
                      {log.description || "\u2014"}
                    </td>
                    <td className="px-6 py-3.5 text-right text-[13px] font-mono tabular-nums">
                      {log.hours.toFixed(1)}
                    </td>
                    <td className="px-6 py-3.5 text-right text-[13px] font-mono tabular-nums">
                      ${log.billable_amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-3.5">
                      {log.ai_category ? (
                        <span className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          {log.ai_category}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">\u2014</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Outstanding Invoices */}
      <div
        className="animate-fade-in-up rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden"
        style={{ animationDelay: "400ms" }}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-warning" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
              Outstanding Invoices
            </h3>
          </div>
          <span className="rounded-full bg-warning-light px-2.5 py-0.5 text-[11px] font-semibold text-warning tabular-nums">
            {unpaidInvoices.length} {unpaidInvoices.length === 1 ? "invoice" : "invoices"}
          </span>
        </div>

        {unpaidInvoices.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-success-light">
              <svg className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <p className="mt-3 text-[13px] font-medium text-foreground">All caught up</p>
            <p className="mt-1 text-xs text-muted">
              No outstanding invoices. You&apos;re all caught up!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="px-6 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Invoice
                  </th>
                  <th className="px-6 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Date
                  </th>
                  <th className="px-6 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Items
                  </th>
                  <th className="px-6 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Total
                  </th>
                  <th className="px-6 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Status
                  </th>
                  <th className="px-6 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {unpaidInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-border-subtle last:border-0 hover:bg-card-hover transition-colors"
                  >
                    <td className="px-6 py-3.5">
                      <span className="font-mono text-[12px] text-muted">
                        {inv.id.slice(0, 8)}...
                      </span>
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap text-[13px] text-muted">
                      {new Date(inv.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold text-muted tabular-nums">
                        {inv.line_item_count}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <span className="text-[14px] font-semibold tabular-nums text-foreground">
                        ${inv.total.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-warning-light text-warning capitalize">
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        onClick={() => handlePay(inv)}
                        disabled={payingId === inv.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-white shadow-[0_1px_2px_rgba(99,102,241,0.3)] transition-all duration-150 hover:bg-primary-hover hover:shadow-[0_2px_8px_rgba(99,102,241,0.3)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {payingId === inv.id ? (
                          "Processing\u2026"
                        ) : (
                          <>
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
                            </svg>
                            Pay Now
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
