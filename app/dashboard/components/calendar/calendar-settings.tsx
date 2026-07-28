
'use client'

import { Check, Settings as SettingsIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { useCalendarViewStore, VisibleStats } from "@/store/calendar-view-store"
import { cn } from "@/lib/utils"

export function CalendarSettings() {
    const { visibleStats, setVisibleStats } = useCalendarViewStore()

    const stats: { key: keyof VisibleStats; label: string }[] = [
        { key: "rMultiple", label: "R Multiple" },
        { key: "pnl", label: "Daily P/L" },
        { key: "trades", label: "Number of Trades" },
        { key: "winRate", label: "Day Winrate" },
    ]

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 p-0 hover:bg-primary/5 hover:text-primary transition-all rounded-md"
                    title="Display Stats Settings"
                    aria-label="Display Stats Settings"
                >
                    <SettingsIcon className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-foreground transition-colors" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[210px] rounded-xl border border-border/40 bg-popover p-3 shadow-xl animate-in fade-in-50 zoom-in-95 duration-100" align="end">
                <div className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider px-1">
                    Display stats
                </div>
                <div className="flex flex-col gap-1">
                    {stats.map((stat) => {
                        const isChecked = visibleStats[stat.key]
                        return (
                            <button
                                type="button"
                                key={stat.key}
                                onClick={() => {
                                    setVisibleStats({ [stat.key]: !isChecked })
                                }}
                                aria-pressed={isChecked}
                                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/30"
                            >
                                <div className={cn(
                                    "h-4 w-4 rounded flex items-center justify-center transition-all",
                                    isChecked
                                        ? "border border-primary bg-primary text-primary-foreground animate-in zoom-in-75 duration-75"
                                        : "border border-muted-foreground/45 bg-muted/20"
                                )}>
                                    {isChecked && (
                                        <Check className="h-3 w-3 stroke-[3]" />
                                    )}
                                </div>
                                <span className="text-xs font-semibold text-foreground/80 tracking-tight">
                                    {stat.label}
                                </span>
                            </button>
                        )
                    })}
                </div>
            </PopoverContent>
        </Popover>
    )
}
