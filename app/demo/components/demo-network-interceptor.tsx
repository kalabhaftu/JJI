'use client'

import { useLayoutEffect } from 'react'
import * as mockData from '@/lib/demo/mock-data'
import { isDemoSurface } from '@/lib/public-surface-routing'

export function DemoNetworkInterceptor() {
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return

    const originalFetch = window.fetch
    const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' }
    })

    window.fetch = async function (input, init) {
      if (!isDemoSurface(window.location.hostname, window.location.pathname)) {
        return originalFetch.apply(this, [input, init])
      }
      const request = input instanceof Request ? input : null
      const urlString = typeof input === 'string' ? input : request?.url || ''

      try {
        const parsedUrl = new URL(urlString, window.location.origin)
        const pathname = parsedUrl.pathname
        const method = (init?.method || request?.method || 'GET').toUpperCase()
        const isInternalApi =
          parsedUrl.origin === window.location.origin &&
          (
            pathname.startsWith('/api/v1/') ||
            pathname.startsWith('/api/auth/') ||
            pathname === '/api/build-id' ||
            pathname.startsWith('/api/health/')
          )

        if (isInternalApi) {

          await new Promise(resolve => setTimeout(resolve, 80))

          if (pathname.match(/^\/api\/build-id$/)) {
            return jsonResponse({ buildId: 'demo-build' })
          }

          if (pathname.match(/^\/api\/health\/ping$/)) {
            return jsonResponse({ success: true, demo: true })
          }

          if (pathname.match(/^\/api\/auth\/check$/)) {
            return jsonResponse({ authenticated: true, user: mockData.MOCK_USER_PROFILE })
          }

          if (pathname.match(/^\/api\/auth\/restore$/)) {
            return jsonResponse({ success: true, user: mockData.MOCK_USER_PROFILE })
          }

          if (method === 'POST' && pathname.match(/^\/api\/v1\/reports\/stats$/)) {
            return jsonResponse(mockData.getMockReportStats())
          }

          if (pathname.match(/^\/api\/auth\/profile$/) || pathname.match(/^\/api\/v1\/profile$/)) {
            return jsonResponse({ success: true, data: mockData.MOCK_USER_PROFILE, user: mockData.MOCK_USER_PROFILE })
          }

          if (pathname.match(/^\/api\/v1\/auth\/webhook-token$/) || pathname.match(/^\/api\/v1\/settings\/webhook-token$/)) {
            return jsonResponse({ success: true, token: mockData.MOCK_WEBHOOK_TOKEN.token, data: mockData.MOCK_WEBHOOK_TOKEN })
          }

          if (method !== 'GET') {
            return jsonResponse({ success: true, message: 'Action simulated in Demo Mode', demo: true })
          }

          if (pathname.match(/^\/api\/v1\/init$/)) {
            return jsonResponse({
              isAuthenticated: true,
              user: mockData.MOCK_USER_PROFILE,
              accounts: mockData.MOCK_ACCOUNTS,
              activeTemplateShell: {
                id: "demo-template-shell",
                userId: "demo-user",
                name: "Default Template",
                isDefault: true,
                isActive: true,
                layout: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            })
          }

          if (pathname.match(/^\/api\/v1\/accounts$/)) {
            return jsonResponse({
              success: true,
              data: mockData.MOCK_ACCOUNTS,
              pagination: { total: mockData.MOCK_ACCOUNTS.length, page: 1, limit: 50, totalPages: 1 }
            })
          }

          if (pathname.match(/^\/api\/v1\/accounts\/mock-acc-1$/)) {
            return jsonResponse({ success: true, data: mockData.MOCK_LIVE_ACCOUNT_DETAILS })
          }

          if (pathname.match(/^\/api\/v1\/prop-firm\/accounts$/)) {
            return jsonResponse({
              success: true,
              data: mockData.MOCK_ACCOUNTS.filter(a => a.accountType === 'prop-firm')
            })
          }

          if (pathname.match(/^\/api\/v1\/prop-firm\/accounts\/[^\/]+$/)) {
            const isFailedAcc = pathname.includes('mock-propfirm-failed');
            const data = mockData.getMockPropFirmDetails(isFailedAcc);
            return jsonResponse({ success: true, data });
          }

          if (pathname.match(/^\/api\/v1\/prop-firm\/accounts\/[^\/]+\/payouts\/eligibility$/)) {
            return jsonResponse({ success: true, data: mockData.MOCK_PAYOUT_ELIGIBILITY });
          }

          if (pathname.match(/^\/api\/v1\/prop-firm\/accounts\/[^\/]+\/trades$/)) {
            const isFailedAcc = pathname.includes('mock-propfirm-failed');
            const targetAccId = isFailedAcc ? 'mock-propfirm-failed' : 'mock-propfirm-1';
            const allTrades = mockData.getMockTradesList();
            const propFirmTrades = allTrades.filter(t => t.accountId === targetAccId);
            return jsonResponse({ success: true, data: { trades: propFirmTrades } });
          }

          if (pathname.match(/^\/api\/v1\/trades$/)) {
            return jsonResponse(mockData.getMockDemoData())
          }

          if (pathname.match(/^\/api\/v1\/goals$/)) {
            return jsonResponse({ success: true, goals: mockData.MOCK_GOALS })
          }

          if (pathname.match(/^\/api\/v1\/notifications$/)) {
            return jsonResponse({
              success: true,
              data: {
                notifications: mockData.MOCK_NOTIFICATIONS,
                unreadCount: 2
              }
            })
          }

          if (pathname.match(/^\/api\/v1\/subscription\/status$/) || pathname.match(/^\/api\/v1\/settings\/subscription$/)) {
            return jsonResponse({ success: true, data: mockData.MOCK_SUBSCRIPTION })
          }

          if (pathname.match(/^\/api\/v1\/tags$/)) {
            return jsonResponse({
              success: true,
              tags: [
                { id: 'tag-1', name: 'Trend', color: '#3b82f6' },
                { id: 'tag-2', name: 'Reversal', color: '#ef4444' },
                { id: 'tag-3', name: 'Breakout', color: '#10b981' },
                { id: 'tag-4', name: 'Range', color: '#f59e0b' },
                { id: 'tag-5', name: 'Session Start', color: '#8b5cf6' }
              ]
            })
          }

          if (pathname.match(/^\/api\/v1\/user\/trading-models/)) {
            return jsonResponse({
              success: true,
              data: [
                { id: 'tm-1', name: 'EMA Cross', description: 'Exponential Moving Average crossover', rules: [], setups: [], notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                { id: 'tm-2', name: 'ICT Silver Bullet', description: 'ICT kill zone entry model', rules: [], setups: [], notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                { id: 'tm-3', name: 'SMT Divergence', description: 'Smart money divergence', rules: [], setups: [], notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                { id: 'tm-4', name: 'Liquidity Sweep', description: 'Liquidity grab before reversal', rules: [], setups: [], notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
                { id: 'tm-5', name: 'Order Block', description: 'Institutional order block entry', rules: [], setups: [], notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
              ]
            })
          }

          if (pathname.match(/^\/api\/v1\/live-accounts\/transactions$/)) {
            return jsonResponse({
              success: true,
              data: [
                { id: 'mock-tx-1', accountId: 'mock-acc-1', type: 'DEPOSIT', amount: 100000, description: 'Initial Deposit', createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() }
              ]
            })
          }

          if (pathname.match(/^\/api\/v1\/reports\/propfirm$/)) {
            return jsonResponse({
              success: true,
              data: {
                accounts: [{
                  id: 'mock-propfirm-1',
                  accountName: 'Demo Prop Firm Account',
                  propFirmName: 'FTMO',
                  accountSize: 100000,
                  status: 'active',
                  totalTrades: 27,
                  totalPnL: 5432,
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
                  phaseHistory: [{ id: 'mock-phase-1', phaseNumber: 1, phaseId: 'FTMO-PHASE-1', status: 'active', isFundedStage: false }]
                }]
              }
            })
          }

          if (pathname.match(/^\/api\/v1\/settings\/account-filters$/)) {
            return jsonResponse({
              success: true,
              data: { selectedAccountIds: [], showAllAccounts: true }
            })
          }

          if (pathname.match(/^\/api\/v1\/(tradovate|dxfeed|rithmic)\/synchronizations$/)) {
            return jsonResponse({ success: true, data: [] })
          }

          if (pathname.match(/^\/api\/v1\/weekly-review$/)) {
            return jsonResponse({ success: true, data: [] })
          }

          if (pathname.match(/^\/api\/v1\/journal\/ai-analysis$/)) {
            return jsonResponse({ success: true, analysis: null })
          }

          if (pathname.match(/^\/api\/v1\/ai\/chats$/) || pathname.match(/^\/api\/v1\/ai\/insights$/)) {
            return jsonResponse({ success: true, data: [] })
          }

          if (pathname.match(/^\/api\/v1\/news-events$/)) {
            return jsonResponse([])
          }

          if (pathname.match(/^\/api\/v1\/settings\/backtest-mode$/)) {
            return jsonResponse({ success: true, mode: 'manual' })
          }

          if (pathname.match(/^\/api\/v1\/backtesting$/)) {
            return jsonResponse({ backtests: [] })
          }

          console.warn(`[Demo] Blocked unhandled internal API request: ${method} ${pathname}`)
          return jsonResponse({ success: false, error: 'Not implemented in demo mode', demo: true }, 501)
        }
      } catch (e) {
        console.warn('[Demo] Failed to inspect request before demo interception', e)
      }

      return originalFetch.apply(this, [input, init])
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [])

  return null
}
