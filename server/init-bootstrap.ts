import { db } from '@/lib/db/client'
import { reportError } from '@/lib/observability/report-error'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { cloneDefaultTemplateLayout } from '@/lib/dashboard/default-template-layout'
import { TRADE_COUNT_SELECT, buildGroupedTradeCountSummary } from '@/lib/trade-counts'
import { USER_SETTINGS_SELECT, mergeUserSettings } from '@/lib/user-settings'
import { ensureActiveTemplateForUser } from '@/server/seed-default-template'
import {
  checkSubscriptionAccess,
  type SubscriptionGuardResult,
} from '@/lib/services/subscription-guard-service'

interface ActiveTemplateShell {
  id: string
  userId: string
  name: string
  isDefault: boolean
  isActive: boolean
  layout: any[]
  createdAt: Date
  updatedAt: Date
}

export interface InitBootstrapPayload {
  isAuthenticated: boolean
  user: any | null
  accounts: any[]
  activeTemplateShell: ActiveTemplateShell | null
  subscriptionAccess: SubscriptionGuardResult | null
}

export async function getInitBootstrapData(): Promise<InitBootstrapPayload> {
  try {
    const identity = await getResolvedUserIdentitySafe()

    if (!identity) {
      return {
        isAuthenticated: false,
        user: null,
        accounts: [],
        activeTemplateShell: null,
        subscriptionAccess: null,
      }
    }

    const userLookup = await db.query.User.findFirst({
      where: (table, { eq }) => eq(table.id, identity.internalUserId),
      columns: {
        id: true,
        email: true,
        auth_user_id: true,
        isFirstConnection: true,
        firstName: true,
        lastName: true,
        onboardingStatus: true,
        role: true,
      },
      with: {
        settings: {
          columns: USER_SETTINGS_SELECT as any,
        },
      },
    })

    if (!userLookup) {
      return {
        isAuthenticated: false,
        user: null,
        accounts: [],
        activeTemplateShell: null,
        subscriptionAccess: null,
      }
    }

    const internalUserId = userLookup.id

    const [accounts, propFirmAccounts, allTrades, activeTemplate, subscriptionAccess] = await Promise.all([
      db.query.Account.findMany({
        where: (table, { eq }) => eq(table.userId, internalUserId),
        orderBy: (table, { desc }) => [desc(table.createdAt)],
      }),
      db.query.MasterAccount.findMany({
        where: (table, { eq }) => eq(table.userId, internalUserId),
        with: { PhaseAccount: { orderBy: (table, { asc }) => [asc(table.phaseNumber)] } },
      }),
      db.query.Trade.findMany({
        where: (table, { eq }) => eq(table.userId, internalUserId),
        columns: TRADE_COUNT_SELECT as any,
      }),
      ensureActiveTemplateForUser(internalUserId),
      checkSubscriptionAccess(internalUserId, userLookup.role ?? undefined),
    ])

    const groupedCounts = buildGroupedTradeCountSummary(allTrades as any)

    const isFundedPhase = (evaluationType: string, phaseNumber: number): boolean => {
      switch (evaluationType) {
        case 'Two Step': return phaseNumber >= 3
        case 'One Step': return phaseNumber >= 2
        case 'Instant': return phaseNumber >= 1
        default: return phaseNumber >= 3
      }
    }

    const getPhaseDisplayName = (evaluationType: string, phaseNumber: number): string => {
      if (isFundedPhase(evaluationType, phaseNumber)) return 'Funded'
      return `Phase ${phaseNumber}`
    }

    const processedLiveAccounts = accounts.map((acc: typeof accounts[number]) => ({
      ...acc,
      propfirm: '',
      tradeCount: groupedCounts.groupedCountByLiveAccountNumber.get(acc.number) || 0,
      accountType: 'live' as const,
      displayName: acc.name || acc.number,
      status: 'active' as const,
      currentPhase: null,
      currentPhaseDetails: null,
      isArchived: acc.isArchived || false,
    }))

    const processedPropFirmAccounts: any[] = []
    propFirmAccounts.forEach((masterAccount: any) => {
      if (masterAccount.PhaseAccount?.length > 0) {
        masterAccount.PhaseAccount.forEach((phase: any) => {
          if (phase.status === 'pending' || phase.status === 'pending_approval') return
          if (!phase.phaseId || phase.phaseId.trim() === '') return

          const phaseName = getPhaseDisplayName(masterAccount.evaluationType, phase.phaseNumber)
          const phaseTradeCount =
            groupedCounts.groupedCountByPhaseAccountId.get(phase.id) ||
            groupedCounts.groupedCountByAccountNumber.get(phase.phaseId) ||
            0

          processedPropFirmAccounts.push({
            id: phase.id,
            number: phase.phaseId,
            name: masterAccount.accountName,
            propfirm: masterAccount.propFirmName,
            broker: undefined,
            startingBalance: phase.accountSize || masterAccount.accountSize,
            accountType: 'prop-firm' as const,
            displayName: `${masterAccount.accountName} (${phaseName})`,
            tradeCount: phaseTradeCount,
            status: phase.status,
            currentPhase: phase.phaseNumber,
            createdAt: phase.createdAt || masterAccount.createdAt,
            userId: masterAccount.userId,
            isArchived: masterAccount.isArchived || false,
            currentPhaseDetails: {
              phaseNumber: phase.phaseNumber,
              status: phase.status,
              phaseId: phase.phaseId,
              masterAccountId: masterAccount.id,
              masterAccountName: masterAccount.accountName,
              evaluationType: masterAccount.evaluationType,
            }
          })
        })
      }
    })

    const activeTemplateShell: ActiveTemplateShell | null = activeTemplate
      ? {
          ...activeTemplate,
          layout: activeTemplate.isDefault
            ? cloneDefaultTemplateLayout()
            : (activeTemplate.layout as any[]),
        }
      : null

    return {
      isAuthenticated: true,
      user: mergeUserSettings(userLookup as any, (userLookup as any).settings),
      accounts: [...processedLiveAccounts, ...processedPropFirmAccounts],
      activeTemplateShell,
      subscriptionAccess,
    }
  } catch (error) {
    reportError(error, {
      surface: 'server',
      operation: 'initialize-application-bootstrap',
      extra: { fallbackUsed: true },
    })
    return {
      isAuthenticated: false,
      user: null,
      accounts: [],
      activeTemplateShell: null,
      subscriptionAccess: null,
    }
  }
}
