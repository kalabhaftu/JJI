'use client'

import { useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
    Download,
    Copy,
    Check,
    Flame,
    Shield,
    TrendingUp,
    TrendingDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Logo } from '@/components/logo'
import { reportError } from '@/lib/observability/report-error'

interface PerformanceCardProps {
    period: string
    stats: {
        totalTrades: number
        winRate: string
        totalPnL: number
        longestWinStreak: number
        longestLoseStreak: number
        tradingDays: number
        avgTradesPerMonth: number
    }
    userName?: string
}

export function PerformanceCard({ period, stats, userName }: PerformanceCardProps) {
    const cardRef = useRef<HTMLDivElement>(null)
    const [isExporting, setIsExporting] = useState(false)
    const [isCopied, setIsCopied] = useState(false)

    const isProfit = stats.totalPnL >= 0
    const pnlFormatted = `${isProfit ? '+' : '-'}$${Math.abs(stats.totalPnL).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    const displayName = userName?.trim() || 'TRADER'

    const handleDownload = useCallback(async () => {
        if (!cardRef.current) return
        setIsExporting(true)

        try {
            const html2canvas = (await import('html2canvas')).default

            // Clone into a hidden container at full size to avoid any clipping
            const cardEl = cardRef.current
            const clone = cardEl.cloneNode(true) as HTMLElement
            clone.style.position = 'fixed'
            clone.style.left = '-9999px'
            clone.style.top = '0'
            clone.style.width = '480px'  // Fixed width for consistent exports
            clone.style.height = 'auto'
            clone.style.transform = 'none'
            clone.style.overflow = 'visible'
            document.body.appendChild(clone)

            // Wait for layout
            await new Promise(r => setTimeout(r, 50))

            const canvas = await html2canvas(clone, {
                scale: 3,
                useCORS: true,
                logging: false,
                backgroundColor: null,
            })

            document.body.removeChild(clone)

            canvas.toBlob((blob: Blob | null) => {
                if (!blob) {
                    toast.error('Export failed - could not generate image')
                    return
                }
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `jji-performance-${Date.now()}.png`
                a.style.display = 'none'
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
                toast.success('Performance card exported!')
            }, 'image/png')
        } catch (err) {
            // Error shown via toast
            toast.error('Export failed. Please try again.')
        } finally {
            setIsExporting(false)
        }
    }, [])

    const handleCopyStats = useCallback(() => {
        const sign = isProfit ? '+' : '-'
        const text = [
            `JJI PERFORMANCE REPORT`,
            `Period: ${period.toUpperCase()}`,
            `Trader: ${displayName}`,
            ``,
            `Net P&L:       ${sign}$${Math.abs(stats.totalPnL).toLocaleString()}`,
            `Win Rate:      ${stats.winRate}%`,
            `Total Trades:  ${stats.totalTrades}`,
            `Trading Days:  ${stats.tradingDays}`,
            `Best Streak:   ${stats.longestWinStreak} wins`,
            `Worst Streak:  ${stats.longestLoseStreak} losses`,
            `Trades/Month:  ${stats.avgTradesPerMonth}`,
            ``,
            `Verified via JJI`,
        ].join('\n')

        navigator.clipboard.writeText(text).then(() => {
            setIsCopied(true)
            toast.success('Stats copied to clipboard')
            setTimeout(() => setIsCopied(false), 2500)
        }).catch((e) => {
            reportError(e, {
                surface: 'client',
                operation: 'copy-performance-report',
            })
            toast.error('Could not access clipboard')
        })
    }, [period, displayName, stats, isProfit])

    return (
        <div className="space-y-5 w-full">
            {/* ── The shareable card ── */}
            <div
                ref={cardRef}
                data-performance-card
                className={cn(
                    "relative w-full max-w-[480px] mx-auto overflow-hidden rounded-3xl p-6 sm:p-7 flex flex-col gap-5",
                    "border border-border bg-card text-card-foreground",
                    "shadow-xl"
                )}
                style={{ minHeight: 280 }}
            >
                {/* Subtle background glow - using radial gradients supported by html2canvas */}
                <div 
                    className="pointer-events-none absolute inset-0 opacity-20 z-0" 
                    style={{
                        background: `
                            radial-gradient(circle 200px at 100% 0%, ${isProfit ? 'hsl(var(--chart-profit))' : 'hsl(var(--chart-loss))'}, transparent 70%),
                            radial-gradient(circle 180px at 0% 100%, hsl(var(--primary)), transparent 70%)
                        `
                    }}
                />

                {/* Header */}
                <div className="relative flex items-start justify-between gap-4 z-10">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="h-5 w-0.5 bg-primary rounded-full" />
                            <span className="text-[9px] font-black uppercase tracking-[0.35em] text-muted-foreground">
                                Performance Report
                            </span>
                        </div>
                        <h2 className="text-xl font-black tracking-tighter uppercase leading-none text-foreground">
                            {period} <span className="text-muted-foreground font-light italic">Report</span>
                        </h2>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="flex items-center gap-1.5 bg-muted/60 border border-border px-2.5 py-1 rounded-full">
                            <Shield className="h-2.5 w-2.5 text-primary" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Verified</span>
                        </div>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                            {displayName}
                        </span>
                    </div>
                </div>

                {/* Main P&L */}
                <div className="relative z-10 flex flex-col items-center flex-1 justify-center -mt-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.5em] text-muted-foreground mb-1">
                        Net P&L Result
                    </span>
                    <div className="relative flex items-center gap-3">
                        <span className={cn(
                            "text-5xl sm:text-6xl font-black tracking-tighter leading-none",
                            isProfit ? "text-long" : "text-short"
                        )}>
                            {pnlFormatted}
                        </span>
                        {isProfit
                            ? <Flame className="h-7 w-7 text-long opacity-80 animate-pulse" />
                            : <TrendingDown className="h-7 w-7 text-short opacity-80" />
                        }
                    </div>
                </div>

                {/* Stats grid */}
                <div className="relative z-10 grid grid-cols-3 gap-2">
                    {[
                        { label: 'Trades', value: stats.totalTrades, sub: 'Total executions' },
                        { label: 'Win Rate', value: `${stats.winRate}%`, sub: 'Edge accuracy' },
                        { label: 'Best Streak', value: stats.longestWinStreak, sub: 'Consecutive wins' },
                    ].map(({ label, value, sub }) => (
                        <div key={label} className="flex flex-col items-center justify-center p-3 rounded-2xl bg-muted/30 border border-border gap-0.5">
                            <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
                            <span className="text-lg font-black tracking-tighter text-foreground">{value}</span>
                            <span className="text-[8px] font-medium text-muted-foreground/60 uppercase">{sub}</span>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="relative z-10 flex items-center justify-between border-t border-border pt-3">
                    <div className="flex gap-4">
                        <div>
                            <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Active Sessions</p>
                            <p className="text-[11px] font-black text-foreground">{stats.tradingDays}</p>
                        </div>
                        <div>
                            <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Trades / Month</p>
                            <p className="text-[11px] font-black text-foreground">{stats.avgTradesPerMonth}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 opacity-40">
                        <Logo className="w-3.5 h-3.5" />
                        <span className="text-[9px] font-black tracking-tighter uppercase">JJI</span>
                    </div>
                </div>
            </div>

            {/* ── Action buttons ── */}
            <div className="flex flex-col sm:flex-row gap-3">
                <Button
                    onClick={handleDownload}
                    disabled={isExporting}
                    className="flex-1 h-11 gap-2.5 font-black uppercase tracking-wider text-xs rounded-xl"
                >
                    {isExporting
                        ? <><TrendingUp className="h-4 w-4 animate-pulse" /> Generating...</>
                        : <><Download className="h-4 w-4" /> Export Image</>
                    }
                </Button>
                <Button
                    variant="outline"
                    onClick={handleCopyStats}
                    className="sm:w-auto h-11 gap-2.5 font-black uppercase tracking-wider text-xs rounded-xl"
                >
                    {isCopied
                        ? <><Check className="h-4 w-4 text-long" /> Copied!</>
                        : <><Copy className="h-4 w-4" /> Copy Stats</>
                    }
                </Button>
            </div>
        </div>
    )
}
