import * as React from "react"

import { formatFinancialValue, type FinancialDataQuality, type FinancialValueKind } from "@/lib/formatting/financial-value"
import { cn } from "@/lib/utils"

export type { FinancialDataQuality, FinancialValueKind }

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

export function FinancialValue(props: FinancialValueProps): React.ReactElement {
  const { value, quality = value == null ? "unavailable" : "current", label, description, className } = props
  const isAvailable = value != null && Number.isFinite(value) && quality !== "unavailable"
  const displayValue = isAvailable ? formatFinancialValue(value, props) : "Unavailable"
  const tone = !isAvailable || value === 0
    ? "text-financial-neutral"
    : value > 0
      ? "text-financial-profit"
      : "text-financial-loss"
  const qualityLabel = qualityLabels[quality]

  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-1 font-mono tabular-nums", tone, className)} aria-label={[label, displayValue, quality !== "current" && quality !== "unavailable" ? qualityLabel : null, description].filter(Boolean).join(", ")}>
      <span>{displayValue}</span>
      {quality !== "current" && quality !== "unavailable" && <span className="font-sans text-xs font-medium text-muted-foreground">{qualityLabel}</span>}
    </span>
  )
}
