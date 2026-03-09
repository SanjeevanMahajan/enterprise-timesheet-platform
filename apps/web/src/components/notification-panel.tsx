"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getUnreadCount,
  listNotifications,
  markAllRead,
  markRead,
  type Notification,
} from "@/lib/notifications";

// ── Category styling ───────────────────────────────────────────────────────
const CATEGORY_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  timelog:   { bg: "bg-primary-light",  text: "text-primary",  icon: "clock" },
  timesheet: { bg: "bg-primary-light",  text: "text-primary",  icon: "calendar" },
  project:   { bg: "bg-success-light",  text: "text-success",  icon: "folder" },
  billing:   { bg: "bg-warning-light",  text: "text-warning",  icon: "dollar" },
  system:    { bg: "bg-border",         text: "text-muted",    icon: "info" },
  general:   { bg: "bg-border",         text: "text-muted",    icon: "bell" },
};

function CategoryIcon({ category }: { category: string }) {
  const style = CATEGORY_STYLES[category] ?? CATEGORY_STYLES.general;
  return (
    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.bg}`}>
      {style.icon === "clock" && (
        <svg className={`h-4 w-4 ${style.text}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      )}
      {style.icon === "calendar" && (
        <svg className={`h-4 w-4 ${style.text}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
        </svg>
      )}
      {style.icon === "folder" && (
        <svg className={`h-4 w-4 ${style.text}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
        </svg>
      )}
      {style.icon === "dollar" && (
        <svg className={`h-4 w-4 ${style.text}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      )}
      {(style.icon === "bell" || style.icon === "info") && (
        <svg className={`h-4 w-4 ${style.text}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
      )}
    </div>
  );
}

function timeAgo(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Hardcoded tenant for demo (matches backend default) ────────────────────
// In a real app this comes from auth context; for now we use a reasonable fallback.
function getTenantId(): string {
  if (typeof window === "undefined") return "";
  try {
    const token = localStorage.getItem("access_token");
    if (token) {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.tenant_id ?? "";
    }
  } catch { /* ignore */ }
  return "";
}

function getUserId(): string {
  if (typeof window === "undefined") return "";
  try {
    const token = localStorage.getItem("access_token");
    if (token) {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.sub ?? "";
    }
  } catch { /* ignore */ }
  return "";
}

// ── Component ──────────────────────────────────────────────────────────────
export function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const tenantId = getTenantId();
  const userId = getUserId();

  // ── Fetch unread count on mount + poll every 30s ───────────────────────
  const refreshCount = useCallback(() => {
    if (!tenantId) return;
    getUnreadCount(tenantId, userId).then(setUnread).catch(() => {});
  }, [tenantId, userId]);

  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, 30_000);
    return () => clearInterval(interval);
  }, [refreshCount]);

  // ── Load full list when panel opens ────────────────────────────────────
  useEffect(() => {
    if (!open || !tenantId) return;
    setLoading(true);
    listNotifications(tenantId, userId, { limit: 30 })
      .then((res) => setNotifications(res.notifications))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, tenantId, userId]);

  // ── Close on outside click ─────────────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // ── Mark individual as read ────────────────────────────────────────────
  async function handleMarkRead(n: Notification) {
    if (n.is_read) return;
    await markRead(n.id);
    setNotifications((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, is_read: 1 } : x))
    );
    setUnread((c) => Math.max(0, c - 1));
  }

  // ── Mark all as read ───────────────────────────────────────────────────
  async function handleMarkAllRead() {
    if (!tenantId) return;
    await markAllRead(tenantId, userId);
    setNotifications((prev) => prev.map((x) => ({ ...x, is_read: 1 })));
    setUnread(0);
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-background hover:text-foreground"
      >
        <svg
          className="h-[18px] w-[18px]"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>
        {/* Unread badge */}
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[380px] overflow-hidden rounded-xl border border-border bg-card shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-[13px] font-semibold text-foreground">
              Notifications
            </h3>
            {unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[12px] font-medium text-primary hover:text-primary-hover transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="px-4 py-8 text-center">
                <svg
                  className="mx-auto mb-2 h-8 w-8 text-muted-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
                  />
                </svg>
                <p className="text-[13px] text-muted">
                  No notifications yet
                </p>
              </div>
            )}

            {!loading &&
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleMarkRead(n)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-card-hover ${
                    !n.is_read ? "bg-primary/[0.03]" : ""
                  }`}
                >
                  <CategoryIcon category={n.category} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-[13px] leading-tight ${
                          !n.is_read
                            ? "font-semibold text-foreground"
                            : "font-medium text-foreground/80"
                        }`}
                      >
                        {n.title}
                      </p>
                      {!n.is_read && (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                    {n.body && (
                      <p className="mt-0.5 truncate text-[12px] text-muted">
                        {n.body}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
