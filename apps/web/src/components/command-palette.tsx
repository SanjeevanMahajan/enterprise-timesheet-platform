"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { globalSearch, type SearchHit, type SearchResults } from "@/lib/search";

// ── Debounce hook ──────────────────────────────────────────────────────────
function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

// ── Category config ────────────────────────────────────────────────────────
const CATEGORIES: {
  key: keyof SearchResults["results"];
  label: string;
  icon: React.ReactNode;
  href: (hit: SearchHit) => string;
  subtitle: (hit: SearchHit) => string;
}[] = [
  {
    key: "projects",
    label: "Projects",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
      </svg>
    ),
    href: (hit) => `/projects/${hit.id}`,
    subtitle: (hit) => (hit.name as string) || hit.id,
  },
  {
    key: "timelogs",
    label: "Time Logs",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
    href: () => `/timesheets`,
    subtitle: (hit) => {
      const desc = (hit.description as string) || "";
      const hours = hit.hours as number | undefined;
      return desc ? `${hours ? hours + "h — " : ""}${desc}` : `${hours ?? 0}h logged`;
    },
  },
  {
    key: "invoices",
    label: "Invoices",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
      </svg>
    ),
    href: () => `/billing`,
    subtitle: (hit) => {
      const total = hit.total as number | undefined;
      return total != null ? `$${total.toFixed(2)}` : hit.id;
    },
  },
];

// ── Component ──────────────────────────────────────────────────────────────
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query, 200);

  // ── Flatten results for keyboard navigation ────────────────────────────
  const flatItems = results
    ? CATEGORIES.flatMap((cat) =>
        (results.results[cat.key] ?? []).map((hit) => ({
          hit,
          category: cat,
        }))
      )
    : [];

  // ── Open/close ─────────────────────────────────────────────────────────
  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery("");
    setResults(null);
    setSelectedIdx(0);
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults(null);
  }, []);

  // ── Cmd+K global shortcut ──────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) {
          closePalette();
        } else {
          openPalette();
        }
      }
      if (e.key === "Escape" && open) {
        closePalette();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, openPalette, closePalette]);

  // ── Auto-focus input ───────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // ── Search on debounced query ──────────────────────────────────────────
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults(null);
      setSelectedIdx(0);
      return;
    }
    let cancelled = false;
    setLoading(true);
    globalSearch(debouncedQuery)
      .then((data) => {
        if (!cancelled) {
          setResults(data);
          setSelectedIdx(0);
        }
      })
      .catch(() => {
        if (!cancelled) setResults(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // ── Keyboard navigation ────────────────────────────────────────────────
  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && flatItems.length > 0) {
      e.preventDefault();
      const item = flatItems[selectedIdx];
      if (item) {
        router.push(item.category.href(item.hit));
        closePalette();
      }
    }
  }

  // ── Scroll selected into view ──────────────────────────────────────────
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${selectedIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  if (!open) {
    // Trigger button styled like the original search input
    return (
      <button
        onClick={openPalette}
        className="relative flex w-full max-w-sm items-center rounded-lg border border-border bg-background py-1.5 pl-9 pr-3 text-[13px] text-muted-foreground transition-all duration-150 hover:border-primary/40 hover:text-foreground"
      >
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>
        <span>Search…</span>
        <kbd className="ml-auto hidden rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
          ⌘K
        </kbd>
      </button>
    );
  }

  // ── Modal ──────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closePalette}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-fade-in-up">
        {/* Input row */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <svg
            className="h-5 w-5 shrink-0 text-muted"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search projects, time logs, invoices…"
            className="flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          {loading && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
          <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto">
          {!query.trim() && (
            <div className="px-4 py-8 text-center text-[13px] text-muted">
              Start typing to search across your workspace…
            </div>
          )}

          {query.trim() && !loading && results && flatItems.length === 0 && (
            <div className="px-4 py-8 text-center text-[13px] text-muted">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {flatItems.length > 0 && (() => {
            let globalIdx = 0;
            return CATEGORIES.map((cat) => {
              const hits = results?.results[cat.key] ?? [];
              if (hits.length === 0) return null;
              const section = (
                <div key={cat.key}>
                  <div className="sticky top-0 z-10 flex items-center gap-2 bg-card/95 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted backdrop-blur-sm">
                    {cat.icon}
                    {cat.label}
                    <span className="ml-auto text-[10px] font-normal text-muted-foreground">
                      {hits.length}
                    </span>
                  </div>
                  {hits.map((hit) => {
                    const idx = globalIdx++;
                    const isSelected = idx === selectedIdx;
                    return (
                      <button
                        key={hit.id}
                        data-idx={idx}
                        onClick={() => {
                          router.push(cat.href(hit));
                          closePalette();
                        }}
                        onMouseEnter={() => setSelectedIdx(idx)}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] transition-colors ${
                          isSelected
                            ? "bg-primary/10 text-foreground"
                            : "text-foreground/80 hover:bg-primary/5"
                        }`}
                      >
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                            isSelected
                              ? "bg-primary text-white"
                              : "bg-border/50 text-muted"
                          }`}
                        >
                          {cat.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {(hit.name as string) || hit.id}
                          </p>
                          <p className="truncate text-[11px] text-muted">
                            {cat.subtitle(hit)}
                          </p>
                        </div>
                        {isSelected && (
                          <span className="text-[11px] text-muted-foreground">
                            ↵
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
              return section;
            });
          })()}
        </div>

        {/* Footer */}
        {flatItems.length > 0 && (
          <div className="flex items-center justify-between border-t border-border bg-card px-4 py-2">
            <span className="text-[11px] text-muted-foreground">
              {results?.total_hits ?? 0} results
            </span>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">
                ↑↓
              </kbd>
              <span>navigate</span>
              <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">
                ↵
              </kbd>
              <span>open</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
