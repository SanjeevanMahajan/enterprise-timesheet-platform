"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  getBillingStats,
  listInvoices,
  listFlaggedItems,
  approveLineItem,
  simulatePayment,
} from "@/lib/billing";
import type { BillingStats, BillingInvoice, BillingLineItem } from "@/lib/types";

// ---------------------------------------------------------------------------
// Status badge — uses design system badge class
// ---------------------------------------------------------------------------

const INVOICE_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: "bg-[#6b6b76]/10", text: "text-[#6b6b76]", label: "Draft" },
  sent: { bg: "bg-[#0284c7]/10", text: "text-[#0284c7]", label: "Sent" },
  unpaid: { bg: "bg-[#0284c7]/10", text: "text-[#0284c7]", label: "Unpaid" },
  paid: { bg: "bg-[#059669]/10", text: "text-[#059669]", label: "Paid" },
  overdue: { bg: "bg-[#dc2626]/10", text: "text-[#dc2626]", label: "Overdue" },
};

function InvoiceStatusBadge({ status }: { status: string }) {
  const s = INVOICE_STATUS_STYLES[status] ?? { bg: "bg-[#6b6b76]/10", text: "text-[#6b6b76]", label: status };
  return (
    <span className={`badge ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Toast system
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
          className={`animate-fade-in-up flex items-center gap-3 rounded-lg border px-4 py-3 shadow-[var(--shadow-lg)] backdrop-blur-sm ${
            t.type === "success"
              ? "border-[#059669]/20 bg-success-light text-[#059669]"
              : "border-[#dc2626]/20 bg-danger-light text-[#dc2626]"
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
// Stripe icon (inline SVG)
// ---------------------------------------------------------------------------

function StripeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Billing Page
// ---------------------------------------------------------------------------

export default function BillingPage() {
  const searchParams = useSearchParams();
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [flagged, setFlagged] = useState<BillingLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
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

  // Show toast if redirected from Stripe checkout
  useEffect(() => {
    if (searchParams.get("paid") === "true") {
      addToast("success", "Payment successful! Invoice marked as paid.");
    } else if (searchParams.get("cancelled") === "true") {
      addToast("error", "Payment was cancelled.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleApprove(item: BillingLineItem) {
    setApproving(item.id);
    try {
      await approveLineItem(item.id);
      setFlagged((prev) => prev.filter((f) => f.id !== item.id));
      const newStats = await getBillingStats();
      setStats(newStats);
      const newInvoices = await listInvoices();
      setInvoices(newInvoices);
      addToast("success", "Entry approved for billing.");
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setApproving(null);
    }
  }

  function handlePayNow(inv: BillingInvoice) {
    if (inv.payment_url) {
      window.open(inv.payment_url, "_blank", "noopener");
    }
  }

  async function handleSimulatePayment(inv: BillingInvoice) {
    setPaying(inv.id);
    try {
      await simulatePayment(inv.id);
      const [newStats, newInvoices] = await Promise.all([
        getBillingStats(),
        listInvoices(),
      ]);
      setStats(newStats);
      setInvoices(newInvoices);
      addToast("success", `Invoice ${inv.id.slice(0, 8)}... marked as paid!`);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to simulate payment");
    } finally {
      setPaying(null);
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

  // Check if an invoice is payable (unpaid or draft with a payment link)
  const isPayable = (inv: BillingInvoice) =>
    inv.status !== "paid" && inv.payment_url;

  // ---------------------------------------------------------------------------
  // Stats cards config
  // ---------------------------------------------------------------------------

  const STAT_CARDS = [
    {
      label: "Total Invoiced",
      value: stats ? formatCurrency(stats.total_invoiced) : "\u2014",
      sub: stats ? `${stats.invoice_count} invoice${stats.invoice_count !== 1 ? "s" : ""}` : "",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
      ),
      accent: "text-primary",
      accentBg: "bg-primary-light",
    },
    {
      label: "Revenue Collected",
      value: stats ? formatCurrency(stats.total_paid) : "\u2014",
      sub: stats ? `${stats.paid_count} paid` : "",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
      accent: "text-success",
      accentBg: "bg-success-light",
    },
    {
      label: "Awaiting Payment",
      value: stats ? formatCurrency(stats.awaiting_review_amount) : "\u2014",
      sub: stats ? `${stats.awaiting_review_count} pending` : "",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
      accent: "text-warning",
      accentBg: "bg-warning-light",
    },
  ];

  return (
    <>
      {/* Page header */}
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Billing</h1>
        <p className="mt-0.5 text-[13px] text-muted">
          Invoices, payments, and AI-flagged entry review.
        </p>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STAT_CARDS.map((card, i) => (
          <div
            key={card.label}
            className="animate-fade-in-up rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-xs)] transition-shadow hover:shadow-[var(--shadow-sm)]"
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
            {card.sub && !loading && (
              <p className="mt-1 text-[12px] text-muted tabular-nums">{card.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* Invoices section */}
      <div
        className="animate-fade-in-up mb-6 rounded-xl border border-border bg-card shadow-[var(--shadow-xs)] overflow-hidden"
        style={{ animationDelay: "240ms" }}
      >
        {/* Card header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <h3 className="text-[13px] font-semibold text-foreground">
              Invoices
            </h3>
          </div>
          <button
            onClick={fetchAll}
            disabled={loading}
            className="btn btn-ghost !py-1.5 !px-3 !text-[12px]"
          >
            <svg className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
            </svg>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-2.5 text-[13px] text-muted">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading invoices...
            </div>
          </div>
        ) : invoices.length === 0 ? (
          <div className="empty-state">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <h3>No invoices yet</h3>
            <p>
              Invoices are generated automatically when 3+ billable entries are ready.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header text-left">Invoice #</th>
                  <th className="table-header text-left">Date</th>
                  <th className="table-header text-center">Items</th>
                  <th className="table-header text-right">Amount</th>
                  <th className="table-header text-left">Status</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="table-cell">
                      <span className="font-mono text-[12px] text-muted">
                        {inv.id.slice(0, 8)}...
                      </span>
                    </td>
                    <td className="table-cell whitespace-nowrap text-muted">
                      {formatDate(inv.created_at)}
                    </td>
                    <td className="table-cell text-center">
                      <span className="badge bg-surface-inset text-muted">
                        {inv.line_item_count}
                      </span>
                    </td>
                    <td className="table-cell text-right">
                      <span className={`text-[14px] font-semibold tabular-nums ${inv.status === "paid" ? "text-success" : "text-foreground"}`}>
                        {formatCurrency(inv.total)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <InvoiceStatusBadge status={inv.status} />
                    </td>
                    <td className="table-cell text-right">
                      {inv.status === "paid" ? (
                        <span className="text-[12px] text-muted">
                          {inv.paid_at ? formatDate(inv.paid_at) : "Paid"}
                        </span>
                      ) : isPayable(inv) ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handlePayNow(inv)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#635bff] px-3 py-1.5 text-[11px] font-semibold text-white shadow-[0_1px_2px_rgba(99,91,255,0.3)] transition-all duration-150 hover:bg-[#5851ea] hover:shadow-[0_2px_8px_rgba(99,91,255,0.3)] active:scale-[0.98]"
                          >
                            <StripeIcon className="h-3 w-3" />
                            Pay Now
                          </button>
                          <button
                            onClick={() => handleSimulatePayment(inv)}
                            disabled={paying === inv.id}
                            className="btn btn-secondary !py-1 !px-2.5 !text-[11px]"
                            title="Simulate payment (dev mode)"
                          >
                            {paying === inv.id ? (
                              <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                            )}
                            Demo Pay
                          </button>
                        </div>
                      ) : (
                        <span className="text-[12px] text-muted-foreground">&mdash;</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quality Review — flagged entries */}
      <div
        className="animate-fade-in-up rounded-xl border border-border bg-card shadow-[var(--shadow-xs)] overflow-hidden"
        style={{ animationDelay: "320ms" }}
      >
        {/* Card header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <svg className="h-4 w-4 text-warning" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <h3 className="text-[13px] font-semibold text-foreground">
              Quality Review
            </h3>
          </div>
          {flagged.length > 0 && !loading && (
            <span className="badge bg-[#d97706]/10 text-[#d97706]">
              {flagged.length} {flagged.length === 1 ? "entry" : "entries"}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-2.5 text-[13px] text-muted">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading...
            </div>
          </div>
        ) : flagged.length === 0 ? (
          <div className="empty-state">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success-light mb-3">
              <svg className="h-6 w-6 !text-success !mb-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <h3>All clear</h3>
            <p>No time entries flagged by AI quality checks.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-px bg-border-subtle sm:grid-cols-2">
            {flagged.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-4 bg-card p-5 transition-colors hover:bg-card-hover"
              >
                {/* Quality score indicator */}
                <div className="mt-0.5 flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-warning-light">
                  <span className="text-[13px] font-bold text-warning tabular-nums leading-none">
                    {item.quality_score ?? "?"}
                  </span>
                  <span className="text-[8px] font-medium text-warning/60 uppercase mt-0.5">score</span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium truncate">
                      {item.description || "No description"}
                    </p>
                    {item.category && (
                      <span className="badge bg-primary-light text-primary shrink-0">
                        {item.category}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-[12px] text-muted">
                    <span className="tabular-nums">{item.hours.toFixed(1)}h</span>
                    <span className="text-border-strong">&middot;</span>
                    <span>
                      {item.hourly_rate != null
                        ? `$${item.hourly_rate}/hr`
                        : "No rate"}
                    </span>
                    <span className="text-border-strong">&middot;</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatCurrency(item.total)}
                    </span>
                    {item.log_date && (
                      <>
                        <span className="text-border-strong">&middot;</span>
                        <span>{item.log_date}</span>
                      </>
                    )}
                  </div>
                  <p className="mt-2 rounded-md bg-warning-light/50 px-2.5 py-1.5 text-[11px] text-warning leading-relaxed">
                    Quality score {item.quality_score}/100 is below the 40-point threshold.
                    Manual approval required before billing.
                  </p>
                </div>

                <button
                  onClick={() => handleApprove(item)}
                  disabled={approving === item.id}
                  className="btn btn-primary !py-1.5 !px-3 !text-[12px] shrink-0 mt-0.5"
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
