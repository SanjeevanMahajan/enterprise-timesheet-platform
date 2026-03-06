"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, logout } from "@/lib/auth";

export default function DashboardPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
    } else {
      setChecked(true);
    }
  }, [router]);

  if (!checked) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold">TimeTrack</h1>
          <button
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-border/50"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-12">
        <h2 className="text-2xl font-semibold mb-2">Dashboard</h2>
        <p className="text-muted">
          You&apos;re signed in. The full dashboard is coming next.
        </p>
      </main>
    </div>
  );
}
