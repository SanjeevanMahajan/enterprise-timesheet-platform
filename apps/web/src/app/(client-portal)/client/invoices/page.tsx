"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  getBillingStats,
  listInvoices,
  simulatePayment,
} from "@/lib/billing";
import type { BillingInvoice, BillingStats } from "@/lib/types";

// ---------------------------------------------------------------------------
// Status badge (matches billing page pattern)
// ---------------------------------------------------------------------------

const INVOICE_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: "bg-background", text: "text-muted", label: "Draft" },
  unpaid: { bg: "bg-warning-light", text: "text-warning", label: "Unpaid" },
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
// Page
// ---------------------------------------------------------------------------

export default function ClientInvoicesPage() {
  const searchParams = useSearchParams();
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
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
      const [s, inv] = await Promise.all([
        getBillingStats(),
        listInvoices(),
      ]);
      setStats(s);
      setInvoices(inv);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Flash toast on Stripe redirect
  useEffect(() => {
    if (searchParams.get("paid") === "true") {
      addToast("success", "Payment successful! Invoice marked as paid.");
    } else if (searchParams.get("cancelled") === "true") {
      addToast("error", "Payment was cancelled.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePay(invoice: BillingInvoice) {
    if (invoice.payment_url) {
      window.location.href = invoice.payment_url;
      return;
    }
    setPayingId(invoice.id);
    try {
      await simulatePayment(invoice.id);
      const [newStats, newInvoices] = await Promise.all([
        getBillingStats(),
        listInvoices(),
      ]);
      setStats(newStats);
      setInvoices(newInvoices);
      addToast("success", `Invoice ${invoice.id.slice(0, 8)}... marked as paid!`);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Payment failed");
    } finally {
      setPayingId(null);
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

  const unpaidInvoices = invoices.filter((i) => i.status !== "paid");
  const paidInvoices = invoices.filter((i) => i.status === "paid");

  // Stats cards
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
      label: "Outstanding",
      value: stats ? formatCurrency(stats.total_invoiced - stats.total_paid) : "\u2014",
      sub: stats ? `${unpaidInvoices.length} unpaid` : "",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      ),
      accent: "text-warning",
      accentBg: "bg-warning-light",
    },
    {
      label: "Total Paid",
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
  ];

  return (
    <>
      <div className="space-y-8">
        {/* Page header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Invoices</h1>
            <p className="mt-0.5 text-[13px] text-muted">
              View and pay invoices for your projects.
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
        <div className="grid grid-cols-3 gap-4">
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
                {loading ? "\u2014" : card.value}
              </p>
              {card.sub && !loading && (
                <p className="mt-0.5 text-[11px] text-muted tabular-nums">{card.sub}</p>
              )}
            </div>
          ))}
        </div>

        {/* Unpaid invoices */}
        <div
          className="animate-fade-in-up rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden"
          style={{ animationDelay: "240ms" }}
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
          ) : unpaidInvoices.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-success-light">
                <svg className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <p className="mt-3 text-[13px] font-medium text-foreground">All caught up</p>
              <p className="mt-1 text-xs text-muted">No outstanding invoices.</p>
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
                    <th className="px-6 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {unpaidInvoices.map((inv) => (
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
                        <span className="text-[14px] font-semibold tabular-nums text-foreground">
                          {formatCurrency(inv.total)}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <InvoiceStatusBadge status={inv.status} />
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={() => handlePay(inv)}
                          disabled={payingId === inv.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-white shadow-[0_1px_2px_rgba(99,102,241,0.3)] transition-all duration-150 hover:bg-primary-hover hover:shadow-[0_2px_8px_rgba(99,102,241,0.3)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {payingId === inv.id ? (
                            <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
                            </svg>
                          )}
                          {payingId === inv.id ? "Processing\u2026" : "Pay Now"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Payment history */}
        <div
          className="animate-fade-in-up rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden"
          style={{ animationDelay: "320ms" }}
        >
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-success" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                Payment History
              </h3>
            </div>
            <span className="rounded-full bg-success-light px-2.5 py-0.5 text-[11px] font-semibold text-success tabular-nums">
              {paidInvoices.length} paid
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
          ) : paidInvoices.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-background">
                <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
              </div>
              <p className="mt-3 text-[13px] font-medium text-foreground">No payment history</p>
              <p className="mt-1 text-xs text-muted">
                Paid invoices will appear here.
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
                    <th className="px-6 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                      Amount
                    </th>
                    <th className="px-6 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                      Status
                    </th>
                    <th className="px-6 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                      Paid
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paidInvoices.map((inv) => (
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
                      <td className="px-6 py-3.5 text-right">
                        <span className="text-[14px] font-semibold tabular-nums text-success">
                          {formatCurrency(inv.total)}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <InvoiceStatusBadge status={inv.status} />
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="inline-flex items-center gap-1 text-[13px] text-success">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                          {inv.paid_at
                            ? formatDate(inv.paid_at)
                            : "Paid"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
