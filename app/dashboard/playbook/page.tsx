'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { formatNoteContent } from '@/lib/content/cleaning'
import { formatCurrency } from '@/lib/trading/trade-formatting'
import { motion } from 'framer-motion'
import { HugeiconsIcon } from '@hugeicons/react'
import { EyeIcon, File01Icon, MoreVerticalIcon, PencilEdit01Icon, Add01Icon, Delete02Icon, Calendar01Icon } from '@hugeicons/core-free-icons'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { apiRequest } from '@/lib/api/client'
import { reportClientError } from '@/lib/observability/report-error'
import { queryKeyPrefixes } from '@/lib/query/query-keys'
import { useQueryScope } from '@/lib/query/use-query-scope'
import { AddEditModelModal } from './components/add-edit-model-modal'
import { useTradingModels } from '@/hooks/use-trading-models'
import { useQueryClient } from '@tanstack/react-query'
import { PlaybookCardsSkeleton } from './components/playbook-page-skeleton'
import { classifyOutcome, getBreakEvenThreshold } from '@/lib/metrics/outcome'
import { useData } from '@/context/data-provider'
import { PageHeader } from '@/components/ui/page-header'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CustomDateRangePicker } from '@/components/ui/custom-date-range-picker'
import { DateRange } from 'react-day-picker'
import { format } from 'date-fns'

interface TradingModel {
  id: string
  name: string
  rules: any[]
  setups?: string[]
  notes?: string | null
  createdAt: string
  updatedAt: string
  stats?: {
    tradeCount: number
    totalPnL: number
    winRate: number
    winCount: number
    lossCount: number
    breakEvenCount: number
    avgAdherence: number
    ruleAdherence: Record<string, { followed: number; total: number }>
  }
}

