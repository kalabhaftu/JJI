'use client'

import { format } from 'date-fns'
import { enUS } from 'date-fns/locale'
import {
  Activity,
  AreaChart as AreaChartIcon,
  Boxes,
  Clock,
  Coins,
  Moon,
  Percent,
  ScrollText,
  Sun,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { WeeklyModalMetrics } from './use-weekly-modal-metrics'

function MetricCard({
  icon: Icon,
  label,
  value,
  subValue,
  trend,
  className
}: {
  icon: any;
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}) {
  const trendColor = trend === 'up' ? 'text-profit font-black' : trend === 'down' ? 'text-loss font-black' : 'text-foreground'
  const isLoss = trend === 'down'
  const isWin = trend === 'up'

  return (
    <div className={cn(
      "rounded-xl border border-border/30 bg-card/70 p-4 flex flex-col justify-between min-h-[100px] shadow-sm backdrop-blur-sm transition-all hover:bg-card/85",
      className
    )}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] uppercase font-extrabold tracking-wider text-muted-foreground/85">{label}</span>
        <span className={cn(
          "rounded-lg p-1.5 shrink-0",
          isWin && "bg-profit/10 text-profit",
          isLoss && "bg-loss/10 text-loss",
          !isWin && !isLoss && "bg-muted/30 text-muted-foreground"
        )}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div>
        <div className={cn("text-base sm:text-lg font-black tracking-tight font-mono", trendColor)}>
          {value}
        </div>
        {subValue && (
          <div className="text-[10px] text-muted-foreground/60 mt-1 font-semibold tracking-wide">{subValue}</div>
        )}
      </div>
    </div>
  )
}

type WeeklyOverviewTabProps = WeeklyModalMetrics & {
  chartStyle: 'smooth' | 'sharp'
}

