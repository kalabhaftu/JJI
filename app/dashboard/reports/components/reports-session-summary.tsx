import { cn } from "@/lib/utils"

export type ReportSession = { name: string; range: string; trades: number; wins: number; pnl: number; totalHoldMs: number; peak: number; maxDD: number }

export function ReportsSessionSummary({ sessions }: { sessions: Record<string, ReportSession> }) {
  return <section className="flex flex-col gap-4 border-t border-border/20 pt-8" aria-labelledby="session-summary-heading">
    <div>
      <h2 id="session-summary-heading" className="text-sm font-semibold">Session performance</h2>
      <p className="mt-1 text-sm text-muted-foreground">How each trading window contributed to this report.</p>
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Object.values(sessions).map((session) => {
        const winRate = session.trades > 0 ? ((session.wins / session.trades) * 100).toFixed(1) : "0.0"
        const avgHold = session.trades > 0 ? session.totalHoldMs / session.trades : 0
        const hours = Math.floor(avgHold / 3_600_000)
        const minutes = Math.floor((avgHold % 3_600_000) / 60_000)
        return <article key={session.name} className={cn("flex flex-col gap-4 rounded-xl border border-border/40 bg-card/40 p-4", session.trades === 0 && "opacity-50")}>
          <header className="flex items-start justify-between gap-3"><div><h3 className="text-xs font-semibold uppercase tracking-wider">{session.name}</h3><p className="mt-1 text-xs text-muted-foreground">{session.range}</p></div><strong className={cn("font-mono text-sm", session.pnl >= 0 ? "text-long" : "text-short")}>{session.pnl >= 0 ? "+" : "-"}${Math.abs(session.pnl).toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong></header>
          <div className="grid grid-cols-3 gap-3 border-t border-border/20 pt-3 text-center"><div><p className="text-[10px] text-muted-foreground">Trades</p><p className="mt-1 font-mono font-semibold">{session.trades}</p></div><div className="border-x border-border/20"><p className="text-[10px] text-muted-foreground">Win rate</p><p className="mt-1 font-mono font-semibold">{winRate}%</p></div><div><p className="text-[10px] text-muted-foreground">Avg hold</p><p className="mt-1 font-mono font-semibold">{hours}h {minutes}m</p></div></div>
        </article>
      })}
    </div>
  </section>
}
