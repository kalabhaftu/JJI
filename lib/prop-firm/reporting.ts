import type { PhaseAccountType } from '@/lib/db/schema/accounts';
import type { TradeType } from '@/lib/db/schema/trades';
import type { PayoutType, MasterAccountType } from '@/lib/db/schema/accounts';

import { groupTradesByExecution, type GroupedTrade } from '@/lib/utils'
import { calculateWinRate } from '@/lib/metrics/outcome'

export type PropFirmLifecycleStatus =
  | 'active'
  | 'funded'
  | 'failed'
  | 'passed'
  | 'pending_approval'

export interface PhaseHistorySummary {
  id: string
  phaseNumber: number
  phaseId: string | null
  status: string
  isFundedStage: boolean
}

export interface PropFirmPhaseMetrics {
  groupedTrades: GroupedTrade[]
  tradeCount: number
  activeDays: number
  grossPnl: number
  netPnl: number
  winRate: string
  profitFactor: string
  expectancy: string
  peakProfit: number
  maxDrawdown: number
  maxDrawdownPct: string
  totalPayouts: number
  breachCount: number
}

type ReportPhase = PhaseAccountType & {
  Trade?: TradeType[]
  Payout?: PayoutType[]
  BreachRecord?: Array<{ id: string }>
}

type ReportMasterAccount = MasterAccountType & {
  PhaseAccount: ReportPhase[]
}

export function isFundedPhaseForEvaluation(evaluationType: string, phaseNumber: number): boolean {
  switch (evaluationType) {
    case 'Two Step':
      return phaseNumber >= 3
    case 'One Step':
      return phaseNumber >= 2
    case 'Instant':
      return phaseNumber >= 1
    default:
      return phaseNumber >= 3
  }
}

export function resolveReportPhase(master: ReportMasterAccount): ReportPhase | null {
  if (!master.PhaseAccount?.length) return null

  const byPhaseNumber = [...master.PhaseAccount].sort((a, b) => a.phaseNumber - b.phaseNumber)

  const configuredCurrentPhase = byPhaseNumber.find((phase) => phase.phaseNumber === master.currentPhase)
  if (configuredCurrentPhase) return configuredCurrentPhase

  const livePhase = [...byPhaseNumber]
    .filter((phase) => phase.status === 'active' || phase.status === 'pending_approval')
    .sort((a, b) => {
      const priority = (status: string | null) => (status === 'active' ? 0 : 1)
      return priority(a.status) - priority(b.status) || b.phaseNumber - a.phaseNumber
    })[0]

  if (livePhase) return livePhase

  return [...byPhaseNumber].sort((a, b) => b.phaseNumber - a.phaseNumber)[0] ?? null
}

export function derivePropFirmLifecycleStatus(
  master: Pick<MasterAccountType, 'status' | 'evaluationType'> & { PhaseAccount?: Array<Pick<PhaseAccountType, 'status' | 'phaseNumber'>> },
  resolvedPhase: Pick<PhaseAccountType, 'status' | 'phaseNumber'> | null
): PropFirmLifecycleStatus {
  if (!resolvedPhase) {
    return master.status === 'failed' ? 'failed' : master.status === 'funded' ? 'funded' : 'passed'
  }

  const isFundedStage = isFundedPhaseForEvaluation(master.evaluationType, resolvedPhase.phaseNumber)
  const phaseStatuses = new Set((master.PhaseAccount ?? []).map((phase) => phase.status))

  if (resolvedPhase.status === 'pending_approval') return 'pending_approval'
  if (resolvedPhase.status === 'failed') return 'failed'
  if (resolvedPhase.status === 'active') return isFundedStage || master.status === 'funded' ? 'funded' : 'active'
  if (resolvedPhase.status === 'passed') return 'passed'

  if (resolvedPhase.status === 'pending') {
    return phaseStatuses.has('passed') ? 'passed' : 'pending_approval'
  }

  if (master.status === 'failed' && !phaseStatuses.has('active') && !phaseStatuses.has('pending_approval')) {
    return 'failed'
  }

  if (master.status === 'funded') return 'funded'
  return 'passed'
}

export function summarizePhaseHistory(master: Pick<MasterAccountType, 'evaluationType'> & { PhaseAccount: ReportPhase[] }): PhaseHistorySummary[] {
  return [...master.PhaseAccount]
    .sort((a, b) => a.phaseNumber - b.phaseNumber)
    .map((phase) => ({
      id: phase.id,
      phaseNumber: phase.phaseNumber,
      phaseId: phase.phaseId,
      status: phase.status ?? 'pending',
      isFundedStage: isFundedPhaseForEvaluation(master.evaluationType, phase.phaseNumber),
    }))
}

export function calculatePropFirmPhaseMetrics(
  phase: ReportPhase,
  accountSize: number
): PropFirmPhaseMetrics {
  const groupedTrades = groupTradesByExecution((phase.Trade ?? []) as TradeType[])
  const tradeDates = new Set<string>()
  let grossPnl = 0
  let netPnl = 0
  let wins = 0
  let losses = 0
  let totalGrossProfit = 0
  let totalGrossLoss = 0
  let runningNetPnl = 0
  let peakProfit = 0
  let maxDrawdown = 0

  for (const trade of groupedTrades) {
    const gross = Number(trade.pnl || 0)
    const commission = Number(trade.commission || 0)
    const net = gross + commission

    grossPnl += gross
    netPnl += net

    if (trade.entryDate) {
      tradeDates.add(String(trade.entryDate).slice(0, 10))
    }

    if (net > 0) {
      wins++
      totalGrossProfit += net
    } else if (net < 0) {
      losses++
      totalGrossLoss += Math.abs(net)
    }

    runningNetPnl += net
    if (runningNetPnl > peakProfit) peakProfit = runningNetPnl
    const drawdown = peakProfit - runningNetPnl
    if (drawdown > maxDrawdown) maxDrawdown = drawdown
  }

  const profitFactor = totalGrossLoss > 0
    ? (totalGrossProfit / totalGrossLoss).toFixed(2)
    : totalGrossProfit > 0
      ? '99.00'
      : '0.00'

  const paidPayouts = (phase.Payout ?? [])
    .filter((payout: PayoutType) => payout.status === 'paid')
    .reduce((sum: number, payout: PayoutType) => sum + Number(payout.amount || 0), 0)

  return {
    groupedTrades,
    tradeCount: groupedTrades.length,
    activeDays: tradeDates.size,
    grossPnl,
    netPnl,
    winRate: calculateWinRate(wins, losses).toFixed(1),
    profitFactor,
    expectancy: groupedTrades.length > 0 ? (netPnl / groupedTrades.length).toFixed(2) : '0.00',
    peakProfit,
    maxDrawdown,
    maxDrawdownPct: accountSize > 0 ? ((maxDrawdown / accountSize) * 100).toFixed(2) : '0.00',
    totalPayouts: paidPayouts,
    breachCount: phase.BreachRecord?.length ?? 0,
  }
}
