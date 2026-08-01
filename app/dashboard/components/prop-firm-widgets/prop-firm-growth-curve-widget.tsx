"use client"

import { useCallback, useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PropFirmWidgetShell } from './prop-firm-widget-shell'
import { useDashboardDisplay } from '@/hooks/use-dashboard-display'
import { useTheme } from '@/context/theme-provider'
import type { PropFirmAccount, PropFirmWidgetData } from '@/hooks/use-prop-firm-dashboard-widget-data'

type GrowthPoint = PropFirmWidgetData['growth'][number]

type GrowthReferences = {
  accountSize: number
  targetBalance: number
  dailyLossFloor: number
  maxLossFloor: number
  currentBalance: number
}

function getReferenceValues(account: PropFirmAccount, data: PropFirmWidgetData): GrowthReferences {
  const accountSize = Number(account.accountSize || 0)
  const phase = account.currentPhase || {}
  const targetAmount = accountSize * (Number(phase.profitTargetPercent || 0) / 100)
  const maxLossLimit = accountSize * (Number(phase.maxDrawdownPercent || 0) / 100)
  const dailyLossFloor = data.dailyDrawdown.dailyLossFloor
  const highWaterMark = Math.max(Number(data.peakEquity || accountSize), accountSize)
  const isTrailing = phase.maxDrawdownType === 'trailing'
  const maxLossFloor = isTrailing
    ? highWaterMark - (highWaterMark * (Number(phase.maxDrawdownPercent || 0) / 100))
    : accountSize - maxLossLimit

  // Current balance = last growth point or accountSize
  const growthPoints = data.growth || []
  const lastPoint = growthPoints[growthPoints.length - 1]
  const currentBalance = lastPoint ? Number(lastPoint.balance) : accountSize

  return {
    accountSize,
    targetBalance: accountSize + targetAmount,
    dailyLossFloor,
    maxLossFloor,
    currentBalance,
  }
}

function buildChartData(data: PropFirmWidgetData, refs: GrowthReferences): GrowthPoint[] {
  const points: GrowthPoint[] = [
    {
      label: 'Start',
      timestamp: 0,
      balance: refs.accountSize,
      pnl: 0,
      tradePnl: 0,
    },
    ...data.growth.map((point) => ({
      ...point,
    })),
  ]

  if (points.length === 1) {
    const firstPoint = points[0]!
    points.push({
      ...firstPoint,
      label: 'Current',
      timestamp: 1,
    })
  }

  return points
}

function getYAxisConfig(chartData: GrowthPoint[], refs: GrowthReferences) {
  // The Y-axis must show exact meaningful values
  const balances = chartData.map((p) => Number(p.balance || 0)).filter((v) => !isNaN(v) && v > 0)
  const currentBalance = balances.length > 0 ? balances[balances.length - 1]! : refs.accountSize

  // Gather all reference values that MUST be shown:
  const keyRefs = [
    refs.accountSize,
    refs.targetBalance,
  ]
  if (refs.dailyLossFloor > 0) keyRefs.push(refs.dailyLossFloor)
  if (refs.maxLossFloor > 0) keyRefs.push(refs.maxLossFloor)
  if (Math.abs(currentBalance - refs.accountSize) > 1) {
    keyRefs.push(Math.round(currentBalance * 100) / 100)
  }

  const allValues = [
    ...keyRefs,
    ...balances,
  ].filter((v) => !isNaN(v) && v > 0)

  const rawMin = Math.min(...allValues)
  const rawMax = Math.max(...allValues)
  const range = rawMax - rawMin

  // Domain: small padding so reference lines don't sit on the edge
  const pad = Math.max(range * 0.05, 10)
  const domainMin = Math.floor(rawMin - pad)
  const domainMax = Math.ceil(rawMax + pad)

  const tickSet = new Set<number>(keyRefs)

  // Find a nice step size
  const rawStep = range / 6
  let step = 10
  if (rawStep > 5000) step = 5000
  else if (rawStep > 2000) step = 2000
  else if (rawStep > 1000) step = 1000
  else if (rawStep > 500) step = 500
  else if (rawStep > 200) step = 200
  else if (rawStep > 100) step = 100
  else if (rawStep > 50) step = 50
  else if (rawStep > 20) step = 20
  else if (rawStep > 10) step = 10
  else if (rawStep > 5) step = 5
  else if (rawStep > 2) step = 2
  else if (rawStep > 1) step = 1

  // Minimum distance between ticks to prevent overlapping/cluttering (e.g. 2.5% of range)
  const minDistance = Math.max(range * 0.025, 2)

  const startTick = Math.ceil(domainMin / step) * step
  for (let t = startTick; t <= domainMax; t += step) {
    // Only add if it's not too close to any key reference value
    const isTooClose = keyRefs.some(ref => Math.abs(ref - t) < minDistance)
    if (!isTooClose) {
      tickSet.add(t)
    }
  }

  const ticks = Array.from(tickSet).sort((a, b) => a - b)

  return {
    domain: [domainMin, domainMax] as [number, number],
    ticks,
    currentBalance,
  }
}

