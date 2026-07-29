import { Skeleton } from "@/components/ui/skeleton"

function MetricRows({ count = 6 }: { count?: number }) {
  return <div className="flex flex-col divide-y divide-border/20">{Array.from({ length: count }, (_, index) => <div key={index} className="flex items-center justify-between gap-4 py-4"><Skeleton className="h-3 w-28" /><Skeleton className="h-5 w-16" /></div>)}</div>
}

export function ReportsContentSkeleton() {
  return <div role="status" aria-label="Loading report" className="flex flex-col gap-8">
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,.7fr)]">
      <section className="flex flex-col gap-6 border-b border-border/30 pb-6 lg:border-b-0 lg:border-r lg:pr-8"><Skeleton className="h-4 w-40" /><Skeleton className="h-12 w-56" /><Skeleton className="h-4 w-72 max-w-full" /><div className="grid grid-cols-2 gap-4 border-y border-border/20 py-4"><Skeleton className="h-8 w-20" /><Skeleton className="h-8 w-20" /></div></section>
      <MetricRows count={5} />
    </div>
    <div className="grid gap-8 lg:grid-cols-2"><div className="flex flex-col gap-4"><Skeleton className="h-5 w-40" /><Skeleton className="h-64 w-full" /></div><div className="flex flex-col gap-4"><Skeleton className="h-5 w-40" /><Skeleton className="h-64 w-full" /></div></div>
  </div>
}

export function PropFirmReportsSkeleton() {
  return <div role="status" aria-label="Loading funded report" className="flex flex-col gap-8"><div className="grid gap-8 lg:grid-cols-2"><div className="flex flex-col gap-5"><Skeleton className="h-4 w-36" /><Skeleton className="h-12 w-52" /><Skeleton className="h-4 w-72 max-w-full" /></div><MetricRows count={4} /></div><div className="flex flex-col gap-3">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28 w-full" />)}</div></div>
}

export function ReportsPageSkeleton() {
  return <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6"><header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div className="flex flex-col gap-2"><Skeleton className="h-8 w-40" /><Skeleton className="h-3 w-32" /></div><div className="flex gap-2"><Skeleton className="h-9 w-24" /><Skeleton className="h-9 w-24" /></div></header><div className="grid gap-3 lg:grid-cols-[1fr_auto]"><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-28" /></div><Skeleton className="h-12 w-full" /><ReportsContentSkeleton /></main>
}
