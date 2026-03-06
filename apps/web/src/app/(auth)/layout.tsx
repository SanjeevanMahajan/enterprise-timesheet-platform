export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary items-center justify-center p-12">
        <div className="max-w-md text-white">
          <h1 className="text-4xl font-bold tracking-tight mb-4">TimeTrack</h1>
          <p className="text-lg text-blue-100 leading-relaxed">
            Enterprise-grade time tracking, project management, and billing —
            all in one platform.
          </p>
          <div className="mt-10 space-y-4 text-blue-100">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
                ✓
              </span>
              <span>Live timers with one-click start/stop</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
                ✓
              </span>
              <span>Automated timesheet approvals</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
                ✓
              </span>
              <span>Per-client billing &amp; rate management</span>
            </div>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
