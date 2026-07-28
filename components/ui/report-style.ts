import { cn } from '@/lib/utils'

export const reportTypography = {
  eyebrow: 'text-xs font-semibold uppercase tracking-widest text-muted-foreground',
  microLabel: 'text-xs font-semibold uppercase tracking-wide text-muted-foreground/70',
  sectionTitle: 'text-xs font-semibold uppercase tracking-widest text-muted-foreground',
  metricValue: 'font-mono text-xl font-semibold tracking-tight text-foreground',
  heroMetric: 'font-mono text-5xl font-semibold tracking-tight leading-none sm:text-6xl',
}

export const reportSurface = {
  panel: 'rounded-2xl border border-border/40 bg-muted/10 p-6',
  chartPanel: 'flex min-h-[20rem] flex-col rounded-2xl border border-border/40 bg-muted/10 p-6',
  metricCard: 'rounded-xl border border-border/50 bg-card/60 p-4 shadow-sm',
  toolbar: 'rounded-2xl border border-border/60 bg-card/70 p-3 shadow-sm backdrop-blur',
}

function reportPnlClass(value: number) {
  return value >= 0 ? 'text-long' : 'text-short'
}

function reportPanelClass(className?: string) {
  return cn(reportSurface.panel, className)
}

function reportChartPanelClass(className?: string) {
  return cn(reportSurface.chartPanel, className)
}
