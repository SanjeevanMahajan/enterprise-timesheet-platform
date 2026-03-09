import type { BillingStats, BillingInvoice, BillingLineItem } from "./types";

// In dev: NEXT_PUBLIC_BILLING_URL=http://localhost:8001 → calls http://localhost:8001/api/stats
// In prod: NEXT_PUBLIC_BILLING_URL=/api/billing         → calls /api/billing/stats (Nginx rewrites)
const BILLING_URL =
  process.env.NEXT_PUBLIC_BILLING_URL ?? "http://localhost:8001";
const IS_PROXIED = BILLING_URL.startsWith("/");

function billingPath(path: string): string {
  // In proxied mode (prod), /api/billing + /stats = /api/billing/stats
  // In direct mode (dev),  http://localhost:8001 + /api/stats = http://localhost:8001/api/stats
  if (IS_PROXIED) {
    return `${BILLING_URL}${path.replace(/^\/api/, "")}`;
  }
  return `${BILLING_URL}${path}`;
}

async function billingRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(billingPath(path), options);
  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = { detail: res.statusText };
    }
    const message =
      typeof body === "object" && body !== null && "detail" in body
        ? String((body as { detail: string }).detail)
        : `Billing request failed (${res.status})`;
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export function getBillingStats(): Promise<BillingStats> {
  return billingRequest<BillingStats>("/api/stats");
}

export function listInvoices(): Promise<BillingInvoice[]> {
  return billingRequest<BillingInvoice[]>("/api/invoices");
}

export function getInvoiceLineItems(invoiceId: string): Promise<BillingLineItem[]> {
  return billingRequest<BillingLineItem[]>(`/api/invoices/${invoiceId}/line-items`);
}

export function listFlaggedItems(): Promise<BillingLineItem[]> {
  return billingRequest<BillingLineItem[]>("/api/line-items/flagged");
}

export function approveLineItem(itemId: string): Promise<BillingLineItem> {
  return billingRequest<BillingLineItem>(`/api/line-items/${itemId}/approve`, {
    method: "POST",
  });
}

export function simulatePayment(invoiceId: string): Promise<BillingInvoice> {
  return billingRequest<BillingInvoice>(`/api/invoices/${invoiceId}/simulate-payment`, {
    method: "POST",
  });
}
