import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

function AuditPanelSkeleton() {
  return (
    <Card className="border-border/20 bg-card/60">
      <CardContent className="space-y-5 p-5">
        <Skeleton className="h-4 w-48 bg-muted/40" />
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between gap-4 border-b border-border/10 pb-3 last:border-b-0 last:pb-0">
            <Skeleton className="h-3 w-32 bg-muted/30" />
            <Skeleton className="h-4 w-20 bg-muted/45" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function ReportsContentSkeleton() {
  return (
    <div className="space-y-10">
      <div className="overflow-hidden rounded-2xl border border-border/25 bg-card/35">
        <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="border-b border-border/15 p-5 lg:border-b-0 lg:border-r">
            <Skeleton className="h-3 w-36 bg-muted/35" />
            <Skeleton className="mt-6 h-12 w-56 bg-muted/50" />
            <Skeleton className="mt-3 h-4 w-72 max-w-full bg-muted/35" />
            <div className="mt-6 grid grid-cols-2 border-y border-border/15 py-3">
              <div className="space-y-2 border-r border-border/15 pr-4">
                <Skeleton className="h-3 w-16 bg-muted/30" />
                <Skeleton className="h-6 w-12 bg-muted/45" />
              </div>
              <div className="space-y-2 pl-4">
                <Skeleton className="h-3 w-20 bg-muted/30" />
                <Skeleton className="h-6 w-12 bg-muted/45" />
              </div>
            </div>
          </div>
          <div className="grid divide-y divide-border/15 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            {Array.from({ length: 2 }).map((_, columnIndex) => (
              <div key={columnIndex} className="divide-y divide-border/15">
                {Array.from({ length: 4 }).map((__, rowIndex) => (
                  <div key={rowIndex} className="flex items-center justify-between gap-4 px-5 py-4">
                    <Skeleton className="h-3 w-24 bg-muted/30" />
                    <Skeleton className="h-6 w-16 bg-muted/45" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.78fr)]">
        <AuditPanelSkeleton />
        <div className="space-y-6">
          <Card className="border-border/20 bg-card/60">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-40 bg-muted/35" />
                <Skeleton className="h-5 w-16 rounded-full bg-muted/35" />
              </div>
              <Skeleton className="h-64 rounded-2xl bg-muted/28" />
            </CardContent>
          </Card>
          <Card className="border-border/20 bg-card/60">
            <CardContent className="space-y-4 p-5">
              <Skeleton className="h-4 w-40 bg-muted/35" />
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="space-y-3">
                    <Skeleton className="h-3 w-24 bg-muted/30" />
                    <Skeleton className="h-5 w-16 bg-muted/45" />
                    <Skeleton className="h-2 w-full rounded-full bg-muted/30" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export function PropFirmReportsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-2xl border border-border/25 bg-card/35">
        <div className="grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="border-b border-border/15 p-5 lg:border-b-0 lg:border-r">
            <Skeleton className="h-3 w-32 bg-muted/35" />
            <Skeleton className="mt-6 h-12 w-52 bg-muted/50" />
            <Skeleton className="mt-3 h-4 w-72 max-w-full bg-muted/35" />
            <div className="mt-6 grid grid-cols-2 border-y border-border/15 py-3">
              <div className="space-y-2 border-r border-border/15 pr-4">
                <Skeleton className="h-3 w-24 bg-muted/30" />
                <Skeleton className="h-6 w-18 bg-muted/45" />
              </div>
              <div className="space-y-2 pl-4">
                <Skeleton className="h-3 w-20 bg-muted/30" />
                <Skeleton className="h-6 w-20 bg-muted/45" />
              </div>
            </div>
          </div>
          <div className="grid divide-y divide-border/15 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            {Array.from({ length: 2 }).map((_, columnIndex) => (
              <div key={columnIndex} className="px-5 py-3">
                {Array.from({ length: 3 }).map((__, rowIndex) => (
                  <div key={rowIndex} className="flex items-center justify-between gap-4 border-b border-border/10 py-3 last:border-b-0">
                    <Skeleton className="h-3 w-24 bg-muted/30" />
                    <Skeleton className="h-6 w-14 bg-muted/45" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="overflow-hidden border-border/20 bg-card/62">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-24 bg-muted/35" />
                  <Skeleton className="h-5 w-32 bg-muted/45" />
                  <Skeleton className="h-3 w-28 bg-muted/30" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full bg-muted/35" />
              </div>
              <Skeleton className="h-10 w-40 bg-muted/55" />
              <Skeleton className="h-2 w-full rounded-full bg-muted/30" />
              <div className="grid gap-0 border-t border-border/10 pt-4 lg:grid-cols-2">
                {Array.from({ length: 2 }).map((__, columnIndex) => (
                  <div key={columnIndex} className={columnIndex === 0 ? 'lg:border-r lg:border-border/10 lg:pr-5' : 'lg:pl-5'}>
                    {Array.from({ length: 4 }).map((___, rowIndex) => (
                      <div key={rowIndex} className="flex items-center justify-between gap-3 border-b border-border/10 py-2.5 last:border-b-0">
                        <Skeleton className="h-3 w-20 bg-muted/30" />
                        <Skeleton className="h-4 w-16 bg-muted/40" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function ReportsPageSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-6 pb-20 md:pb-8 overflow-hidden">
      <div className="space-y-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <div className="text-3xl font-black tracking-tight text-foreground">Reports</div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/75">
              Jan 19 - Apr 19, 2026
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-28 rounded-xl bg-muted/35" />
            <Skeleton className="h-9 w-24 rounded-xl bg-muted/35" />
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid gap-3 md:grid-cols-[180px_220px_1fr]">
            <Skeleton className="h-11 rounded-2xl bg-muted/40" />
            <Skeleton className="h-11 rounded-2xl bg-muted/40" />
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-11 rounded-2xl bg-muted/35" />
              ))}
            </div>
          </div>
          <Skeleton className="h-11 w-28 rounded-2xl bg-muted/35" />
        </div>

        <div className="flex overflow-hidden rounded-xl border border-border/20 bg-background/40">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-11 w-32 rounded-none border-r border-border/10 bg-muted/35 last:border-r-0" />
          ))}
        </div>

        <ReportsContentSkeleton />
      </div>
    </div>
  )
}
