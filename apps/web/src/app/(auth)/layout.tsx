export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 bg-[#18181b]">
        <div className="max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white text-sm font-bold">
              T
            </div>
            <h1 className="text-2xl font-semibold text-white tracking-[-0.02em]">
              TimeTrack
            </h1>
          </div>
          <p className="text-[17px] text-zinc-400 leading-relaxed">
            Enterprise-grade time tracking, project management, and billing —
            all in one platform.
          </p>
          <div className="mt-10 space-y-4">
            {[
              "Live timers with one-click start/stop",
              "Automated timesheet approvals",
              "Per-client billing & rate management",
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary text-xs">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </span>
                <span className="text-[14px] text-zinc-400">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8 bg-card">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
