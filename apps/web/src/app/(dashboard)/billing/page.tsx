"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getBillingStats,
  listInvoices,
  listFlaggedItems,
  approveLineItem,
} from "@/lib/billing";
import type { BillingStats, BillingInvoice, BillingLineItem } from "@/lib/types";

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const INVOICE_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: "bg-warning-light", text: "text-warning", label: "Draft" },
  sent: { bg: "bg-primary-light", text: "text-primary", label: "Sent" },
  paid: { bg: "bg-success-light", text: "text-success", label: "Paid" },
};

function InvoiceStatusBadge({ status }: { status: string }) {
  const s = INVOICE_STATUS_STYLES[status] ?? { bg: "bg-background", text: "text-muted", label: status };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Toast
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
// Billing Page
// ---------------------------------------------------------------------------

export default function BillingPage() {
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [flagged, setFlagged] = useState<BillingLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: Toast["type"], message: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, inv, fl] = await Promise.all([
        getBillingStats(),
        listInvoices(),
        listFlaggedItems(),
      ]);
      setStats(s);
      setInvoices(inv);
      setFlagged(fl);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to load billing data");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function handleApprove(item: BillingLineItem) {
    setApproving(item.id);
    try {
      await approveLineItem(item.id);
      setFlagged((prev) => prev.filter((f) => f.id !== item.id));
      // Refresh stats since counts changed
      const newStats = await getBillingStats();
      setStats(newStats);
      // Also refresh invoices in case approval triggered invoice generation
      const newInvoices = await listInvoices();
      setInvoices(newInvoices);
      addToast("success", "Entry approved for billing.");
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setApproving(null);
    }
  }

  const formatCurrency = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  // ---------------------------------------------------------------------------
  // Stats cards config
  // ---------------------------------------------------------------------------

  const STAT_CARDS = [
    {
      label: "Total Invoiced",
      value: stats ? formatCurrency(stats.total_invoiced) : "—",
      sub: stats ? `${stats.invoice_count} invoice${stats.invoice_count !== 1 ? "s" : ""}` : "",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
        </svg>
      ),
      accent: "text-success",
      accentBg: "bg-success-light",
    },
    {
      label: "Awaiting Approval",
      value: stats ? String(stats.awaiting_review_count) : "—",
      sub: stats ? formatCurrency(stats.awaiting_review_amount) : "",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      ),
      accent: "text-warning",
      accentBg: "bg-warning-light",
    },
    {
      label: "Ready to Bill",
      value: stats ? String(stats.ready_to_bill_count) : "—",
      sub: stats ? formatCurrency(stats.ready_to_bill_amount) : "",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
      accent: "text-primary",
      accentBg: "bg-primary-light",
    },
  ];

  return (
    <>
      {/* Page header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Billing</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            Invoices, revenue tracking, and AI-flagged entry review.
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-card-hover disabled:opacity-50"
        >
          <svg className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {STAT_CARDS.map((card, i) => (
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
            {card.sub && !loading && (
              <p className="mt-0.5 text-[11px] text-muted tabular-nums">{card.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* Invoices table */}
      <div
        className="animate-fade-in-up mb-6 rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden"
        style={{ animationDelay: "240ms" }}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
              Invoices
            </h3>
          </div>
          <span className="rounded-full bg-background px-2.5 py-0.5 text-[11px] font-semibold text-muted tabular-nums">
            {invoices.length} {invoices.length === 1 ? "invoice" : "invoices"}
          </span>
        </div>

        {loading ? (
          <div className="px-6 py-16 text-center">
            <div className="inline-flex items-center gap-2 text-[13px] text-muted">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading invoices...
            </div>
          </div>
        ) : invoices.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-background">
              <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <p className="mt-3 text-[13px] font-medium text-foreground">No invoices yet</p>
            <p className="mt-1 text-xs text-muted">
              Invoices are generated automatically when 3+ billable entries are ready.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="px-6 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Invoice ID
                  </th>
                  <th className="px-6 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Date
                  </th>
                  <th className="px-6 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Items
                  </th>
                  <th className="px-6 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Amount
                  </th>
                  <th className="px-6 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-border-subtle last:border-0 transition-colors hover:bg-card-hover"
                  >
                    <td className="px-6 py-3.5">
                      <span className="font-mono text-[12px] text-muted">
                        {inv.id.slice(0, 8)}...
                      </span>
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap text-[13px] text-muted">
                      {formatDate(inv.created_at)}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold text-muted tabular-nums">
                        {inv.line_item_count}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <span className="text-[14px] font-semibold tabular-nums text-success">
                        {formatCurrency(inv.total)}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <InvoiceStatusBadge status={inv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Center — flagged entries */}
      <div
        className="animate-fade-in-up rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden"
        style={{ animationDelay: "320ms" }}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-warning" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
              Flagged for Review
            </h3>
          </div>
          <span className="rounded-full bg-warning-light px-2.5 py-0.5 text-[11px] font-semibold text-warning tabular-nums">
            {flagged.length} {flagged.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        {loading ? (
          <div className="px-6 py-16 text-center">
            <div className="inline-flex items-center gap-2 text-[13px] text-muted">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading...
            </div>
          </div>
        ) : flagged.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-success-light">
              <svg className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <p className="mt-3 text-[13px] font-medium text-foreground">All clear</p>
            <p className="mt-1 text-xs text-muted">No time entries flagged by AI quality checks.</p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {flagged.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-4 px-6 py-4 transition-colors hover:bg-card-hover"
              >
                {/* Warning indicator */}
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning-light">
                  <span className="text-[12px] font-bold text-warning tabular-nums">
                    {item.quality_score ?? "?"}
                  </span>
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium truncate">
                      {item.description || "No description"}
                    </p>
                    {item.category && (
                      <span className="shrink-0 rounded-md bg-primary-light px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        {item.category}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-muted">
                    <span className="tabular-nums">{item.hours.toFixed(1)}h</span>
                    <span>
                      {item.hourly_rate != null
                        ? `$${item.hourly_rate}/hr`
                        : "No rate"}
                    </span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatCurrency(item.total)}
                    </span>
                    {item.log_date && <span>{item.log_date}</span>}
                  </div>
                  {/* AI quality explanation */}
                  <p className="mt-1.5 rounded-md bg-warning-light/50 px-2.5 py-1.5 text-[11px] text-warning leading-relaxed">
                    Quality score {item.quality_score}/100 is below the 40-point threshold.
                    This entry needs manual approval before it can be billed.
                  </p>
                </div>

                {/* Approve button */}
                <button
                  onClick={() => handleApprove(item)}
                  disabled={approving === item.id}
                  className="shrink-0 flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[12px] font-semibold text-white shadow-[0_1px_2px_rgba(99,102,241,0.3)] transition-all duration-150 hover:bg-primary-hover hover:shadow-[0_2px_8px_rgba(99,102,241,0.3)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {approving === item.id ? (
                    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  )}
                  Approve
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
