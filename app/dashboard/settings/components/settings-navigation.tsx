"use client"

import type { LucideIcon } from "lucide-react"
import { MagicTab } from "@/components/godui/magic-tab"

export type SettingsSectionId = "profile" | "preferences" | "integrations" | "connections" | "security" | "help"

export function SettingsNavigation({ categories, value, onValueChange }: { categories: Array<{ id: SettingsSectionId; label: string; icon: LucideIcon }>; value: SettingsSectionId; onValueChange: (value: SettingsSectionId) => void }) {
  return <MagicTab
    aria-label="Settings sections"
    className="w-full justify-start overflow-x-auto md:w-64 md:flex-col md:items-stretch"
    value={value}
    onValueChange={(next) => onValueChange(next as SettingsSectionId)}
    orientation="vertical"
    rainbow={false}
    items={categories.map((category) => ({ value: category.id, label: <span className="flex items-center gap-2"><category.icon className="size-4" aria-hidden />{category.label}</span> }))}
  />
}
