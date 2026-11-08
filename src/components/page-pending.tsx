/**
 * What a page shows while its data loads on a slow navigation: a quiet outline of the page (the
 * title, then a card) in the app's slate neutrals. The router waits a second before showing it, so a
 * fast navigation never flashes it (TanStack Router's default pendingMs).
 */
export function PagePending() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-48 rounded-lg bg-slate-200 motion-safe:animate-pulse" />
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-5 w-40 rounded bg-slate-100 motion-safe:animate-pulse" />
        <div className="h-10 rounded-lg bg-slate-50 motion-safe:animate-pulse" />
        <div className="h-10 rounded-lg bg-slate-50 motion-safe:animate-pulse" />
      </div>
    </div>
  );
}