export function WeeklyOverviewTab({ weeklyData, stats, chartData, chartStyle }: WeeklyOverviewTabProps) {
  return (
    <>
{}
              <TabsContent value="overview" className="m-0 px-4 py-5 sm:px-6 lg:px-8 space-y-6">
                {}
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
                  <MetricCard
                    icon={Coins}
                    label="Total P&L"
                    value={`$${weeklyData.pnl.toFixed(2)}`}
                    trend={weeklyData.pnl > 0 ? 'up' : weeklyData.pnl < 0 ? 'down' : 'neutral'}
                  />
                  <MetricCard
                    icon={ScrollText}
                    label="Trades"
                    value={weeklyData.tradeNumber}
                    subValue={`${weeklyData.longNumber}L / ${weeklyData.shortNumber}S`}
                  />
                  <MetricCard
                    icon={Percent}
                    label="Win Rate"
                    value={`${weeklyData.winRate.toFixed(1)}%`}
                    subValue={`${weeklyData.winningTrades}W / ${weeklyData.losingTrades}L`}
                    trend={weeklyData.winRate >= 50 ? 'up' : 'down'}
                  />
                  <MetricCard
                    icon={TrendingUp}
                    label="Avg Win"
                    value={`$${weeklyData.avgWin.toFixed(2)}`}
                    trend="up"
                  />
                  <MetricCard
                    icon={TrendingDown}
                    label="Avg Loss"
                    value={`$${weeklyData.avgLoss.toFixed(2)}`}
                    trend="down"
                  />
                  <MetricCard
                    icon={Activity}
                    label="Profit Factor"
                    value={stats?.profitFactor === Infinity ? '∞' : stats?.profitFactor?.toFixed(2) || '0.00'}
                    trend={stats && stats.profitFactor >= 1 ? 'up' : 'down'}
                  />
                </div>

                {}
                <div className="rounded-xl border border-border/30 bg-muted/5 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <AreaChartIcon className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-medium">Cumulative P&L</h3>
                  </div>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ left: 0, right: 0, top: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          tickFormatter={(value) => `$${value >= 1000 || value <= -1000 ? (value / 1000).toFixed(1) + 'k' : value.toFixed(0)}`}
                          width={50}
                        />
                        <Tooltip
                          content={({ active, payload }: any) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload
                              return (
                                <div className="rounded-lg border border-border/50 bg-card p-3 shadow-md">
                                  <div className="text-xs text-muted-foreground mb-1">
                                    {format(new Date(data.date + 'T00:00:00Z'), 'EEEE, MMM d', { locale: enUS })}
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <div className="text-sm">
                                      <span className="text-muted-foreground">Daily: </span>
                                      <span className={cn("font-semibold", data.daily >= 0 ? 'text-long' : 'text-short')}>
                                        ${data.daily?.toFixed(2)}
                                      </span>
                                    </div>
                                    <div className="text-sm">
                                      <span className="text-muted-foreground">Cumulative: </span>
                                      <span className={cn("font-semibold", data.balance >= 0 ? 'text-long' : 'text-short')}>
                                        ${data.balance?.toFixed(2)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                        <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" opacity={0.5} />
                        <Area
                          type={chartStyle === 'sharp' ? 'linear' : 'monotone'}
                          dataKey="balance"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          fill="hsl(var(--primary))"
                          fillOpacity={0.12}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {}
                {stats && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border/25 border border-border/30 bg-card/45 rounded-xl overflow-hidden">
                    <div className="p-4.5 bg-card/35 flex flex-col justify-between min-h-[96px]">
                      <div className="flex items-center gap-2 mb-2">
                        <Sun className="h-4 w-4 text-long" />
                        <span className="text-xs font-semibold text-muted-foreground/80">Best Day</span>
                      </div>
                      <div>
                        <div className="text-sm sm:text-base font-bold truncate">
                          {stats.bestDay ? stats.bestDay[0] : 'N/A'}
                        </div>
                        <div className="text-xs text-long mt-0.5 font-semibold font-mono">
                          {stats.bestDay ? `+$${stats.bestDay[1].pnl.toFixed(2)}` : '$0.00'}
                        </div>
                      </div>
                    </div>

                    <div className="p-4.5 bg-card/35 flex flex-col justify-between min-h-[96px]">
                      <div className="flex items-center gap-2 mb-2">
                        <Moon className="h-4 w-4 text-short" />
                        <span className="text-xs font-semibold text-muted-foreground/80">Worst Day</span>
                      </div>
                      <div>
                        <div className="text-sm sm:text-base font-bold truncate">
                          {stats.worstDay ? stats.worstDay[0] : 'N/A'}
                        </div>
                        <div className="text-xs text-short mt-0.5 font-semibold font-mono">
                          {stats.worstDay ? `$${stats.worstDay[1].pnl.toFixed(2)}` : '$0.00'}
                        </div>
                      </div>
                    </div>

                    <div className="p-4.5 bg-card/35 flex flex-col justify-between min-h-[96px]">
                      <div className="flex items-center gap-2 mb-2">
                        <Boxes className="h-4 w-4 text-primary" />
                        <span className="text-xs font-semibold text-muted-foreground/80">Top Instrument</span>
                      </div>
                      <div>
                        <div className="text-sm sm:text-base font-bold truncate">
                          {stats.bestPair ? stats.bestPair[0] : 'N/A'}
                        </div>
                        <div className="text-xs text-muted-foreground/60 mt-0.5 font-medium font-mono">
                          {stats.bestPair ? `$${stats.bestPair[1].pnl.toFixed(2)} (${stats.bestPair[1].trades} trades)` : '0 trades'}
                        </div>
                      </div>
                    </div>

                    <div className="p-4.5 bg-card/35 flex flex-col justify-between min-h-[96px]">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="text-xs font-semibold text-muted-foreground/80">Best Session</span>
                      </div>
                      <div>
                        <div className="text-sm sm:text-base font-bold truncate">
                          {stats.bestSession ? stats.bestSession[0] : 'N/A'}
                        </div>
                        <div className="text-xs text-muted-foreground/60 mt-0.5 font-medium font-mono">
                          {stats.bestSession ? `$${stats.bestSession[1].pnl.toFixed(2)} (${stats.bestSession[1].trades} trades)` : '0 trades'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
    </>
  )
}
