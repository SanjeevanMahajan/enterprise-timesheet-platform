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

export default function ClientDashboardPage() {
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLogResponse[]>([]);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [stats, setStats] = useState<BillingStats | null>(null);
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
        setStats(st);
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
    } finally {
      setPayingId(null);
    }
  }

  const unpaidInvoices = invoices.filter((i) => i.status !== "paid");
  const paidInvoices = invoices.filter((i) => i.status === "paid");

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
        <h1 className="text-2xl font-semibold tracking-tight">
          Client Dashboard
        </h1>
        <p className="mt-1 text-[14px] text-muted">
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

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Active Projects"
            value={projects.length.toString()}
            accent="primary"
          />
          <StatCard
            label="Outstanding"
            value={`$${(stats.total_invoiced - stats.total_paid).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            accent="warning"
          />
          <StatCard
            label="Total Paid"
            value={`$${stats.total_paid.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            accent="success"
          />
        </div>
      )}

      {/* Recent Work */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Recent Work</h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {timeLogs.length === 0 ? (
            <div className="px-6 py-10 text-center text-[13px] text-muted">
              No time entries found for your projects yet.
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-background/50 text-left text-muted">
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Project</th>
                  <th className="px-4 py-2.5 font-medium">Description</th>
                  <th className="px-4 py-2.5 font-medium text-right">Hours</th>
                  <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                </tr>
              </thead>
              <tbody>
                {timeLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-border-subtle last:border-0 hover:bg-card-hover transition-colors"
                  >
                    <td className="px-4 py-3 text-muted whitespace-nowrap">
                      {new Date(log.log_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {projectName(log.project_id)}
                    </td>
                    <td className="px-4 py-3 text-muted max-w-[280px] truncate">
                      {log.description || "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {log.hours.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      ${log.billable_amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      {log.ai_category ? (
                        <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          {log.ai_category}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Outstanding Invoices */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Outstanding Invoices</h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {unpaidInvoices.length === 0 ? (
            <div className="px-6 py-10 text-center text-[13px] text-muted">
              No outstanding invoices. You&apos;re all caught up!
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-background/50 text-left text-muted">
                  <th className="px-4 py-2.5 font-medium">Invoice</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium text-right">Items</th>
                  <th className="px-4 py-2.5 font-medium text-right">Total</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {unpaidInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-border-subtle last:border-0 hover:bg-card-hover transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-[12px]">
                      {inv.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap">
                      {new Date(inv.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">{inv.line_item_count}</td>
                    <td className="px-4 py-3 text-right font-semibold font-mono tabular-nums">
                      ${inv.total.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning capitalize">
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handlePay(inv)}
                        disabled={payingId === inv.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                      >
                        {payingId === inv.id ? (
                          "Processing…"
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
          )}
        </div>
      </section>

      {/* Payment History */}
      {paidInvoices.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Payment History</h2>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-background/50 text-left text-muted">
                  <th className="px-4 py-2.5 font-medium">Invoice</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium text-right">Total</th>
                  <th className="px-4 py-2.5 font-medium">Paid</th>
                </tr>
              </thead>
              <tbody>
                {paidInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-border-subtle last:border-0"
                  >
                    <td className="px-4 py-3 font-mono text-[12px]">
                      {inv.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap">
                      {new Date(inv.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      ${inv.total.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-success">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        {inv.paid_at
                          ? new Date(inv.paid_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })
                          : "Paid"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "primary" | "warning" | "success";
}) {
  const colors = {
    primary: "bg-primary-light text-primary",
    warning: "bg-warning-light text-warning",
    success: "bg-success-light text-success",
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-[12px] font-medium text-muted uppercase tracking-wide">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${colors[accent].split(" ")[1]}`}>
        {value}
      </p>
    </div>
  );
}
