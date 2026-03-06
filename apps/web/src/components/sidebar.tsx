"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getUserProfile, logout } from "@/lib/auth";
import type { UserProfile } from "@/lib/types";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
      </svg>
    ),
  },
  {
    label: "Projects",
    href: "/projects",
    icon: (
      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
      </svg>
    ),
  },
  {
    label: "Timesheets",
    href: "/timesheets",
    icon: (
      <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
];

function getInitials(name: string, email: string): string {
  if (name) {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email[0]?.toUpperCase() ?? "U";
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setProfile(getUserProfile());
  }, []);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const displayName = profile?.full_name || profile?.email?.split("@")[0] || "User";
  const displayEmail = profile?.email || "";
  const initials = getInitials(profile?.full_name ?? "", displayEmail);

  return (
    <aside className="flex h-screen w-[260px] flex-col bg-sidebar-bg">
      {/* Brand */}
      <div className="flex h-[60px] items-center gap-3 px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sidebar-active text-white text-xs font-bold tracking-tight">
          T
        </div>
        <span className="text-[15px] font-semibold text-white tracking-[-0.01em]">
          TimeTrack
        </span>
      </div>

      {/* Separator */}
      <div className="mx-4 h-px bg-sidebar-border" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150 ${
                isActive
                  ? "bg-sidebar-active text-white shadow-[0_1px_3px_rgba(99,102,241,0.3)]"
                  : "text-sidebar-muted hover:bg-sidebar-hover hover:text-white"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User profile footer */}
      <div className="mx-4 h-px bg-sidebar-border" />
      <div className="relative p-3" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 transition-all duration-150 hover:bg-sidebar-hover"
        >
          {/* Avatar */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-active text-[11px] font-bold text-white">
            {initials}
          </div>
          {/* Name + email */}
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-[13px] font-medium text-white leading-tight">
              {displayName}
            </p>
            {displayEmail && (
              <p className="truncate text-[11px] text-sidebar-muted leading-tight mt-0.5">
                {displayEmail}
              </p>
            )}
          </div>
          {/* Chevron */}
          <svg
            className={`h-4 w-4 shrink-0 text-sidebar-muted transition-transform duration-150 ${menuOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {menuOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-1.5 rounded-lg border border-sidebar-border bg-[#27272a] py-1 shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
            <div className="px-3 py-2 border-b border-sidebar-border">
              <p className="text-[11px] font-medium text-sidebar-muted uppercase tracking-wide">
                {profile?.role ?? "member"}
              </p>
            </div>
            <button
              onClick={() => {
                logout();
                router.push("/login");
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
              </svg>
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
