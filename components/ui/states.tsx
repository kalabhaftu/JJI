"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { AlertCircleIcon, InboxIcon, RefreshIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

export type AsyncDataState<T = unknown> =
  | { status: "initial-loading" }
  | { status: "local-loading" }
  | { status: "success"; data: T; updatedAt?: number }
  | { status: "refreshing"; data: T; updatedAt?: number }
  | { status: "realtime-updating"; data: T; updatedAt?: number }
  | { status: "stale"; data: T; updatedAt: number; reason?: string }
  | { status: "offline"; data?: T; updatedAt?: number }
  | { status: "partial"; data: T; missing: readonly string[] }
  | { status: "permission-denied"; message: string }
  | { status: "recoverable-error"; data: T; error: unknown; updatedAt?: number }
  | { status: "blocking-error"; error: unknown }
  | { status: "empty" }
  | { status: "no-results"; query?: string }

type AsyncStateProps<T> = {
  state: AsyncDataState<T>
  renderData?: (data: T) => React.ReactNode
  initialLoading?: React.ReactNode
  localLoading?: React.ReactNode
  empty?: React.ReactNode
  noResults?: React.ReactNode
  className?: string
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong."
}

export function AsyncState<T>({
  state,
  renderData,
  initialLoading,
  localLoading,
  empty,
  noResults,
  className,
}: AsyncStateProps<T>) {
  if (state.status === "initial-loading") return initialLoading ?? <PageLoadingState />
  if (state.status === "local-loading") return localLoading ?? <SectionLoadingState />
  if (state.status === "empty") return empty ?? <EmptyState title="No data" />
  if (state.status === "no-results") return noResults ?? <EmptyState title="No results" {...(state.query ? { description: `No results for “${state.query}”.` } : {})} />
  if (state.status === "permission-denied") return <InlineErrorState message={state.message} />
  if (state.status === "blocking-error") return <InlineErrorState message={errorMessage(state.error)} />

  const data = "data" in state ? state.data : undefined
  const busy = state.status === "refreshing" || state.status === "realtime-updating"
  const notice = state.status === "refreshing"
    ? "Refreshing"
    : state.status === "realtime-updating"
      ? "Updating"
      : state.status === "stale"
        ? state.reason ?? "Data may be stale"
        : state.status === "offline"
          ? "Offline"
          : state.status === "partial"
            ? `Some data is unavailable: ${state.missing.join(", ")}`
            : state.status === "recoverable-error"
              ? errorMessage(state.error)
              : null

  return (
    <div className={cn("space-y-2", className)} aria-busy={busy || undefined}>
      {notice && <div role="status" aria-live="polite" className="text-sm text-muted-foreground">{notice}</div>}
      {data !== undefined && renderData?.(data)}
    </div>
  )
}

export function PageLoadingState({ label = "Loading" }: { label?: string }) {
  return <div role="status" aria-live="polite" aria-busy="true" className="space-y-4"><span className="sr-only">{label}</span><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-72 max-w-full" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div></div>
}

export function SectionLoadingState({ className }: { className?: string }) { return <div role="status" aria-label="Loading section" className={cn("space-y-3", className)}><Skeleton className="h-5 w-36" /><Skeleton className="h-24 w-full" /></div> }
export function DataTableLoadingState({ rows = 5 }: { rows?: number }) { return <div role="status" aria-label="Loading table" className="space-y-2">{Array.from({ length: rows }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}</div> }
export function ChartLoadingState() { return <div role="status" aria-label="Loading chart" className="flex h-64 items-end gap-2"><Skeleton className="h-1/3 flex-1" /><Skeleton className="h-2/3 flex-1" /><Skeleton className="h-1/2 flex-1" /><Skeleton className="h-5/6 flex-1" /><Skeleton className="h-1/2 flex-1" /></div> }
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) { return <div data-state="empty" className="flex flex-col items-center justify-center py-16 text-center"><HugeiconsIcon icon={InboxIcon} className="mb-3 h-8 w-8 text-muted-foreground/50" strokeWidth={1.5} color="currentColor" aria-hidden /><h2 className="text-base font-semibold">{title}</h2>{description && <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>}{action && <div className="mt-5">{action}</div>}</div> }
export function InlineErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) { return <div role="alert" className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><HugeiconsIcon icon={AlertCircleIcon} className="h-4 w-4 shrink-0" strokeWidth={1.5} color="currentColor" aria-hidden /><span className="flex-1">{message}</span>{onRetry && <RetryButton onClick={onRetry} />}</div> }
export function RetryButton({ onClick }: { onClick: () => void }) { return <Button type="button" variant="secondary" size="sm" onClick={onClick}><HugeiconsIcon icon={RefreshIcon} className="h-3.5 w-3.5" strokeWidth={1.5} color="currentColor" aria-hidden />Retry</Button> }
export function UnsavedChangesDialog({ open, onOpenChange, onDiscard }: { open: boolean; onOpenChange: (open: boolean) => void; onDiscard: () => void }) { return <AlertDialog open={open} onOpenChange={onOpenChange}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Discard changes?</AlertDialogTitle><AlertDialogDescription>Your unsaved edits will be lost.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><AlertDialogAction onClick={onDiscard}>Discard changes</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog> }
export function DestructiveActionDialog({ open, onOpenChange, title, description, actionLabel = "Delete", pending = false, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; actionLabel?: string; pending?: boolean; onConfirm: () => void | Promise<void> }) { return <AlertDialog open={open} onOpenChange={onOpenChange}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel><AlertDialogAction disabled={pending} aria-busy={pending || undefined} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={(event) => { event.preventDefault(); void onConfirm() }}>{pending ? `${actionLabel}…` : actionLabel}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog> }
