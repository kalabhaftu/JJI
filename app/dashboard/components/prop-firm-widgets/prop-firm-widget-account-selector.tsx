"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { DashboardPropFirmAccountOption } from '@/hooks/use-dashboard-prop-firm-account'

const RESET_TIMEZONES = [
  { value: 'UTC', label: 'UTC reset' },
  { value: 'America/New_York', label: 'NY reset' },
  { value: 'Europe/London', label: 'London reset' },
]

type Props = {
  accounts: DashboardPropFirmAccountOption[]
  selectedMasterAccountId: string | null
  onChange: (value: string) => void
  isLoading?: boolean
  className?: string
}

type TimezoneProps = {
  value: string
  onChange: (value: string) => void
}

function getLabel(account: DashboardPropFirmAccountOption) {
  const phase = account.currentPhase ? `Phase ${account.currentPhase}` : 'No current phase'
  const currentPhase = account.PhaseAccount?.find((p) => p.phaseNumber === account.currentPhase)
  const isPhaseFailed = String(currentPhase?.status || '').toLowerCase() === 'failed'
  const isFailed = String(account.status || '').toLowerCase() === 'failed' || isPhaseFailed
  const suffix = isFailed ? ' (Blown)' : ''
  return `${account.accountName || account.propFirmName} · ${phase}${suffix}`
}

export function PropFirmWidgetTimezoneSelector({ value, onChange }: TimezoneProps) {
  return (
    <Select value={value || 'UTC'} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-[8.5rem] rounded-lg border-border/40 bg-muted/15 text-xs">
        <SelectValue placeholder="UTC reset" />
      </SelectTrigger>
      <SelectContent>
        {RESET_TIMEZONES.map((timezone) => (
          <SelectItem key={timezone.value} value={timezone.value}>
            {timezone.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function PropFirmWidgetAccountSelector({ accounts, selectedMasterAccountId, onChange, isLoading, className }: Props) {
  if (isLoading) {
    return <Skeleton className="h-8 w-44 rounded-lg bg-muted/30" />
  }

  if (accounts.length === 0) {
    return <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">No prop firm accounts</span>
  }

  if (accounts.length === 1) {
    return (
      <span className="max-w-[15rem] truncate rounded-lg border border-border/40 bg-muted/20 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {getLabel(accounts[0]!)}
      </span>
    )
  }

  return (
    <Select {...(selectedMasterAccountId ? { value: selectedMasterAccountId } : {})} onValueChange={onChange}>
      <SelectTrigger className={cn('h-8 w-[15rem] rounded-lg border-border/40 bg-muted/15 text-xs', className)}>
        <SelectValue placeholder="Choose challenge" />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            {getLabel(account)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