function StrategyBlock({
  model,
  onView,
  onEdit,
  onDelete,
  breakEvenThreshold
}: {
  model: TradingModel
  onView: (m: TradingModel) => void
  onEdit: (m: TradingModel) => void
  onDelete: (id: string) => void
  breakEvenThreshold: number
}) {
  const winRate = model.stats?.winRate || 0
  const pnl = model.stats?.totalPnL || 0
  const isProfit = classifyOutcome(pnl, breakEvenThreshold) === 'win'
  const isLoss = classifyOutcome(pnl, breakEvenThreshold) === 'loss'

  return (
    <div className="group relative flex h-full flex-col rounded-[24px] border border-border/28 bg-card/68 p-5 transition-all hover:border-border/42 hover:bg-card/82">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold tracking-tight truncate">{model.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-tighter border-primary/20 bg-primary/5 text-primary">
              {model.rules.length} Rules Defined
            </Badge>
            <span className="text-[10px] text-muted-foreground/50 font-bold uppercase tracking-widest">
              {model.stats?.tradeCount || 0} Trades logged
            </span>
          </div>
          {model.setups && model.setups.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {model.setups.map((setup: string, i: number) => (
                <Badge key={i} variant="outline" className="text-[9px] font-bold uppercase tracking-tighter border-primary/15 bg-primary/5 text-primary/80 px-2 py-0">
                  {setup}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="icon-only" size="icon" className="h-11 w-11 -mr-2" aria-label="Strategy options">
              <HugeiconsIcon icon={MoreVerticalIcon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-background border-border/40">
            <DropdownMenuItem onClick={() => onView(model)} className="text-xs font-bold uppercase">
              <HugeiconsIcon icon={EyeIcon} className="mr-2 h-3.5 w-3.5" strokeWidth={1.5} color="currentColor" /> View Strategy
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(model)} className="text-xs font-bold uppercase">
              <HugeiconsIcon icon={PencilEdit01Icon} className="mr-2 h-3.5 w-3.5" strokeWidth={1.5} color="currentColor" /> Modify Rules
            </DropdownMenuItem>
            <DropdownMenuSeparator className="opacity-40" />
            <DropdownMenuItem onClick={() => onDelete(model.id)} className="text-xs font-bold uppercase text-short focus:text-short">
              <HugeiconsIcon icon={Delete02Icon} className="mr-2 h-3.5 w-3.5" strokeWidth={1.5} color="currentColor" /> Remove Model
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3">
        <div>
          <span className="text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground/60 block mb-1">Win Rate</span>
          <div className="flex items-baseline gap-1.5">
            <span className={cn(
              "text-xl font-bold tracking-tight",
              winRate >= 50 ? "text-long" : winRate > 0 ? "text-warning" : "text-muted-foreground"
            )}>
              {winRate.toFixed(1)}%
            </span>
          </div>
        </div>
        <div>
          <span className="text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground/60 block mb-1">Total P/L</span>
          <span className={cn(
            "text-xl font-bold tracking-tight",
            isProfit ? "text-long" : isLoss ? "text-short" : "text-muted-foreground"
          )}>
            {isProfit ? '+' : ''}${pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="col-span-2 md:col-span-1 md:pt-0">
          <span className="text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground/60 block mb-1">Adherence</span>
          <span className={cn(
            "text-lg font-bold tracking-tight",
            (model.stats?.avgAdherence || 0) >= 80 ? "text-primary" : (model.stats?.avgAdherence || 0) >= 50 ? "text-warning" : "text-short"
          )}>
            {model.stats?.avgAdherence?.toFixed(0) || '0'}%
          </span>
        </div>
        <div>
          <span className="text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground/60 block mb-1">Avg P&amp;L / Trade</span>
          {(model.stats?.tradeCount || 0) > 0 ? (
            <span className={cn(
              "text-xl font-bold tracking-tight",
              (model.stats?.totalPnL || 0) >= 0 ? "text-long" : "text-short"
            )}>
              {(model.stats?.totalPnL || 0) >= 0 ? '+' : ''}${((model.stats?.totalPnL || 0) / model.stats!.tradeCount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          ) : (
            <span className="text-xl font-bold tracking-tight text-muted-foreground">-</span>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-border/12 pt-4">
        {model.notes ? (
          <div className="line-clamp-2 whitespace-pre-wrap text-[11px] font-medium leading-relaxed text-muted-foreground/85">
            {formatNoteContent(model.notes)}
          </div>
        ) : (
          <p className="text-[11px] font-medium leading-relaxed text-muted-foreground/55">
            Rules are defined, but no model note is attached yet.
          </p>
        )}
      </div>
    </div>
  )
}

export default function PlaybookPage() {
  const { statistics, accounts } = useData()
  const [playbookAccountFilter, setPlaybookAccountFilter] = useState<string>('__all__')
  const [playbookDateRange, setPlaybookDateRange] = useState<DateRange | undefined>(undefined)
  const activeAccounts = useMemo(() => accounts.filter((account: any) => !account.isArchived), [accounts])
  const playbookAccountNumbers = useMemo(() => {
    if (playbookAccountFilter === '__all__') return []
    return [playbookAccountFilter]
  }, [playbookAccountFilter])
  const tradingModelFilters = useMemo(() => ({
    ...(playbookAccountNumbers.length > 0 && { accounts: playbookAccountNumbers }),
    ...(playbookDateRange?.from && { dateFrom: playbookDateRange.from.toISOString() }),
    ...(playbookDateRange?.to && { dateTo: playbookDateRange.to.toISOString() }),
  }), [playbookAccountNumbers, playbookDateRange])
  const queryClient = useQueryClient()
  const scope = useQueryScope()
  const { tradingModels: fetchedModels, isLoading } = useTradingModels(tradingModelFilters)
  const breakEvenThreshold = getBreakEvenThreshold(statistics?.breakEvenThreshold)
  const models = useMemo(() => (fetchedModels || []) as TradingModel[], [fetchedModels])
  const dateRangeLabel = playbookDateRange?.from
    ? playbookDateRange.to
      ? `${format(playbookDateRange.from, 'MMM d')} - ${format(playbookDateRange.to, 'MMM d, yyyy')}`
      : `From ${format(playbookDateRange.from, 'MMM d, yyyy')}`
    : 'Date range'
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [selectedModel, setSelectedModel] = useState<TradingModel | null>(null)
  const [deleteModelId, setDeleteModelId] = useState<string | null>(null)
  const [viewModel, setViewModel] = useState<TradingModel | null>(null)
  const playbookStats = useMemo(() => {
    const totalTrades = models.reduce((sum, model) => sum + (model.stats?.tradeCount || 0), 0)
    const avgAdherence = models.length
      ? models.reduce((sum, model) => sum + (model.stats?.avgAdherence || 0), 0) / models.length
      : 0

    return {
      totalTrades,
      avgAdherence,
    }
  }, [models])

  const handleAddModel = () => {
    setModalMode('add')
    setSelectedModel(null)
    setIsModalOpen(true)
  }

  const handleEditModel = (model: TradingModel) => {
    setModalMode('edit')
    setSelectedModel(model)
    setIsModalOpen(true)
  }

  const handleSaveModel = async (data: { name: string; rules: any[]; setups?: string[]; notes?: string | null }) => {
    const modelId = selectedModel?.id
    if (modalMode === 'edit' && !modelId) {
      throw new Error('Missing model id for update')
    }

    const url = modalMode === 'add'
      ? '/api/v1/user/trading-models'
      : `/api/v1/user/trading-models/${modelId}`

    await apiRequest(url, {
      method: modalMode === 'add' ? 'POST' : 'PATCH',
      body: JSON.stringify(data),
      retry: { mode: 'never' },
      operation: modalMode === 'add' ? 'create-trading-model' : 'update-trading-model',
    })

    await queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.playbook(scope) })
  }

  const handleDeleteModel = async () => {
    if (!deleteModelId) return
    try {
      await apiRequest(`/api/v1/user/trading-models/${deleteModelId}`, {
        method: 'DELETE',
        retry: { mode: 'never' },
        operation: 'delete-trading-model',
      })
      toast.success('Model removed from playbook')
      await queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.playbook(scope) })
    } catch (error) {
      reportClientError(error, { operation: 'delete-trading-model', route: '/dashboard/playbook' })
      toast.error(error instanceof Error ? error.message : 'Failed to delete model')
    } finally {
      setDeleteModelId(null)
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-6 pb-20 md:pb-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <PageHeader
          title="Strategy Playbook"
          titleClassName="sm:text-3xl"
          className="mb-6"
          actions={
            <Button onClick={handleAddModel} className="h-10 gap-2 px-6 text-xs font-black uppercase tracking-tighter">
              <HugeiconsIcon icon={Add01Icon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />
              Develop New Strategy
            </Button>
          }
        />

        {models.length > 0 && (
          <div className="mb-8 grid gap-3 rounded-[28px] border border-border/20 bg-card/35 p-4 sm:grid-cols-3 sm:p-5">
            <div className="rounded-2xl border border-border/14 bg-background/35 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/55">Models</p>
              <p className="mt-2 text-2xl font-black font-mono tracking-tighter">{models.length}</p>
            </div>
            <div className="rounded-2xl border border-border/14 bg-background/35 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/55">Filtered Trades</p>
              <p className="mt-2 text-2xl font-black font-mono tracking-tighter">{playbookStats.totalTrades}</p>
            </div>
            <div className="rounded-2xl border border-border/14 bg-background/35 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/55">Avg Adherence</p>
              <p className="mt-2 text-2xl font-black font-mono tracking-tighter">{playbookStats.avgAdherence.toFixed(0)}%</p>
            </div>
          </div>
        )}

        <div className="mb-6 flex flex-col gap-3 rounded-[24px] border border-border/20 bg-card/30 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/55">Playbook Range</p>
            <p className="mt-1 text-xs font-bold text-muted-foreground">Stats use the selected account and date range.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select
              value={playbookAccountFilter}
              onValueChange={(value) => setPlaybookAccountFilter(value)}
            >
              <SelectTrigger className="h-9 w-full min-w-[180px] text-xs font-bold sm:w-[220px]">
                <SelectValue placeholder="All accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All accounts</SelectItem>
                {activeAccounts.map((account: any) => {
                  const value = account.accountNumber || account.phaseAccountId || account.id
                  return (
                    <SelectItem key={account.id || value} value={value}>
                      {account.accountName || account.name || value}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="secondary" className="h-9 justify-start gap-2 text-xs font-bold">
                  <HugeiconsIcon icon={Calendar01Icon} className="h-3.5 w-3.5" strokeWidth={1.5} color="currentColor" />
                  {dateRangeLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CustomDateRangePicker
                  {...(playbookDateRange ? { selected: playbookDateRange as any } : {})}
                  onSelect={(range) => {
                    if (range?.from) setPlaybookDateRange({ from: range.from, to: range.to ?? range.from })
                    else setPlaybookDateRange(undefined)
                  }}
                  className="w-fit"
                />
              </PopoverContent>
            </Popover>
            {(playbookAccountFilter !== '__all__' || playbookDateRange?.from || playbookDateRange?.to) && (
              <Button
                variant="tertiary"
                className="h-9 text-xs font-black uppercase tracking-tighter"
                onClick={() => {
                  setPlaybookAccountFilter('__all__')
                  setPlaybookDateRange(undefined)
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <PlaybookCardsSkeleton />
        ) : models.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/40 bg-card/30 py-24">
            <HugeiconsIcon icon={File01Icon} className="h-12 w-12 text-muted-foreground/20 mb-6" strokeWidth={1.5} color="currentColor" />
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-6">No strategies defined</h3>
            <Button onClick={handleAddModel} variant="secondary" className="gap-2 font-black uppercase tracking-tighter text-xs h-9">
              <HugeiconsIcon icon={Add01Icon} className="h-3.5 w-3.5" strokeWidth={1.5} color="currentColor" />
              Initialize First Model
            </Button>
          </div>
        ) : (
          <div className={cn(
            "grid gap-6",
            models.length <= 2
              ? "max-w-5xl grid-cols-1 md:grid-cols-2"
              : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
          )}>
            {models.map((model) => (
              <StrategyBlock
                key={model.id}
                model={model}
                onView={setViewModel}
                onEdit={handleEditModel}
                onDelete={setDeleteModelId}
                breakEvenThreshold={breakEvenThreshold}
              />
            ))}
          </div>
        )}
      </motion.div>

      <AddEditModelModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveModel}
        model={selectedModel}
        mode={modalMode}
      />

      <AlertDialog open={!!deleteModelId} onOpenChange={() => setDeleteModelId(null)}>
        <AlertDialogContent className="bg-background border-border/40">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black uppercase tracking-tighter">Remove Strategy Model</AlertDialogTitle>
            <AlertDialogDescription className="text-xs font-bold">
              Confirm removal of this protocol from your playbook. Existing trades will retain their historical validation but will lose the live link to this model.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-black uppercase tracking-tighter text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteModel}
              className="bg-short text-white hover:bg-short/90 font-black uppercase tracking-tighter text-xs"
            >
              Verify Deletion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!viewModel} onOpenChange={() => setViewModel(null)}>
        <AlertDialogContent className="max-w-2xl bg-background border-border/28">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black tracking-tighter uppercase">{viewModel?.name}</AlertDialogTitle>
            <AlertDialogDescription className="text-xs font-bold text-muted-foreground">
              Review strategy performance metrics and playbook execution protocols.
            </AlertDialogDescription>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Strategy Performance</span>
                <span className={cn(
                  "text-sm font-bold",
                  (viewModel?.stats?.winRate || 0) >= 50 ? "text-long" : "text-short"
                )}>
                  {viewModel?.stats?.winRate?.toFixed(1) || '0.0'}% Win Rate
                </span>
              </div>
              <div className="w-px h-8 bg-border/40" />
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Total Profitability</span>
                <span className={cn(
                  "text-sm font-bold",
                  classifyOutcome(viewModel?.stats?.totalPnL || 0, breakEvenThreshold) === 'win'
                    ? "text-long"
                    : classifyOutcome(viewModel?.stats?.totalPnL || 0, breakEvenThreshold) === 'loss'
                      ? "text-short"
                      : "text-muted-foreground"
                )}>
                  ${viewModel?.stats?.totalPnL?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                </span>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="space-y-6">
            {viewModel?.rules && viewModel.rules.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {(['entry', 'target', 'confirmation', 'confluence', 'exit', 'risk', 'general'] as const).map(cat => {
                  const catRules = viewModel.rules.filter((r: any) =>
                    (typeof r === 'string' && cat === 'general') ||
                    (typeof r === 'object' && r.category === cat)
                  )
                  if (catRules.length === 0) return null

                  return (
                    <div key={cat} className="space-y-3">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        {cat === 'general' ? 'General' : cat} Protocols
                      </h4>
                      <ul className="space-y-2">
                        {catRules.map((rule: any, i) => {
                          const text = typeof rule === 'string' ? rule : rule.text
                          const adherence = viewModel.stats?.ruleAdherence?.[text]
                          const rate = adherence && adherence.total > 0 ? (adherence.followed / adherence.total) * 100 : 0

                          return (
                            <li key={i} className="flex items-center justify-between group p-2 hover:bg-muted/10 rounded-lg transition-colors">
                              <div className="flex items-start gap-2 max-w-[70%]">
                                <span className="mt-1.5 w-1 h-1 rounded-full bg-border shrink-0" />
                                <span className="text-xs font-bold text-muted-foreground/90 leading-tight group-hover:text-foreground">
                                  {text}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="h-1 w-12 bg-muted/40 rounded-full overflow-hidden">
                                  <div
                                    className={cn("h-full transition-all duration-1000", rate >= 80 ? "bg-primary" : rate >= 50 ? "bg-warning" : "bg-short")}
                                    style={{ width: `${rate}%` }}
                                  />
                                </div>
                                <span className={cn(
                                  "text-[9px] font-black tabular-nums min-w-[24px] text-right",
                                  rate >= 80 ? "text-primary" : rate >= 50 ? "text-warning" : "text-short"
                                )}>
                                  {rate.toFixed(0)}%
                                </span>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )
                })}
              </div>
            )}

            {viewModel?.notes && (
              <div className="pt-6 border-t border-border/40">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70 mb-3">Model Analysis & Notes</h4>
                <div className="text-xs text-muted-foreground italic leading-relaxed bg-muted/20 p-4 rounded-xl border border-border/10 whitespace-pre-wrap">
                  {formatNoteContent(viewModel.notes)}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-6 border-t border-border/40 opacity-40">
              <span className="text-[9px] font-black uppercase tracking-widest">Initialization: {new Date(viewModel?.createdAt || '').toLocaleDateString()}</span>
              <span className="text-[9px] font-black uppercase tracking-widest">Last Update: {new Date(viewModel?.updatedAt || '').toLocaleDateString()}</span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setViewModel(null)} className="font-black uppercase tracking-tighter text-xs">
              Close analysis
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
