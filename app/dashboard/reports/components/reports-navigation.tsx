"use client"

import { MagicTab } from "@/components/godui/magic-tab"
import { emitTourEvent } from '@/lib/tours/events'

export type ReportTab = "overview" | "spreadsheet" | "statement" | "propfirm"

export function ReportsNavigation({ value, onValueChange }: { value: ReportTab; onValueChange: (value: ReportTab) => void }) {
  return <MagicTab
    aria-label="Report views"
    className="w-full justify-start overflow-x-auto sm:justify-center"
    value={value}
    onValueChange={(next) => {
      const tab = next as ReportTab
      onValueChange(tab)
      emitTourEvent(`reports.tab.${tab}`)
    }}
    rainbow={false}
    items={[
      { value: "overview", label: "Overview", dataTour: "reports-tab-overview" },
      { value: "spreadsheet", label: "Spreadsheet", dataTour: "reports-tab-spreadsheet" },
      { value: "statement", label: "Statement", dataTour: "reports-tab-statement" },
      { value: "propfirm", label: "Prop Firm", dataTour: "reports-tab-propfirm" },
    ]}
  />
}
