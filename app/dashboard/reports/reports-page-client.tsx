'use client'

import dynamic from 'next/dynamic'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table'
import { useData } from '@/context/data-provider'
import { formatTimeInZone } from '@/lib/time-utils'
import { cn } from '@/lib/utils'
import { classifyTrade } from '@/lib/trading/trade-formatting'
import {
    Zap,
    Share2,
    Target,
    TrendingUp,
    Building2,
    Clock,
    List,
    Table as TableIcon,
    Download,
    FileText,
    Image as ImageIcon,
    LayoutDashboard,
    AlertCircle,
    Link as LinkIcon,
    Settings
} from 'lucide-react'
import { SharedLinksManager } from './components/shared-links-manager'
import {
    format,
    endOfDay
} from 'date-fns'
import { useEffect, useCallback } from 'react'
import { useUserStore } from '@/store/user-store'
import { getPnlDisplayLabel, getTradeNetPnl, getTradePnlByMode, normalizePnlDisplayMode } from '@/lib/metrics/pnl'
import { toast } from 'sonner'
import { ReportFilters } from './components/report-filters'
import { useReportStats } from '@/hooks/use-report-stats'
import type { ReportStatsResponse } from '@/lib/statistics/report-statistics'
import type { PropFirmSummaryDTO } from '@/lib/statistics/propfirm-statistics'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '@/components/ui/tooltip'
import { PropFirmReportsSkeleton, ReportsContentSkeleton } from './components/reports-page-skeleton'
import { PageHeader } from '@/components/ui/page-header'
import { useReportPageController } from './use-report-page-controller'
import { ReportsNavigation } from './components/reports-navigation'
import { ReportsSessionSummary } from './components/reports-session-summary'
import { reportClientError } from '@/lib/observability/report-error'

const DiverseCharts = dynamic(() => import('./components/diverse-charts').then((mod) => mod.DiverseCharts))
const MonthlyReturnsMatrix = dynamic(() => import('./components/monthly-returns-matrix').then((mod) => mod.MonthlyReturnsMatrix))
const InstrumentBreakdown = dynamic(() => import('./components/instrument-breakdown').then((mod) => mod.InstrumentBreakdown))
const TradeDurationChart = dynamic(() => import('./components/trade-duration-chart').then((mod) => mod.TradeDurationChart))
const TimeOfDayHeatmap = dynamic(() => import('./components/time-of-day-heatmap').then((mod) => mod.TimeOfDayHeatmap))
const MaeMfeScatter = dynamic(() => import('./components/mae-mfe-scatter').then((mod) => mod.MaeMfeScatter))
const CommissionAnalysis = dynamic(() => import('./components/commission-analysis').then((mod) => mod.CommissionAnalysis))
const StatementView = dynamic(() => import('./components/statement-view').then((mod) => mod.StatementView))
const PerformanceCard = dynamic(() => import('./components/performance-card').then((mod) => mod.PerformanceCard))
const PropFirmTab = dynamic(() => import('./components/propfirm-tab').then((mod) => mod.PropFirmTab))
const RMultipleDistributionChart = dynamic(
    () => import('./components/r-multiple-distribution-chart').then((mod) => mod.RMultipleDistributionChart),
)

interface ReportsPageClientProps {
    initialReportData?: ReportStatsResponse | null
    initialReportKey?: string
    initialPropFirmData?: PropFirmSummaryDTO | null
}

