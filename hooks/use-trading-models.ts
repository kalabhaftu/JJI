import { useQuery } from '@tanstack/react-query'
import { isDemoSurface } from '@/lib/public-surface-routing'
import { apiRequestData } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/query-keys'
import { useQueryScope } from '@/lib/query/use-query-scope'

export interface TradingModel {
  id: string
  name: string
  description?: string
  [key: string]: any
}

export interface TradingModelFilters {
  accounts?: string[]
  dateFrom?: string
  dateTo?: string
}

function buildTradingModelQuery(filters?: TradingModelFilters) {
  const params = new URLSearchParams()
  if (filters?.accounts?.length) params.set('accounts', filters.accounts.join(','))
  if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters?.dateTo) params.set('dateTo', filters.dateTo)
  const query = params.toString()
  return query ? `?${query}` : ''
}

export function useTradingModels(filters?: TradingModelFilters) {
  const isDemo = typeof window !== 'undefined' && isDemoSurface(window.location.hostname, window.location.pathname)
  const scope = useQueryScope()

  const { data, isLoading, error } = useQuery<TradingModel[] | null>({
    queryKey: queryKeys.playbookModels(scope, filters ?? {}),
    queryFn: async () => {
      if (isDemo) {
        return [
          {
            id: 'tm-1',
            name: 'EMA Cross',
            description: 'Exponential Moving Average crossover strategy',
            rules: [
              { category: 'entry', text: '50 EMA crosses above 200 EMA' },
              { category: 'exit', text: 'Price closes below 50 EMA' },
              { category: 'risk', text: 'Max risk 1% per trade' }
            ],
            setups: ['Trend Following', 'Crossover'],
            notes: 'High win rate during trending markets, but performs poorly in choppy ranges.',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            stats: {
              tradeCount: 35,
              totalPnL: 2840,
              winRate: 62.8,
              winCount: 22,
              lossCount: 13,
              breakEvenCount: 0,
              avgAdherence: 95,
              ruleAdherence: {
                '50 EMA crosses above 200 EMA': { followed: 34, total: 35 },
                'Price closes below 50 EMA': { followed: 35, total: 35 },
                'Max risk 1% per trade': { followed: 33, total: 35 }
              }
            }
          },
          {
            id: 'tm-2',
            name: 'ICT Silver Bullet',
            description: 'ICT Silver Bullet strategy',
            rules: [
              { category: 'entry', text: 'Fair Value Gap created in the Silver Bullet hour' },
              { category: 'confirmation', text: 'Market Structure Shift on 1m chart' }
            ],
            setups: ['FVG Sweep', 'MSS'],
            notes: 'Trade only during NY AM session (10:00 - 11:00 AM EST). Keep leverage tight.',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            stats: {
              tradeCount: 20,
              totalPnL: 1450,
              winRate: 55.0,
              winCount: 11,
              lossCount: 9,
              breakEvenCount: 0,
              avgAdherence: 88,
              ruleAdherence: {
                'Fair Value Gap created in the Silver Bullet hour': { followed: 18, total: 20 },
                'Market Structure Shift on 1m chart': { followed: 17, total: 20 }
              }
            }
          },
          {
            id: 'tm-3',
            name: 'SMT Divergence',
            description: 'Smart Money Tool divergence strategy',
            rules: [
              { category: 'entry', text: 'Divergence between correlated assets (e.g. EU/GU)' },
              { category: 'exit', text: 'Opposing Liquidity Pool reached' }
            ],
            setups: ['Correlation Divergence'],
            notes: 'Watch daily bias before confirming divergence. Higher timeframe key.',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            stats: {
              tradeCount: 15,
              totalPnL: 1250,
              winRate: 66.7,
              winCount: 10,
              lossCount: 5,
              breakEvenCount: 0,
              avgAdherence: 93,
              ruleAdherence: {
                'Divergence between correlated assets (e.g. EU/GU)': { followed: 14, total: 15 },
                'Opposing Liquidity Pool reached': { followed: 14, total: 15 }
              }
            }
          },
          {
            id: 'tm-4',
            name: 'Liquidity Sweep',
            description: 'Liquidity sweep and market structure shift',
            rules: [
              { category: 'entry', text: 'Previous day high/low sweep' },
              { category: 'confluence', text: 'Sweep occurs at key killzone time' }
            ],
            setups: ['Range Expansion'],
            notes: 'High R:R setup. Wait for price displacement after the sweep.',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            stats: {
              tradeCount: 10,
              totalPnL: -128,
              winRate: 40.0,
              winCount: 4,
              lossCount: 6,
              breakEvenCount: 0,
              avgAdherence: 78,
              ruleAdherence: {
                'Previous day high/low sweep': { followed: 8, total: 10 },
                'Sweep occurs at key killzone time': { followed: 7, total: 10 }
              }
            }
          }
        ]
      }
      const response = await apiRequestData<{ models?: TradingModel[] } | null>(
        `/api/v1/user/trading-models${buildTradingModelQuery(filters)}`,
        { retry: { mode: 'safe' }, operation: 'load-trading-models' },
      )
      return Array.isArray(response?.models) ? response.models : []
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  const tradingModels = Array.isArray(data) ? data : []

  return { tradingModels, isLoading, error }
}
