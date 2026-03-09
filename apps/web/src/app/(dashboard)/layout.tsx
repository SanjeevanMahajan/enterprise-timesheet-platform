"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserProfile, isAuthenticated } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { CommandPalette } from "@/components/command-palette";
import { NotificationPanel } from "@/components/notification-panel";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    const profile = getUserProfile();
    if (profile?.role === "client") {
      router.replace("/client/dashboard");
      return;
    }
    setChecked(true);
  }, [router]);

  if (!checked) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-6">
          {/* Global search — Cmd+K command palette */}
          <CommandPalette />

          {/* Right side */}
          <div className="flex items-center gap-2">
            <NotificationPanel />
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1200px] px-8 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
