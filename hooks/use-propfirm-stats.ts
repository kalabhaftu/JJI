import { useQuery } from '@tanstack/react-query'
import type { PropFirmSummaryDTO } from '@/lib/statistics/propfirm-statistics'
import { useUserStore } from '@/store/user-store'

export function usePropFirmStats(initialData?: PropFirmSummaryDTO) {
  const user = useUserStore(state => state.user)
  const isDemo = typeof window !== 'undefined' && window.location.pathname.startsWith('/demo')

  return useQuery<PropFirmSummaryDTO>({
    queryKey: ['propfirm-stats', isDemo],
    queryFn: async () => {
      if (isDemo) {
        return {
          totalAccounts: 1,
          activeAccounts: 1,
          fundedAccounts: 0,
          failedAccounts: 0,
          passedPhases: 0,
          totalNetPnL: 5432,
          totalGrossPnL: 5600,
          totalPayoutsReceived: 0,
          totalBreaches: 0,
          accounts: [{
            id: 'mock-prop-firm-1',
            masterId: 'mock-prop-firm-1',
            accountName: 'Demo Challenge',
            propFirmName: 'FTMO',
            accountSize: 100000,
            evaluationType: '2-Phase Challenge',
            masterStatus: 'active',
            lifecycleStatus: 'active',
            currentPhaseNumber: 1,
            currentPhaseStatus: 'active',
            isFundedStage: false,
            grossPnL: 5600,
            netPnL: 5432,
            profitTargetAmount: 8000,
            profitTargetProgressPct: 70,
            tradeCount: 80,
            activeDays: 12,
            winRate: '55.0',
            profitFactor: '1.58',
            expectancy: '67.90',
            peakProfit: 6200,
            maxDrawdown: 1200,
            maxDrawdownPct: '1.20',
            breachCount: 0,
            totalPayouts: 0,
            durationDays: 15,
            phaseHistory: [
              { id: 'mock-acc-1', phaseNumber: 1, phaseId: 'mock-acc-1', status: 'active', isFundedStage: false }
            ]
          }]
        }
      }
      const res = await fetch('/api/v1/reports/propfirm')
      if (!res.ok) throw new Error('Failed to fetch prop firm stats')
      return res.json()
    },
    ...(initialData !== undefined && { initialData }),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}
