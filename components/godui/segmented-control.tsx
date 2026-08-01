"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type SegmentedControlItem = { value: string; label: ReactNode; disabled?: boolean }

export function SegmentedControl({ items, value, onValueChange, className }: { items: SegmentedControlItem[]; value?: string | undefined; onValueChange: (value: string) => void; className?: string | undefined }) {
  return <div role="group" className={cn("flex items-center gap-1 rounded-lg bg-muted/60 p-1", className)}>{items.map((item) => <button key={item.value} type="button" disabled={item.disabled} aria-pressed={value === item.value} onClick={() => onValueChange(item.value)} className={cn("min-h-9 rounded-md px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none", value === item.value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-background/70 hover:text-foreground")}>{item.label}</button>)}</div>
}
