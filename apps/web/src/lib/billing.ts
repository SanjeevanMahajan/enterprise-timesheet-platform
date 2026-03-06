import type { BillingStats, BillingInvoice, BillingLineItem } from "./types";

const BILLING_URL =
  process.env.NEXT_PUBLIC_BILLING_URL ?? "http://localhost:8001";

async function billingRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BILLING_URL}${path}`, options);
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

export function listFlaggedItems(): Promise<BillingLineItem[]> {
  return billingRequest<BillingLineItem[]>("/api/line-items/flagged");
}

export function approveLineItem(itemId: string): Promise<BillingLineItem> {
  return billingRequest<BillingLineItem>(`/api/line-items/${itemId}/approve`, {
    method: "POST",
  });
}