function GrowthTooltip({
  active,
  payload,
  refs,
}: {
  active?: boolean
  payload?: Array<{ payload?: GrowthPoint }>
  refs: GrowthReferences
}) {
  const { formatValue, isPrivacyMode } = useDashboardDisplay()
  const forcedMode = isPrivacyMode ? 'privacy' : 'dollars'

  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  if (!point) return null

  const balance = Number(point.balance || 0)
  const isStart = point.label === 'Start'
  const targetDistance = Number(refs?.targetBalance || 0) - balance
  const dailyDistance = balance - Number(refs?.dailyLossFloor || 0)
  const maxDistance = balance - Number(refs?.maxLossFloor || 0)

  return (
    <div className="rounded-xl border border-border/40 bg-popover/95 p-3 text-xs shadow-xl backdrop-blur">
      <p className="mb-2 font-bold text-foreground">
        {isStart ? 'Start balance' : `Trade ${point.label}`}
      </p>
      <div className="space-y-1.5 text-muted-foreground">
        <div className="flex min-w-[12rem] justify-between gap-4">
          <span>Equity</span>
          <span className="font-mono text-foreground">
            {formatValue(balance, { kind: 'money', sensitive: true, forceMode: forcedMode })}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Net P&L</span>
          <span className={(point.pnl ?? 0) >= 0 ? 'font-mono text-long' : 'font-mono text-short'}>
            {formatValue(point.pnl ?? 0, { kind: 'money', sensitive: true, forceMode: forcedMode })}
          </span>
        </div>
        {!isStart && (
          <div className="flex justify-between gap-4">
            <span>Trade P&L</span>
            <span className={(point.tradePnl ?? 0) >= 0 ? 'font-mono text-long' : 'font-mono text-short'}>
              {formatValue(point.tradePnl ?? 0, { kind: 'money', sensitive: true, forceMode: forcedMode })}
            </span>
          </div>
        )}
        <div className="h-px bg-border/50 my-2" />

        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-[2px] rounded bg-long" />
            To target
          </span>
          <span className="font-mono text-long">
            {formatValue(targetDistance, { kind: 'money', sensitive: true, forceMode: forcedMode })}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-[2px] rounded bg-amber-500" />
            Above daily DD
          </span>
          <span className="font-mono text-amber-500">
            {formatValue(dailyDistance, { kind: 'money', sensitive: true, forceMode: forcedMode })}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-[2px] rounded bg-short" />
            Above max DD
          </span>
          <span className="font-mono text-short">
            {formatValue(maxDistance, { kind: 'money', sensitive: true, forceMode: forcedMode })}
          </span>
        </div>

        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-[2px] rounded bg-muted-foreground" />
            Start
          </span>
          <span className="font-mono text-muted-foreground">
            {formatValue(refs?.accountSize ?? 0, { kind: 'money', sensitive: true, forceMode: forcedMode })}
          </span>
        </div>
      </div>
    </div>
  )
}

