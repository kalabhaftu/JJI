import { Brain, CalendarDays, Check, Database, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PromptBox } from '@/components/ui/ai-prompt-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { analysisTemplates, dataSourceOptions } from '../ai-config'
import type { WorkspaceAccount } from '../types'

interface ContextComposerProps {
  accounts: WorkspaceAccount[]
  selectedAccounts: string[]
  selectedDateRange: string
  customFromDate: string
  customToDate: string
  selectedSources: string[]
  isSending: boolean
  onAccountToggle: (id: string) => void
  onSelectAllAccounts: () => void
  onClearAccounts: () => void
  onDateRangeChange: (value: string) => void
  onCustomFromDateChange: (value: string) => void
  onCustomToDateChange: (value: string) => void
  onSourceToggle: (id: string) => void
  onSubmit: (prompt: string, sourceOverride?: string[]) => void
}

export function ContextComposer({
  accounts,
  selectedAccounts,
  selectedDateRange,
  customFromDate,
  customToDate,
  selectedSources,
  isSending,
  onAccountToggle,
  onSelectAllAccounts,
  onClearAccounts,
  onDateRangeChange,
  onCustomFromDateChange,
  onCustomToDateChange,
  onSourceToggle,
  onSubmit,
}: ContextComposerProps) {
  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col px-4 py-8 sm:px-8 lg:py-12">
        <header className="max-w-2xl">
          <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Brain className="h-5 w-5" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">JJI intelligence</p>
          <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Turn your trading history into a focused next action.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Choose the evidence the assistant may use, then ask a direct question. Every response should connect a claim to your selected data.</p>
        </header>

        <section aria-labelledby="analysis-context" className="mt-8 border-y border-border/70 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="analysis-context" className="mr-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Analysis context</h2>
            <AccountPicker accounts={accounts} selected={selectedAccounts} onToggle={onAccountToggle} onAll={onSelectAllAccounts} onClear={onClearAccounts} />
            <Select value={selectedDateRange} onValueChange={onDateRangeChange}>
              <SelectTrigger aria-label="Analysis period" className="h-10 w-auto min-w-40 rounded-xl bg-[hsl(var(--surface-raised))]">
                <CalendarDays className="h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-time">All time</SelectItem>
                <SelectItem value="last-7-days">Last 7 days</SelectItem>
                <SelectItem value="last-30-days">Last 30 days</SelectItem>
                <SelectItem value="last-90-days">Last 90 days</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
            <SourcePicker selected={selectedSources} onToggle={onSourceToggle} />
          </div>

          {selectedDateRange === 'custom' && (
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <DateField label="From" value={customFromDate} onChange={onCustomFromDateChange} />
              <DateField label="To" value={customToDate} onChange={onCustomToDateChange} />
            </div>
          )}
        </section>

        <section aria-labelledby="starting-points" className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 id="starting-points" className="text-lg font-semibold text-foreground">Starting points</h2>
              <p className="mt-1 text-sm text-muted-foreground">Use a structured audit or write your own question.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70 sm:grid-cols-2">
            {analysisTemplates.slice(0, 4).map((template) => {
              const Icon = template.icon
              return (
                <button
                  key={template.id}
                  type="button"
                  disabled={isSending}
                  onClick={() => onSubmit(template.prompt, template.dataSources)}
                  className="group flex min-h-28 items-start gap-4 bg-[hsl(var(--surface-raised))] p-5 text-left transition-colors hover:bg-[hsl(var(--surface-subtle))] disabled:opacity-50"
                >
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground"><Icon className="h-4 w-4" /></span>
                  <span>
                    <span className="block text-sm font-semibold text-foreground">{template.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{template.description}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <div className="sticky bottom-0 mt-auto bg-gradient-to-t from-background via-background to-transparent pt-8">
          <PromptBox onSubmit={(prompt) => onSubmit(prompt)} placeholder="Ask about performance, risk, discipline, or a specific setup…" disabled={isSending} />
          <p className="mt-2 text-center text-[11px] text-muted-foreground">AI analysis can be wrong. Verify decisions against your source records.</p>
        </div>
      </div>
    </div>
  )
}

function AccountPicker({ accounts, selected, onToggle, onAll, onClear }: { accounts: WorkspaceAccount[]; selected: string[]; onToggle: (id: string) => void; onAll: () => void; onClear: () => void }) {
  const label = selected.length === 0 ? 'Choose accounts' : selected.length === accounts.length ? 'All accounts' : `${selected.length} account${selected.length === 1 ? '' : 's'}`
  return (
    <Popover>
      <PopoverTrigger asChild><Button variant="outline"><SlidersHorizontal /> {label}</Button></PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        <div className="flex items-center justify-between border-b border-border/70 px-2 pb-2">
          <p className="text-xs font-semibold">Accounts</p>
          <div className="flex gap-1"><Button variant="ghost" size="sm" onClick={onAll}>All</Button><Button variant="ghost" size="sm" onClick={onClear}>Clear</Button></div>
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {accounts.length === 0 ? <p className="p-4 text-center text-xs text-muted-foreground">No connected accounts.</p> : accounts.map((account) => {
            const checked = selected.includes(account.id)
            return (
              <button key={account.id} type="button" onClick={() => onToggle(account.id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted">
                <Checkbox checked={checked} tabIndex={-1} aria-hidden />
                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{account.displayName || account.name || account.number || 'Account'}</span><span className="block truncate text-[10px] text-muted-foreground">{account.propfirm || account.broker || 'Live broker'}</span></span>
                {checked && <Check className="h-3.5 w-3.5" />}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function SourcePicker({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild><Button variant="outline"><Database /> {selected.length} data sources</Button></PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <p className="px-2 pb-2 text-xs font-semibold">Evidence sources</p>
        {dataSourceOptions.map((source) => (
          <button key={source.id} type="button" onClick={() => onToggle(source.id)} className={cn('flex w-full items-center justify-between rounded-lg px-2 py-2 text-xs hover:bg-muted', selected.includes(source.id) && 'font-semibold')}>
            {source.label}{selected.includes(source.id) && <Check className="h-3.5 w-3.5" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="space-y-1 text-xs font-semibold text-muted-foreground"><span className="block">{label}</span><input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-xl border border-border bg-[hsl(var(--surface-raised))] px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" /></label>
}
