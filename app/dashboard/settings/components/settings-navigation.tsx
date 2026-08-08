"use client"

import React from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import type { HugeiconsIconProps } from '@hugeicons/react'
import { MagicTab } from "@/components/godui/magic-tab"
import { emitTourEvent } from '@/lib/tours/events'

export type SettingsSectionId = "profile" | "preferences" | "integrations" | "connections" | "security" | "help"

export function SettingsNavigation({ categories, value, onValueChange }: { categories: Array<{ id: SettingsSectionId; label: string; icon: HugeiconsIconProps['icon'] }>; value: SettingsSectionId; onValueChange: (value: SettingsSectionId) => void }) {
  const [isDesktop, setIsDesktop] = React.useState<boolean>(false)

  React.useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)')
    const handleChange = () => setIsDesktop(mql.matches)
    handleChange()
    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [])

  return <MagicTab
    aria-label="Settings sections"
    className="w-full justify-start overflow-x-auto md:w-64 md:flex-col md:items-stretch"
    value={value}
    onValueChange={(next) => {
      onValueChange(next as SettingsSectionId)
      emitTourEvent(`settings.tab.${next}`)
    }}
    orientation={isDesktop ? "vertical" : "horizontal"}
    rainbow={false}
    items={categories.map((category) => ({
      value: category.id,
      label: (
        <span data-tour={`settings-tab-${category.id}`} className="flex items-center gap-2">
          <HugeiconsIcon icon={category.icon} className="size-4" aria-hidden strokeWidth={2} />
          {category.label}
        </span>
      ),
    }))}
  />
}