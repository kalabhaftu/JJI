"use client"

import { cn } from "@/lib/utils"

/** Restrained Aceternity-style spotlight surface; decorative and theme-token driven. */
export function Spotlight({ className }: { className?: string }) {
  return <div aria-hidden className={cn("pointer-events-none absolute inset-x-0 top-0 h-24 opacity-25 [background:radial-gradient(ellipse_at_top,hsl(var(--primary)/.18),transparent_68%)] motion-reduce:opacity-10", className)} />
}
