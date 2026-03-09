// In dev: NEXT_PUBLIC_NOTIFIER_URL=http://localhost:8004 → calls http://localhost:8004/api/notifications
// In prod: NEXT_PUBLIC_NOTIFIER_URL=                     → calls /api/notifications (Nginx proxies)
const NOTIFIER_URL =
  process.env.NEXT_PUBLIC_NOTIFIER_URL ?? "http://localhost:8004";

export interface Notification {
  id: string;
  tenant_id: string;
  recipient_id: string;
  title: string;
  body: string;
  category: string;
  is_read: number; // 0 or 1 (SQLite integer)
  created_at: string;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  limit: number;
  offset: number;
}

function basePath(path: string): string {
  return NOTIFIER_URL ? `${NOTIFIER_URL}${path}` : path;
}

export async function listNotifications(
  tenantId: string,
  recipientId?: string,
  opts?: { unreadOnly?: boolean; limit?: number }
): Promise<NotificationListResponse> {
  const params = new URLSearchParams({ tenant_id: tenantId });
  if (recipientId) params.set("recipient_id", recipientId);
  if (opts?.unreadOnly) params.set("unread_only", "true");
  if (opts?.limit) params.set("limit", String(opts.limit));

  const res = await fetch(`${basePath("/api/notifications")}?${params}`);
  if (!res.ok) throw new Error(`Notifications fetch failed: ${res.status}`);
  return res.json() as Promise<NotificationListResponse>;
}

export async function getUnreadCount(
  tenantId: string,
  recipientId?: string
): Promise<number> {
  const params = new URLSearchParams({ tenant_id: tenantId });
  if (recipientId) params.set("recipient_id", recipientId);

  const res = await fetch(
    `${basePath("/api/notifications/unread-count")}?${params}`
  );
  if (!res.ok) return 0;
  const data = (await res.json()) as { unread_count: number };
  return data.unread_count;
}

export async function markRead(notificationId: string): Promise<void> {
  await fetch(`${basePath(`/api/notifications/${notificationId}/read`)}`, {
    method: "POST",
  });
}

export async function markAllRead(
  tenantId: string,
  recipientId?: string
): Promise<void> {
  const params = new URLSearchParams({ tenant_id: tenantId });
  if (recipientId) params.set("recipient_id", recipientId);
  await fetch(`${basePath("/api/notifications/mark-all-read")}?${params}`, {
    method: "POST",
  });
}
