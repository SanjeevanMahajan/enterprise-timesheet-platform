"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserProfile, isAuthenticated, logout } from "@/lib/auth";
import type { UserProfile } from "@/lib/types";

export default function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    const p = getUserProfile();
    if (p?.role !== "client") {
      router.replace("/dashboard");
      return;
    }
    setProfile(p);
    setChecked(true);
  }, [router]);

  if (!checked) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Client portal header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-white text-xs font-bold">
              T
            </div>
            <span className="text-[15px] font-semibold tracking-[-0.01em]">
              TimeTrack
            </span>
            <span className="ml-2 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
              Client Portal
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[13px] text-muted">
              {profile?.email}
            </span>
            <button
              onClick={() => {
                logout();
                router.push("/login");
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:bg-background hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-[1100px] px-6 py-8">{children}</main>
    </div>
  );
}