export default function ReportsPageClient({
    initialReportData,
    initialReportKey,
    initialPropFirmData,
}: ReportsPageClientProps) {
    const { accounts } = useData()
    const user = useUserStore(state => state.user)
    const pnlDisplayMode = normalizePnlDisplayMode(user?.pnlDisplayMode)

    const {
        selectedAccountId,
        setSelectedAccountId,
        dateRange,
        setDateRange,
        selectedTab,
        setSelectedTab,
        isExporting,
        setIsExporting,
        activePreset,
        advancedFilters,
        filterArgs,
        periodLabel,
        handlePresetSelect,
        handleFilterChange,
    } = useReportPageController()

    // SERVER-SIDE: Use React Query hook instead of client-side fetching + useMemo
    const { data: reportData, isLoading } = useReportStats(filterArgs, true, {
        ...(initialReportData !== undefined && { initialData: initialReportData as any }),
        ...(initialReportKey !== undefined && { initialDataKey: initialReportKey })
    })

    // Extract server-computed data
    const tradingActivity = reportData?.tradingActivity ?? null
    const psychMetrics = reportData?.psychMetrics ?? null
    const sessionPerformance = reportData?.sessionPerformance ?? null
    const rMultipleDistribution = reportData?.rMultipleDistribution ?? null
    const rMultipleDataQuality = reportData?.rMultipleDataQuality ?? null

    const filteredTrades = reportData?.filteredTrades ?? []
    const filterOptions = reportData?.filterOptions ?? {
        symbols: [],
        sessions: [],
        outcomes: [],
        strategies: []
    }

    // Export metrics as CSV spreadsheet
    const handleExportCSV = useCallback(() => {
        if (!tradingActivity || !psychMetrics) {
            toast.error('No metrics to export')
            return
        }

        setIsExporting(true)
        try {
            const rows: [string, string | number][] = [
                // Performance
                ['--- PERFORMANCE ---', ''],
                ['Net P&L', psychMetrics.totalNetPnL],
                ['Win Rate (%)', tradingActivity.winRate],
                ['Profit Factor', psychMetrics.profitFactor],
                ['Expectancy ($)', psychMetrics.expectancy],
                ['Max Drawdown ($)', psychMetrics.maxDrawdown],
                ['Total R Multiple', psychMetrics.totalRMultiple],
                ['Peak Equity ($)', psychMetrics.peakEquity],
                ['Recovery Factor', psychMetrics.recoveryFactor],
                ['R:R Efficiency', psychMetrics.rrEfficiency],
                ['Consistency Score (%)', psychMetrics.consistencyScore],
                // Trading Activity
                ['', ''],
                ['--- TRADING ACTIVITY ---', ''],
                ['Total Trades', tradingActivity.totalTrades],
                ['Trading Days Active', tradingActivity.tradingDaysActive],
                ['Avg Trades / Month', tradingActivity.avgTradesPerMonth],
                ['Longest Win Streak', psychMetrics.longestWinStreak],
                ['Longest Lose Streak', psychMetrics.longestLoseStreak],
                ['Avg Win ($)', psychMetrics.avgWin],
                ['Avg Loss ($)', psychMetrics.avgLoss],
                ['Avg Holding Time', psychMetrics.avgHoldingTime],
                // Best / Worst
                ['', ''],
                ['--- BEST & WORST ---', ''],
                ['Most Traded Day', tradingActivity.mostTradedDay || '-'],
                ['Most Profitable Day', tradingActivity.mostProfitableDay || '-'],
                ['Most Profitable Instrument', tradingActivity.mostProfitablePair || '-'],
                ['Most Losing Day', tradingActivity.mostLosingDay || '-'],
                ['Most Losing Instrument', tradingActivity.mostLosingPair || '-'],
            ]

            const csvContent = [
                '"Metric","Value"',
                ...rows.map(([label, value]) => `"${label}","${value}"`)
            ].join('\n')

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `jji-metrics-${format(new Date(), 'yyyy-MM-dd')}.csv`
            a.style.display = 'none'
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            toast.success('Metrics exported successfully!')
        } catch (err) {
            reportClientError(err, { operation: 'export-report-metrics', route: '/dashboard/reports' })
            toast.error('Failed to export metrics')
        } finally {
            setIsExporting(false)
        }
    }, [setIsExporting, tradingActivity, psychMetrics])

    // Screenshot page snapshot
    const handlePageSnapshot = useCallback(async () => {
        const element = document.getElementById('report-content')
        if (!element) return

        setIsExporting(true)
        try {
            const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--background').trim()
            const resolvedBg = bgColor ? `hsl(${bgColor})` : '#0d0d0d'
            const rect = element.getBoundingClientRect()
            const dpr = window.devicePixelRatio || 1

            const html2canvas = (await import('html2canvas')).default
            const canvas = await html2canvas(element, {
                scale: Math.max(dpr, 2),
                backgroundColor: resolvedBg,
                useCORS: true,
                logging: false,
                windowWidth: Math.round(rect.width),
                windowHeight: Math.round(rect.height),
                onclone: (_clonedDoc: Document, clonedContent: HTMLElement) => {
                    clonedContent.style.width = `${rect.width}px`
                    clonedContent.style.background = resolvedBg
                    clonedContent.querySelectorAll('.no-export').forEach((el) => {
                        (el as HTMLElement).style.display = 'none'
                    })
                },
            })

            canvas.toBlob((blob: Blob | null) => {
                if (!blob) { toast.error('Snapshot failed'); return }
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.download = `jji-report-${Date.now()}.png`
                a.href = url
                a.style.display = 'none'
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
                toast.success('Page snapshot saved!')
            }, 'image/png')
        } catch (err) {
            reportClientError(err, { operation: 'capture-report-snapshot', route: '/dashboard/reports' })
            toast.error('Failed to capture snapshot')
        } finally {
            setIsExporting(false)
        }
    }, [setIsExporting])

    const handleGenerateLink = useCallback(async () => {
        if (!tradingActivity || !psychMetrics) {
            toast.error('No data available to share.')
            return
        }

        setIsExporting(true)
        try {
            const payload = {
                title: 'Performance Report',
                dateFrom: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined,
                dateTo: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined,
                accountId: selectedAccountId,
                symbol: advancedFilters.symbol !== 'all' ? advancedFilters.symbol : undefined,
                session: advancedFilters.session !== 'all' ? advancedFilters.session : undefined,
                outcome: advancedFilters.outcome !== 'all' ? advancedFilters.outcome : undefined,
                strategy: advancedFilters.strategy !== 'all' ? advancedFilters.strategy : undefined,
                ruleBroken: advancedFilters.ruleBroken !== 'all' ? advancedFilters.ruleBroken : undefined,
                expiresInDays: 30
            }

            const res = await fetch('/api/v1/reports/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (!res.ok) throw new Error('Failed to generate link')
            const responseData = await res.json()
            const reportData = responseData.data || {}
            
            // Copy to clipboard
            await navigator.clipboard.writeText(reportData.url || `${window.location.origin}/reports/shared/${reportData.slug}`)
            toast.success('Shareable link copied to clipboard!')
        } catch (error) {
            reportClientError(error, { operation: 'create-shared-report-link', route: '/api/v1/reports/share' })
            toast.error('Failed to create shareable link.')
        } finally {
            setIsExporting(false)
        }
    }, [setIsExporting, tradingActivity, psychMetrics, dateRange, selectedAccountId, advancedFilters])

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 pb-20 sm:px-6 md:pb-8" id="report-content">
            <div>
                {/* Header */}
                <PageHeader
                    title="Reports"
                    meta={<span className="text-xs font-medium text-muted-foreground">{periodLabel}</span>}
                    className=""
                    actions={
                      <div className="no-export flex items-center gap-2">
                        {/* Export CSV Button */}
                        <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={isExporting} className="h-8 gap-1.5 rounded-lg border-border/30 text-xs font-semibold hover:bg-muted-foreground/10">
                            <Download className="h-3.5 w-3.5 opacity-60" />
                            Export CSV
                        </Button>

                        {/* Share Dropdown */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 text-[11px] font-bold uppercase tracking-wider border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 rounded-xl gap-1.5">
                                    <Share2 className="h-3.5 w-3.5" />
                                    Share
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-2 text-xs font-medium cursor-pointer">
                                            <LayoutDashboard className="h-3.5 w-3.5" />
                                            Performance Card
                                        </DropdownMenuItem>
                                    </DialogTrigger>
                                    <DialogContent className="overflow-hidden border border-border/10 bg-card p-0 sm:max-w-2xl">
                                        <div className="p-8">
                                            <DialogHeader className="mb-6">
                                                <DialogTitle>Generate performance card</DialogTitle>
                                                <DialogDescription>Create a shareable image from the currently filtered report.</DialogDescription>
                                            </DialogHeader>
                                            {tradingActivity && psychMetrics && (
                                                <div className="flex justify-center">
                                                    <PerformanceCard
                                                        period="Current report"
                                                        stats={{
                                                            totalTrades: tradingActivity.totalTrades,
                                                            winRate: tradingActivity.winRate,
                                                            totalPnL: psychMetrics.totalNetPnL,
                                                            longestWinStreak: psychMetrics.longestWinStreak,
                                                            longestLoseStreak: psychMetrics.longestLoseStreak,
                                                            tradingDays: tradingActivity.tradingDaysActive,
                                                            avgTradesPerMonth: tradingActivity.avgTradesPerMonth
                                                        }}
                                                        {...(user?.firstName ? { userName: `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}` } : {})}
                                                    />
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                                                <span>Trader: <span className="font-semibold text-foreground">{user?.firstName ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}` : 'Set your name in settings'}</span></span>
                                            </div>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                                <DropdownMenuItem onClick={handlePageSnapshot} disabled={isExporting} className="gap-2 text-xs font-medium">
                                    <ImageIcon className="h-3.5 w-3.5" />
                                    Page Snapshot
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleGenerateLink} disabled={isExporting} className="gap-2 text-xs font-medium">
                                    <LinkIcon className="h-3.5 w-3.5" />
                                    Create public link
                                </DropdownMenuItem>
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-2 text-xs font-medium cursor-pointer">
                                            <Settings className="h-3.5 w-3.5" />
                                            Manage Shared Links
                                        </DropdownMenuItem>
                                    </DialogTrigger>
                                    <DialogContent className="overflow-hidden border border-border/10 bg-card p-0 sm:max-w-2xl">
                                        <div className="p-8">
                                            <DialogHeader className="mb-6">
                                                <DialogTitle>Manage shared links</DialogTitle>
                                                <DialogDescription>Anyone with an active link can view its filtered report until the link expires or is revoked.</DialogDescription>
                                            </DialogHeader>
                                            <SharedLinksManager />
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    }
                />

                <ReportFilters
                    accounts={accounts || []}
                    selectedAccountId={selectedAccountId}
                    onAccountChange={setSelectedAccountId}
                    dateRange={dateRange}
                    onDateRangeChange={setDateRange}
                    onPresetSelect={handlePresetSelect}
                    activePreset={activePreset}
                    filters={advancedFilters}
                    options={filterOptions}
                    onFilterChange={handleFilterChange}
                />

                {isLoading ? (
                    <ReportsContentSkeleton />
                ) : !tradingActivity || !psychMetrics || filteredTrades.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-card/30 py-24">
                        <Zap className="h-10 w-10 text-muted-foreground/30 mb-4" />
                        <h3 className="mb-4 text-sm font-semibold text-muted-foreground">Journal is empty for this period</h3>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePresetSelect('ALL')}
                            className="text-xs font-semibold"
                        >
                            View All Time
                        </Button>
                    </div>
                ) : (
                    <div className="w-full">
                        <section className="flex flex-col justify-between gap-3 border-y border-border/30 py-4 sm:flex-row sm:items-center">
                            <div>
                                <h2 className="text-sm font-semibold">Next review focus</h2>
                                <p className="mt-1 text-sm text-muted-foreground">Review the sessions and setups that changed the result before adjusting your plan.</p>
                            </div>
                        </section>
                        <div><ReportsNavigation value={selectedTab as any} onValueChange={setSelectedTab as any} /></div>
                        {selectedTab === 'overview' && <div className="flex flex-col gap-12 focus-visible:outline-none">
                            <div className="flex flex-col gap-10">
                                <section className="border-y border-border/25">
                                    <div className="grid gap-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                                        <div className="border-b border-border/15 p-5 lg:border-b-0 lg:border-r">
                                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                                                <LayoutDashboard className="h-3.5 w-3.5" />
                                                Report summary
                                            </div>
                                            <p className={cn("mt-5 font-mono text-4xl font-black tracking-tighter sm:text-5xl", psychMetrics.totalNetPnL >= 0 ? "text-long" : "text-short")}>
                                                {psychMetrics.totalNetPnL >= 0 ? '+' : '-'}${Math.abs(psychMetrics.totalNetPnL).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </p>
                                            <p className="mt-2 max-w-sm text-sm font-semibold text-muted-foreground">
                                                Net performance for {periodLabel}, including activity, risk, and execution context.
                                            </p>
                                            <div className="mt-6 grid grid-cols-2 border-y border-border/15 text-sm">
                                                <div className="border-r border-border/15 py-3 pr-4">
                                                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground/60">Trades</p>
                                                    <p className="mt-1 font-mono text-xl font-black">{tradingActivity.totalTrades}</p>
                                                </div>
                                                <div className="py-3 pl-4">
                                                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground/60">Active Days</p>
                                                    <p className="mt-1 font-mono text-xl font-black">{tradingActivity.tradingDaysActive}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid divide-y divide-border/15 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                                            <div className="divide-y divide-border/15">
                                                {[
                                                    ['Win Rate', `${tradingActivity.winRate}%`],
                                                    ['Profit Factor', psychMetrics.profitFactor],
                                                    ['Expectancy', `$${psychMetrics.expectancy}`],
                                                    ['Recovery Factor', psychMetrics.recoveryFactor],
                                                ].map(([label, value]) => (
                                                    <div key={label} className="flex items-center justify-between gap-4 px-5 py-4">
                                                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground/65">{label}</span>
                                                        <span className="font-mono text-lg font-black">{value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="divide-y divide-border/15">
                                                {[
                                                    ['Max Drawdown', `$${psychMetrics.maxDrawdown}`],
                                                    ['Avg Win', `$${psychMetrics.avgWin}`],
                                                    ['Avg Loss', `$${psychMetrics.avgLoss}`],
                                                    ['Consistency', `${psychMetrics.consistencyScore}%`],
                                                ].map(([label, value]) => (
                                                    <div key={label} className="flex items-center justify-between gap-4 px-5 py-4">
                                                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground/65">{label}</span>
                                                        <span className={cn("font-mono text-lg font-black", label === 'Max Drawdown' || label === 'Avg Loss' ? 'text-short' : label === 'Avg Win' ? 'text-long' : '')}>{value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:items-stretch">
                                    {/* Detailed Metrics Table */}
                                    <div className="lg:col-span-7 space-y-6">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="h-4 w-4 text-primary" />
                                            <h2 className="text-sm font-semibold text-muted-foreground">Performance detail</h2>
                                        </div>
                                        <div className="h-full border-y border-border/20">
                                            <Table>
                                                <TableBody>
                                                    <TableRow className="border-border/10 hover:bg-transparent">
                                                        <TableCell className="text-[10px] font-black uppercase text-muted-foreground/60 py-3">Total Trades / Active Days</TableCell>
                                                        <TableCell className="text-right font-bold py-3">{tradingActivity.totalTrades} / {tradingActivity.tradingDaysActive}</TableCell>
                                                    </TableRow>
                                                    <TableRow className="border-border/10 hover:bg-transparent">
                                                        <TableCell className="text-[10px] font-black uppercase text-muted-foreground/60 py-3">Average Win / Average Loss</TableCell>
                                                        <TableCell className="text-right font-bold py-3">
                                                            <span className="text-long">${psychMetrics.avgWin}</span> / <span className="text-short">${psychMetrics.avgLoss}</span>
                                                        </TableCell>
                                                    </TableRow>
                                                    <TableRow className="border-border/10 hover:bg-transparent">
                                                        <TableCell className="text-[10px] font-black uppercase text-muted-foreground/60 py-3">Peak Equity</TableCell>
                                                        <TableCell className="text-right font-bold py-3 text-long">${psychMetrics.peakEquity}</TableCell>
                                                    </TableRow>
                                                    <TableRow className="border-border/10 hover:bg-transparent">
                                                        <TableCell className="text-[10px] font-black uppercase text-muted-foreground/60 py-3">Average Holding Time</TableCell>
                                                        <TableCell className="text-right font-bold py-3">{psychMetrics.avgHoldingTime}</TableCell>
                                                    </TableRow>
                                                    <TableRow className="border-border/10 hover:bg-transparent">
                                                        <TableCell className="text-[10px] font-black uppercase text-muted-foreground/60 py-3">Win/Loss Streaks</TableCell>
                                                        <TableCell className="text-right font-bold py-3">
                                                            <span className="text-long">{psychMetrics.longestWinStreak}W</span> / <span className="text-short">{psychMetrics.longestLoseStreak}L</span>
                                                        </TableCell>
                                                    </TableRow>
                                                    <TableRow className="border-border/10 hover:bg-transparent">
                                                        <TableCell className="text-[10px] font-black uppercase text-muted-foreground/60 py-3">Most Traded Day</TableCell>
                                                        <TableCell className="text-right font-bold py-3">{tradingActivity.mostTradedDay || '-'}</TableCell>
                                                    </TableRow>
                                                    <TableRow className="border-border/10 hover:bg-transparent">
                                                        <TableCell className="text-[10px] font-black uppercase text-muted-foreground/60 py-3">Most Profitable Day</TableCell>
                                                        <TableCell className="text-right font-bold py-3 text-long">{tradingActivity.mostProfitableDay || '-'}</TableCell>
                                                    </TableRow>
                                                    <TableRow className="border-border/10 hover:bg-transparent">
                                                        <TableCell className="text-[10px] font-black uppercase text-muted-foreground/60 py-3">Most Profitable Pair</TableCell>
                                                        <TableCell className="text-right font-bold py-3 text-long">{tradingActivity.mostProfitablePair || '-'}</TableCell>
                                                    </TableRow>
                                                    <TableRow className="border-border/10 hover:bg-transparent">
                                                        <TableCell className="text-[10px] font-black uppercase text-muted-foreground/60 py-3">Most Losing Day</TableCell>
                                                        <TableCell className="text-right font-bold py-3 text-short">{tradingActivity.mostLosingDay || '-'}</TableCell>
                                                    </TableRow>
                                                    <TableRow className="border-border/10 hover:bg-transparent">
                                                        <TableCell className="text-[10px] font-black uppercase text-muted-foreground/60 py-3">Most Losing Pair</TableCell>
                                                        <TableCell className="text-right font-bold py-3 text-short">{tradingActivity.mostLosingPair || '-'}</TableCell>
                                                    </TableRow>
                                                    <TableRow className="border-none hover:bg-transparent">
                                                        <TableCell className="text-[10px] font-black uppercase text-muted-foreground/60 py-3">Account Yield</TableCell>
                                                        <TableCell className={cn("text-right font-black py-3", psychMetrics.totalNetPnL >= 0 ? "text-long" : "text-short")}>
                                                            {psychMetrics.totalNetPnL >= 0 ? '+' : ''}{((psychMetrics.totalNetPnL / Math.max(1, (accounts?.[0]?.startingBalance || 10000))) * 100).toFixed(2)}%
                                                        </TableCell>
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>

                                    {/* R-Multiple Distribution Chart */}
                                    <div className="lg:col-span-5 space-y-4 flex flex-col">
                                        <div className="flex flex-col space-y-6">
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                    <h2 className="text-[11px] uppercase tracking-[0.2em] font-black text-muted-foreground">R-Multiple Distribution</h2>
                                    {rMultipleDataQuality && rMultipleDataQuality.percentageComplete < 100 && (
                                        <TooltipProvider delayDuration={100}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                                                        <AlertCircle className="h-3 w-3 text-amber-500" />
                                                        <span className="text-[9px] font-bold text-amber-500">{rMultipleDataQuality.percentageComplete}% data</span>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="max-w-[220px]">
                                                    <p className="text-xs">Only {rMultipleDataQuality.tradesWithStopLoss} of {rMultipleDataQuality.totalTrades} trades have stop loss data. R-Multiple calculations require stop loss for accuracy.</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    )}
                                                </div>
                                                <div className="flex h-[280px] flex-col border-y border-border/20 py-6">
                                                    <div className="flex-1 w-full">
                                                        <RMultipleDistributionChart distribution={rMultipleDistribution ?? {}} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Risk and recovery context */}
                                            <div className="flex flex-1 flex-col justify-center border-y border-border/20 py-6">
                                                <div className="flex items-center justify-between mb-6">
                                                    <h3 className="text-sm font-semibold text-muted-foreground">Risk analysis</h3>
                                                    <div className="h-1 w-1 rounded-full bg-muted-foreground/20" />
                                                </div>
                                                <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                                                    <div className="space-y-1">
                                                        <p className="text-[8px] uppercase font-bold text-muted-foreground/50 tracking-widest">RR Efficiency</p>
                                                        <p className="text-xl font-black font-mono tracking-tighter">
                                                            {psychMetrics.rrEfficiency}
                                                        </p>
                                                        <div className="h-1 w-full bg-muted/20 rounded-full overflow-hidden">
                                                            <div 
                                                                className="h-full bg-long transition-all duration-1000" 
                                                                style={{ width: `${Math.min(100, parseFloat(psychMetrics.rrEfficiency) * 40)}%` }} 
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-[8px] uppercase font-bold text-muted-foreground/50 tracking-widest">Recovery Factor</p>
                                                        <p className="text-xl font-black font-mono tracking-tighter">
                                                            {psychMetrics.recoveryFactor}
                                                        </p>
                                                        <div className="h-1 w-full bg-muted/20 rounded-full overflow-hidden">
                                                            <div 
                                                                className="h-full bg-primary transition-all duration-1000" 
                                                                style={{ width: `${Math.min(100, parseFloat(psychMetrics.recoveryFactor) * 20)}%` }} 
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-[8px] uppercase font-bold text-muted-foreground/50 tracking-widest">Expectancy / Trade</p>
                                                        <p className="text-xl font-black font-mono tracking-tighter text-foreground">${psychMetrics.expectancy}</p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-[8px] uppercase font-bold text-muted-foreground/50 tracking-widest">Consistency Score</p>
                                                        <p className="text-xl font-black font-mono tracking-tighter">
                                                            {psychMetrics.consistencyScore}%
                                                        </p>
                                                        <div className="h-1 w-full bg-muted/20 rounded-full overflow-hidden">
                                                            <div 
                                                                className="h-full bg-foreground transition-all duration-1000" 
                                                                style={{ width: `${Math.min(100, Math.max(0, Number(psychMetrics.consistencyScore)))}%` }} 
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-[8px] uppercase font-bold text-muted-foreground/50 tracking-widest">Total R-Multiple</p>
                                                        <p className={cn("text-xl font-black font-mono tracking-tighter", parseFloat(psychMetrics.totalRMultiple) >= 0 ? "text-long" : "text-short")}>
                                                            {parseFloat(psychMetrics.totalRMultiple) > 0 ? '+' : ''}{psychMetrics.totalRMultiple}R
                                                        </p>
                                                    </div>
                                                    {psychMetrics.sharpeRatio !== undefined && (
                                                        <div className="space-y-1">
                                                            <p className="text-[8px] uppercase font-bold text-muted-foreground/50 tracking-widest">Sharpe Ratio</p>
                                                            <p className={cn("text-xl font-black font-mono tracking-tighter", parseFloat(psychMetrics.sharpeRatio) >= 0 ? "text-long" : "text-short")}>
                                                                {psychMetrics.sharpeRatio}
                                                            </p>
                                                        </div>
                                                    )}
                                                    {psychMetrics.sortinoRatio !== undefined && (
                                                        <div className="space-y-1">
                                                            <p className="text-[8px] uppercase font-bold text-muted-foreground/50 tracking-widest">Sortino Ratio</p>
                                                            <p className={cn("text-xl font-black font-mono tracking-tighter", parseFloat(psychMetrics.sortinoRatio) >= 0 ? "text-long" : "text-short")}>
                                                                {psychMetrics.sortinoRatio}
                                                            </p>
                                                        </div>
                                                    )}
                                                    {psychMetrics.calmarRatio !== undefined && (
                                                        <div className="space-y-1">
                                                            <p className="text-[8px] uppercase font-bold text-muted-foreground/50 tracking-widest">Calmar Ratio</p>
                                                            <p className={cn("text-xl font-black font-mono tracking-tighter", parseFloat(psychMetrics.calmarRatio) >= 0 ? "text-long" : "text-short")}>
                                                                {psychMetrics.calmarRatio}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Rich Visualizations */}
                                {reportData?.chartData && (
                                    <DiverseCharts chartData={reportData.chartData} />
                                )}

                                {/* Monthly Returns Matrix */}
                                {reportData?.chartData?.equityCurve && reportData.chartData.equityCurve.length > 0 && (
                                    <MonthlyReturnsMatrix equityCurve={reportData.chartData.equityCurve} />
                                )}

                                {/* Trade Duration Performance */}
                                {filteredTrades && filteredTrades.length > 0 && (
                                    <TradeDurationChart trades={filteredTrades} />
                                )}

                                {/* Time of Day Heatmap */}
                                {filteredTrades && filteredTrades.length > 0 && (
                                    <TimeOfDayHeatmap trades={filteredTrades} />
                                )}

                                {/* MAE vs MFE Analysis */}
                                {filteredTrades && filteredTrades.length > 0 && (
                                    <MaeMfeScatter trades={filteredTrades} />
                                )}

                                {/* Instrument Performance Breakdown */}
                                {filteredTrades && filteredTrades.length > 0 && (
                                    <InstrumentBreakdown trades={filteredTrades} />
                                )}

                                {/* Commission & Fee Impact */}
                                {filteredTrades && filteredTrades.length > 0 && (
                                    <CommissionAnalysis trades={filteredTrades} />
                                )}

                                {sessionPerformance && <ReportsSessionSummary sessions={sessionPerformance} />}
                            </div>
                        </div>}

                        {selectedTab === 'spreadsheet' && <div className="focus-visible:outline-none">
                            <div className="flex items-center justify-between mb-2 px-1">
                                <h3 className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest">Recent Activity</h3>
                                <span className="text-[9px] font-bold text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full">Displaying up to 100 most recent trades</span>
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-border/22 bg-card/50 no-scrollbar">
                              <div className="min-w-[700px] w-full">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow className="border-border/40 hover:bg-transparent">
                                            <TableHead className="text-[9px] font-black uppercase tracking-widest h-10">Entry Date</TableHead>
                                            <TableHead className="h-10 text-xs font-semibold">Instrument</TableHead>
                                            <TableHead className="text-[9px] font-black uppercase tracking-widest h-10">Side</TableHead>
                                            <TableHead className="text-[9px] font-black uppercase tracking-widest h-10">Lots</TableHead>
                                            <TableHead className="text-[9px] font-black uppercase tracking-widest h-10">Result</TableHead>
                                            <TableHead className="text-[9px] font-black uppercase tracking-widest h-10 text-right">{getPnlDisplayLabel(pnlDisplayMode)}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {[...filteredTrades].sort((a, b) => new Date(b.entryDate!).getTime() - new Date(a.entryDate!).getTime()).map((trade: any) => {
                                            const displayPnL = getTradePnlByMode(trade, pnlDisplayMode)
                                            const outcome = classifyTrade(getTradeNetPnl(trade))
                                            return (
                                                <TableRow key={trade.id} className="border-border/20 hover:bg-muted/5 group transition-colors">
                                                    <TableCell className="text-[10px] font-bold font-mono py-2 opacity-60">
                                                        {trade.entryDate ? formatTimeInZone(trade.entryDate.includes('Z') ? trade.entryDate : `${trade.entryDate}Z`, 'yyyy-MM-dd HH:mm') : 'N/A'}
                                                    </TableCell>
                                                    <TableCell className="text-[10px] font-black py-2">{trade.instrument || trade.symbol || '-'}</TableCell>
                                                    <TableCell className="py-2">
                                                        <span className={cn(
                                                            "text-[9px] font-black uppercase px-2 py-0.5 rounded-full",
                                                            (trade.side?.toLowerCase() === 'long' || trade.side?.toLowerCase() === 'buy') ? "bg-long/10 text-long" : "bg-short/10 text-short"
                                                        )}>
                                                            {trade.side}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-[10px] font-mono py-2">{trade.quantity}</TableCell>
                                                    <TableCell className="py-2">
                                                        <span className={cn(
                                                            "text-[9px] font-black uppercase",
                                                            outcome === 'win' ? "text-long" : outcome === 'loss' ? "text-short" : "text-muted-foreground"
                                                        )}>
                                                            {outcome}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className={cn(
                                                        "text-[10px] font-bold font-mono text-right py-2",
                                                        displayPnL >= 0 ? "text-long" : "text-short"
                                                    )}>
                                                        ${displayPnL.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                              </div>
                            </div>
                        </div>}

                        {selectedTab === 'statement' && <div className="focus-visible:outline-none">
                            {filteredTrades && filteredTrades.length > 0 && (
                                <StatementView trades={filteredTrades} {...(dateRange !== undefined && { dateRange: dateRange as any })} />
                            )}
                        </div>}

                        {selectedTab === 'propfirm' && <div className="focus-visible:outline-none">
                            <PropFirmTab {...(initialPropFirmData !== undefined && initialPropFirmData !== null && { initialData: initialPropFirmData })} />
                        </div>}
                    </div>
                )}
            </div>
        </div>
    )
}
