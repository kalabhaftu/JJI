"use client"

import { MagicTab } from "@/components/godui/magic-tab"

export type ReportTab = "overview" | "spreadsheet" | "statement" | "propfirm"

export function ReportsNavigation({ value, onValueChange }: { value: ReportTab; onValueChange: (value: ReportTab) => void }) {
  return <MagicTab
    aria-label="Report views"
    className="w-full justify-start overflow-x-auto sm:justify-center"
    value={value}
    onValueChange={(next) => onValueChange(next as ReportTab)}
    rainbow={false}
    items={[
      { value: "overview", label: "Overview" },
      { value: "spreadsheet", label: "Spreadsheet" },
      { value: "statement", label: "Statement" },
      { value: "propfirm", label: "Prop Firm" },
    ]}
  />
}
