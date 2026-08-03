import { Skeleton } from "@/components/ui/skeleton"

export function SettingsPageSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-6 pb-20 md:pb-8 animate-pulse">
      {                     }
      <div className="mb-8 space-y-2">
        <Skeleton className="h-9 w-40 bg-muted/40 rounded-lg" />
        <Skeleton className="h-4 w-60 bg-muted/20 rounded-md" />
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        {                                 }
        <div className="w-full md:w-64 shrink-0 flex md:flex-col overflow-x-auto md:overflow-x-visible pb-3 md:pb-0 gap-1 border-b md:border-b-0 md:border-r border-border/40 pr-0 md:pr-4 scrollbar-none">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg whitespace-nowrap md:w-full shrink-0"
            >
              <Skeleton className="h-4 w-4 bg-muted/30 rounded-md shrink-0" />
              <Skeleton className="h-4 w-28 bg-muted/25 rounded-md" />
            </div>
          ))}
        </div>

        {                                }
        <div className="flex-1 min-w-0 w-full space-y-6">
          {                   }
          <div className="space-y-2">
            <Skeleton className="h-6 w-48 bg-muted/40 rounded-md" />
            <Skeleton className="h-4 w-72 bg-muted/20 rounded-md" />
          </div>

          {                           }
          <div className="rounded-xl border border-border/40 bg-card/45 p-6 space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 bg-muted/30 rounded-md" />
                <Skeleton className="h-4.5 w-24 bg-muted/35 rounded-md" />
              </div>
              <Skeleton className="h-8 w-16 bg-muted/30 rounded-lg" />
            </div>

            {                           }
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/10 border border-border/10">
              <Skeleton className="h-12 w-12 rounded-full bg-muted/30 shrink-0" />
              <div className="flex-1 space-y-2 min-w-0">
                <Skeleton className="h-4 w-36 bg-muted/35 rounded-md" />
                <Skeleton className="h-3 w-48 bg-muted/20 rounded-md" />
              </div>
              <Skeleton className="h-5 w-12 bg-muted/25 rounded-full shrink-0" />
            </div>

            {                 }
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-3 w-16 bg-muted/25 rounded-md" />
                <Skeleton className="h-9 w-full bg-muted/15 rounded-lg border border-border/10" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-16 bg-muted/25 rounded-md" />
                <Skeleton className="h-9 w-full bg-muted/15 rounded-lg border border-border/10" />
              </div>
            </div>

            {                 }
            <div className="space-y-2">
              <Skeleton className="h-3 w-12 bg-muted/25 rounded-md" />
              <Skeleton className="h-9 w-full bg-muted/15 rounded-lg border border-border/10" />
            </div>
          </div>

          {                                             }
          <div className="rounded-xl border border-border/40 bg-card/45 p-6 space-y-6">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 bg-muted/30 rounded-md" />
              <Skeleton className="h-4.5 w-32 bg-muted/35 rounded-md" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/10 border border-border/10">
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-10 bg-muted/20 rounded-md" />
                  <Skeleton className="h-4 w-20 bg-muted/30 rounded-md" />
                </div>
                <Skeleton className="h-5 w-12 bg-muted/25 rounded-full" />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/10 border border-border/10">
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-20 bg-muted/20 rounded-md" />
                  <Skeleton className="h-4 w-32 bg-muted/30 rounded-md" />
                </div>
                <Skeleton className="h-4 w-16 bg-muted/20 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
