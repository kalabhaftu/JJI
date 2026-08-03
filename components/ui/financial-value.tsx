import * as React from "react"

import { cn } from "@/lib/utils"

export type FinancialDataQuality = "current" | "estimated" | "delayed" | "incomplete" | "stale" | "unavailable"
export type FinancialValueKind = "currency" | "pnl" | "percentage" | "points" | "ticks" | "quantity" | "fees" | "commission" | "drawdown" | "risk-reward"

export interface FinancialValueProps {
  kind: FinancialValueKind
  value: number | null | undefined
  currency?: string
  locale?: string
  unit?: string
  explicitSign?: boolean
  quality?: FinancialDataQuality
  label?: string
  description?: string
  className?: string
}

const qualityLabels: Record<FinancialDataQuality, string> = {
  current: "Current",
  estimated: "Estimated",
  delayed: "Delayed",
  incomplete: "Incomplete",
  stale: "Stale",
  unavailable: "Unavailable",
}

function formatValue({ kind, value, currency = "USD", locale = "en-US", unit, explicitSign }: FinancialValueProps): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Unavailable"

  const sign = explicitSign && value > 0 ? "+" : ""
  if (["currency", "pnl", "fees", "commission", "drawdown"].includes(kind)) {
    return `${sign}${new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`
  }
  if (kind === "percentage") return `${sign}${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)}%`
  if (kind === "risk-reward") return `${sign}${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)}:1`
  return `${sign}${new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(value)}${unit ? ` ${unit}` : kind === "points" ? " pts" : kind === "ticks" ? " ticks" : ""}`
}

export function FinancialValue(props: FinancialValueProps): React.ReactElement {
  const { value, quality = value == null ? "unavailable" : "current", label, description, className } = props
  const tone = value == null || value === 0
    ? "text-financial-neutral"
    : value > 0
      ? "text-financial-profit"
      : "text-financial-loss"
  const qualityLabel = qualityLabels[quality]

  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-1 font-mono tabular-nums", tone, className)} aria-label={[label, formatValue(props), quality !== "current" ? qualityLabel : null, description].filter(Boolean).join(", ")}>
      <span>{formatValue(props)}</span>
      {quality !== "current" && <span className="font-sans text-xs font-medium text-muted-foreground">{qualityLabel}</span>}
    </span>
  )
}
