"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getUserProfile, isAuthenticated } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { CommandPalette } from "@/components/command-palette";
import { NotificationPanel } from "@/components/notification-panel";

const PAGE_TITLES: Record<string, { title: string; description: string }> = {
  "/dashboard": { title: "Dashboard", description: "Overview of your time tracking activity" },
  "/timesheets": { title: "Timesheets", description: "Submit and review weekly timesheets" },
  "/projects": { title: "Projects", description: "Manage projects and track budgets" },
  "/approvals": { title: "Approvals", description: "Review and approve time entries" },
  "/billing": { title: "Billing", description: "Invoices, payments, and revenue" },
  "/reports": { title: "Reports & Analytics", description: "Insights into time, cost, and productivity" },
  "/capacity": { title: "Resource Planning", description: "Capacity utilization and workload balance" },
  "/settings": { title: "Settings", description: "Organization configuration and security" },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
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

  const pageInfo = PAGE_TITLES[pathname] || { title: "", description: "" };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header bar */}
        <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-6">
          {/* Left: breadcrumb-style page title */}
          <div className="flex items-center gap-3 min-w-0">
            {pageInfo.title && (
              <>
                <h1 className="text-[13px] font-semibold text-foreground truncate">
                  {pageInfo.title}
                </h1>
                <span className="hidden sm:block text-[12px] text-muted-foreground truncate">
                  {pageInfo.description}
                </span>
              </>
            )}
          </div>

          {/* Right: search + notifications */}
          <div className="flex items-center gap-2">
            <CommandPalette />
            <div className="w-px h-5 bg-border mx-1" />
            <NotificationPanel />
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1280px] px-8 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
