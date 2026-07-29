"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** JJI-owned GodUI filter surface: composable, responsive, and token-only. */
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("no-export flex flex-wrap items-center gap-2.5 border-y border-border/25 py-3", className)}>{children}</div>
}

export function FilterBarGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex min-w-0 items-center gap-2", className)}>{children}</div>
}
