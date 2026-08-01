"use client"

import * as React from "react"
import { AlertCircle, Inbox, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

export function PageLoadingState({ label = "Loading" }: { label?: string }) {
  return <div role="status" aria-live="polite" aria-busy="true" className="space-y-4"><span className="sr-only">{label}</span><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-72 max-w-full" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div></div>
}

export function SectionLoadingState({ className }: { className?: string }) { return <div role="status" aria-label="Loading section" className={cn("space-y-3", className)}><Skeleton className="h-5 w-36" /><Skeleton className="h-24 w-full" /></div> }
export function DataTableLoadingState({ rows = 5 }: { rows?: number }) { return <div role="status" aria-label="Loading table" className="space-y-2">{Array.from({ length: rows }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}</div> }
export function ChartLoadingState() { return <div role="status" aria-label="Loading chart" className="flex h-64 items-end gap-2"><Skeleton className="h-1/3 flex-1" /><Skeleton className="h-2/3 flex-1" /><Skeleton className="h-1/2 flex-1" /><Skeleton className="h-5/6 flex-1" /><Skeleton className="h-1/2 flex-1" /></div> }
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) { return <div data-state="empty" className="flex flex-col items-center justify-center py-16 text-center"><Inbox className="mb-3 h-8 w-8 text-muted-foreground/50" aria-hidden /><h2 className="text-base font-semibold">{title}</h2>{description && <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>}{action && <div className="mt-5">{action}</div>}</div> }
export function InlineErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) { return <div role="alert" className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0" aria-hidden /><span className="flex-1">{message}</span>{onRetry && <RetryButton onClick={onRetry} />}</div> }
export function RetryButton({ onClick }: { onClick: () => void }) { return <Button type="button" variant="outline" size="sm" onClick={onClick}><RefreshCw className="h-3.5 w-3.5" aria-hidden />Retry</Button> }
export function UnsavedChangesDialog({ open, onOpenChange, onDiscard }: { open: boolean; onOpenChange: (open: boolean) => void; onDiscard: () => void }) { return <AlertDialog open={open} onOpenChange={onOpenChange}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Discard changes?</AlertDialogTitle><AlertDialogDescription>Your unsaved edits will be lost.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><AlertDialogAction onClick={onDiscard}>Discard changes</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog> }
export function DestructiveActionDialog({ open, onOpenChange, title, description, actionLabel = "Delete", onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; actionLabel?: string; onConfirm: () => void }) { return <AlertDialog open={open} onOpenChange={onOpenChange}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onConfirm}>{actionLabel}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog> }
