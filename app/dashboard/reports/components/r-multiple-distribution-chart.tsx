'use client'

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTheme } from '@/context/theme-provider'

interface RMultipleDistributionChartProps {
  distribution: object
}

function RMultipleTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-border bg-card p-2 shadow-md">
      <p className="mb-1 text-[10px] font-black uppercase text-muted-foreground/70">{label}</p>
      <span className="font-mono text-xs font-bold">
        {payload[0].value} trades
      </span>
    </div>
  )
}

export function RMultipleDistributionChart({
  distribution,
}: RMultipleDistributionChartProps) {
  const { chartStyle } = useTheme()
  const data = Object.entries(distribution).map(([name, count]) => ({
    name,
    count: Number(count),
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
        <defs>
          <linearGradient id="colorRMultiple" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--foreground))" stopOpacity={0.15} />
            <stop offset="95%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis hide />
        <Tooltip
          content={<RMultipleTooltip />}
          cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1, strokeDasharray: '4 4' }}
        />
        <Area
          type={chartStyle === 'sharp' ? 'linear' : 'monotone'}
          dataKey="count"
          stroke="hsl(var(--foreground))"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorRMultiple)"
          animationDuration={1000}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