export function PropFirmGrowthCurveWidget() {
  const { chartStyle } = useTheme()
  const { formatValue, isPrivacyMode } = useDashboardDisplay()
  const forcedMode = isPrivacyMode ? 'privacy' : 'dollars'

  return (
    <PropFirmWidgetShell title="Prop Firm Growth Curve">
      {({ data }) => {
        const account = data.account
        if (!account) return null
        const refs = getReferenceValues(account, data)
        const chartData = buildChartData(data, refs)
        const yAxisConfig = getYAxisConfig(chartData, refs)

        const isSharp = chartStyle === 'sharp'
        const strokeColor = 'hsl(var(--primary))'
        const gradientColor = 'hsl(var(--primary))'
        const curveType = isSharp ? 'linear' : 'monotone'

        return (
          <div className="flex h-full min-h-0 flex-col gap-4">
            <div className="grid gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground sm:grid-cols-4">
              <span>
                Start{' '}
                <b className="font-mono text-foreground">
                  {formatValue(refs.accountSize, { kind: 'money', sensitive: true, forceMode: forcedMode })}
                </b>
              </span>
              <span>
                Target{' '}
                <b className="font-mono text-long">
                  {formatValue(refs.targetBalance, { kind: 'money', sensitive: true, forceMode: forcedMode })}
                </b>
              </span>
              <span>
                Daily DD{' '}
                <b className="font-mono text-amber-500">
                  {formatValue(refs.dailyLossFloor, { kind: 'money', sensitive: true, forceMode: forcedMode })}
                </b>
              </span>
              <span>
                Max DD{' '}
                <b className="font-mono text-short">
                  {formatValue(refs.maxLossFloor, { kind: 'money', sensitive: true, forceMode: forcedMode })}
                </b>
              </span>
            </div>

            <div className="min-h-[260px] flex-1 sm:min-h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 18, right: 72, bottom: 8, left: 10 }}
                >
                  <defs>
                    <linearGradient id="propFirmGrowth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={gradientColor} stopOpacity={0.32} />
                      <stop offset="95%" stopColor={gradientColor} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    opacity={0.35}
                  />

                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10 }}
                    minTickGap={14}
                  />

                  <YAxis
                    width={60}
                    domain={yAxisConfig.domain}
                    ticks={yAxisConfig.ticks}
                    tickLine={false}
                    axisLine={false}
                    tick={isPrivacyMode ? false : { fontSize: 9 }}
                    tickFormatter={(value) =>
                      isPrivacyMode
                        ? ''
                        : formatValue(Number(value), {
                            kind: 'money',
                            compact: false,
                            sensitive: true,
                            forceMode: forcedMode,
                          })
                    }
                  />

                  <Tooltip
                    content={<GrowthTooltip refs={refs} />}
                    cursor={{
                      stroke: strokeColor,
                      strokeDasharray: '4 4',
                      strokeWidth: 1.5,
                    }}
                    isAnimationActive={false}
                    filterNull={false}
                  />

                  <ReferenceLine
                    y={refs.accountSize}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="4 4"
                    label={{
                      value: 'Start',
                      position: 'right',
                      fontSize: 9,
                      fill: 'hsl(var(--muted-foreground))',
                      offset: 8,
                    }}
                  />
                  <ReferenceLine
                    y={refs.targetBalance}
                    stroke="hsl(var(--success))"
                    strokeDasharray="5 5"
                    label={{
                      value: 'Target',
                      position: 'right',
                      fontSize: 9,
                      fill: 'hsl(var(--success))',
                      offset: 8,
                    }}
                  />
                  <ReferenceLine
                    y={refs.dailyLossFloor}
                    stroke="#f59e0b"
                    strokeDasharray="5 5"
                    label={{
                      value: 'Daily DD',
                      position: 'right',
                      fontSize: 9,
                      fill: '#f59e0b',
                      offset: 8,
                    }}
                  />
                  <ReferenceLine
                    y={refs.maxLossFloor}
                    stroke="hsl(var(--destructive))"
                    strokeDasharray="5 5"
                    label={{
                      value: 'Max DD',
                      position: 'right',
                      fontSize: 9,
                      fill: 'hsl(var(--destructive))',
                      offset: 8,
                    }}
                  />

                  <Area
                    type={curveType}
                    dataKey="balance"
                    stroke={strokeColor}
                    strokeWidth={2.5}
                    fill="url(#propFirmGrowth)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2 }}
                    isAnimationActive={false}
                    baseValue={yAxisConfig.domain[0]}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )
      }}
    </PropFirmWidgetShell>
  )
}
