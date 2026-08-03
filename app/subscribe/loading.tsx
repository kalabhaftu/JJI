import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function SubscribeLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {            }
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Skeleton className="w-8 h-8 rounded-md bg-muted/30" />
            <Skeleton className="w-20 h-5 bg-muted/35" />
          </div>
          <Skeleton className="h-7 w-48 bg-muted/40 mb-2" />
          <Skeleton className="h-4 w-72 bg-muted/25" />
        </div>

        {                           }
        <div className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm p-6 shadow-lg space-y-6">
          {                   }
          <div className="text-center pb-6 border-b border-border/40 flex flex-col items-center space-y-2">
            <div className="flex items-baseline justify-center gap-1">
              <Skeleton className="h-10 w-24 bg-muted/45" />
              <Skeleton className="h-4 w-12 bg-muted/30" />
            </div>
            <Skeleton className="h-3.5 w-36 bg-muted/20" />
          </div>

          {              }
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-4 rounded-full bg-muted/30 shrink-0" />
                <Skeleton className="h-4 flex-1 bg-muted/25" />
              </div>
            ))}
          </div>

          {                      }
          <div className="space-y-1">
            <Skeleton className="h-10 w-full rounded-md bg-muted/20" />
          </div>

          {                      }
          <Skeleton className="h-11 w-full rounded-md bg-muted/40" />

          {                        }
          <div className="flex justify-center">
            <Skeleton className="h-3 w-64 bg-muted/20" />
          </div>
        </div>

        {              }
        <div className="text-center mt-6 flex justify-center">
          <Skeleton className="h-8 w-20 rounded-md bg-muted/20" />
        </div>
      </div>
    </div>
  )
}
