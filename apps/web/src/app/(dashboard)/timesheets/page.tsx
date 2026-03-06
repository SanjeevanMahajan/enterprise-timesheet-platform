"use client";

export default function TimesheetsPage() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Timesheets</h1>
        <p className="mt-0.5 text-[13px] text-muted">
          Submit and track your weekly timesheets.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-background">
          <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <p className="mt-3 text-[13px] font-medium text-foreground">
          Timesheet management coming soon
        </p>
        <p className="mt-1 text-xs text-muted">
          You&apos;ll be able to submit, review, and approve timesheets here.
        </p>
      </div>
    </>
  );
}
