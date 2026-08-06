export default function SharedReportLoading() {
  return (
    <div role="status" aria-live="polite" className="min-h-screen bg-[#f4f6fa]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
          <div className="h-8 w-28 animate-pulse rounded bg-slate-200" />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="rounded-sm border border-slate-200 bg-white p-6">
          <div className="h-10 w-52 animate-pulse rounded bg-slate-200" />
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="h-64 animate-pulse rounded bg-slate-100" />
            <div className="h-64 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      </main>
    </div>
  )
}
