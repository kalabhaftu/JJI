'use client'

import { cn } from '@/lib/utils'
import { reportSurface, reportTypography } from '@/components/ui/report-style'
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    Cell,
    Pie,
    PieChart,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    XAxis,
    YAxis
} from 'recharts'

import { useTheme } from '@/context/theme-provider'

interface DiverseChartsProps {
    chartData: {
        equityCurve: any[]
        outcomeDistribution: any[]
        dayOfWeekPerformance: any[]
    }
}

const COLORS = {
    bullish: 'hsl(var(--chart-profit))',
    bearish: 'hsl(var(--chart-loss))',
    muted: 'hsl(220, 15%, 55%)'
}

export function DiverseCharts({ chartData }: DiverseChartsProps) {
    const { chartStyle } = useTheme()
    if (!chartData || chartData.equityCurve.length === 0) return null

    const { equityCurve: equityData, outcomeDistribution: outcomeData, dayOfWeekPerformance: dayOfWeekData } = chartData

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-card border border-border p-3 rounded-lg shadow-md">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground/70 mb-2">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center justify-between gap-4 mb-1 border-b border-border/20 pb-1 last:border-0 last:pb-0 last:mb-0">
                            <span className="text-xs font-medium text-foreground capitalize" style={{ color: entry.color }}>
                                {entry.name}:
                            </span>
                            <span className="text-xs font-mono font-bold">
                                {entry.name === 'equity' || entry.name === 'Win' || entry.name === 'Loss' ? '$' : ''}
                                {typeof entry.value === 'number' && entry.value % 1 !== 0 ? entry.value.toFixed(2) : entry.value}
                            </span>
                        </div>
                    ))}
                </div>
            )
        }
        return null
    }

    const isSharp = chartStyle === 'sharp'
    const strokeColor = COLORS.bullish
    const gradientColor = COLORS.bullish
    const curveType = isSharp ? 'linear' : 'monotone'

    return (
        <div className="space-y-6">
            <h2 className={reportTypography.sectionTitle}>Portfolio Visualizations</h2>

            {                                                  }
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {                                          }
                <div className={cn('lg:col-span-2', reportSurface.chartPanel)}>
                    <h3 className={reportTypography.sectionTitle}>Cumulative Equity Curve</h3>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={equityData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={gradientColor} stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor={gradientColor} stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                    minTickGap={30}
                                />
                                <YAxis
                                    hide
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <RechartsTooltip content={<CustomTooltip />} />
                                <Area
                                    type={curveType}
                                    dataKey="equity"
                                    name="Equity"
                                    stroke={strokeColor}
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorEquity)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {                                        }
                <div className={reportSurface.chartPanel}>
                    <h3 className={reportTypography.sectionTitle}>Outcome Distribution</h3>
                    <div className="flex-1 w-full min-h-0 flex items-center justify-center relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={outcomeData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {outcomeData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <RechartsTooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-2xl font-black">{outcomeData.reduce((acc, curr) => acc + curr.value, 0)}</span>
                            <span className={reportTypography.microLabel}>Trades</span>
                        </div>
                    </div>
                    {                   }
                    <div className="flex justify-center gap-4 mt-2">
                        {outcomeData.map((entry, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">{entry.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            {                                                     }
            <div className={reportSurface.chartPanel}>
                <h3 className={reportTypography.sectionTitle}>Performance by Day of Week</h3>
                <div className="flex-1 w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dayOfWeekData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                            />
                            <YAxis
                                hide
                                axisLine={false}
                                tickLine={false}
                            />
                            <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.2)' }} />
                            <Bar dataKey="Win" name="Win" fill={COLORS.bullish} radius={[4, 4, 0, 0]} maxBarSize={40} />
                            <Bar dataKey="Loss" name="Loss" fill={COLORS.bearish} radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

        </div>
    )
}
