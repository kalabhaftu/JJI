import { eq, sql } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { reportError } from '@/lib/observability/report-error'
import { getResolvedUserIdentity, type ResolvedUserIdentity } from '@/server/user-identity'
import { cloneDefaultTemplateLayout } from '@/lib/dashboard/default-template-layout'
import { USER_SETTINGS_SELECT, mergeUserSettings } from '@/lib/user-settings'
import { ensureActiveTemplateForUser } from '@/server/seed-default-template'
import { resolveSurfacedPhaseStatus } from '@/lib/prop-firm/reporting'
import { Trade } from '@/lib/db/schema/trades'
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

interface DashboardAccessReady {
  status: 'ready'
  identity: ResolvedUserIdentity
  user: any
  subscriptionAccess: SubscriptionGuardResult
}

export type DashboardAccessResult =
  | DashboardAccessReady
  | { status: 'unauthenticated' }
  | { status: 'unavailable' }

export interface DashboardBootstrapPayload {
  isAuthenticated: true
  user: any
  accounts: any[]
  activeTemplateShell: ActiveTemplateShell | null
  subscriptionAccess: SubscriptionGuardResult
}

export class DashboardBootstrapUnavailableError extends Error {
  constructor() {
    super('Dashboard initialization is temporarily unavailable.')
    this.name = 'DashboardBootstrapUnavailableError'
  }
}

function isUnauthenticatedError(error: unknown) {
  return error instanceof Error && error.message.toLowerCase().includes('not authenticated')
}

async function loadDashboardUser(identity: ResolvedUserIdentity) {
  return db.query.User.findFirst({
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
}

export async function getDashboardAccess(): Promise<DashboardAccessResult> {
  let identity: ResolvedUserIdentity

  try {
    identity = await getResolvedUserIdentity()
  } catch (error) {
    if (isUnauthenticatedError(error)) return { status: 'unauthenticated' }

    reportError(error, {
      surface: 'server',
      operation: 'resolve-dashboard-authenticated-identity',
    })
    return { status: 'unavailable' }
  }

  try {
    const user = await loadDashboardUser(identity)
    if (!user) {
      reportError(new Error('Authenticated user is missing from the application database.'), {
        surface: 'server',
        operation: 'resolve-dashboard-internal-user',
        userId: identity.authUserId,
      })
      return { status: 'unavailable' }
    }

    const subscriptionAccess = await checkSubscriptionAccess(identity.internalUserId, user.role ?? undefined)
    return { status: 'ready', identity, user, subscriptionAccess }
  } catch (error) {
    reportError(error, {
      surface: 'server',
      operation: 'load-dashboard-access',
      userId: identity.authUserId,
    })
    return { status: 'unavailable' }
  }
}

function isFundedPhase(evaluationType: string, phaseNumber: number): boolean {
  switch (evaluationType) {
    case 'Two Step': return phaseNumber >= 3
    case 'One Step': return phaseNumber >= 2
    case 'Instant': return phaseNumber >= 1
    default: return phaseNumber >= 3
  }
}

function getPhaseDisplayName(evaluationType: string, phaseNumber: number): string {
  return isFundedPhase(evaluationType, phaseNumber) ? 'Funded' : `Phase ${phaseNumber}`
}

async function loadTradeCounts(internalUserId: string) {
  const rows = await db
    .select({
      accountNumber: Trade.accountNumber,
      phaseAccountId: Trade.phaseAccountId,
      tradeCount: sql<number>`count(distinct coalesce(${Trade.groupId}, ${Trade.id}))`,
    })
    .from(Trade)
    .where(eq(Trade.userId, internalUserId))
    .groupBy(Trade.accountNumber, Trade.phaseAccountId)

  const live = new Map<string, number>()
  const phases = new Map<string, number>()

  for (const row of rows) {
    const count = Number(row.tradeCount)
    if (row.phaseAccountId) phases.set(row.phaseAccountId, count)
    else live.set(row.accountNumber, count)
  }

  return { live, phases }
}

export async function getDashboardBootstrapData(
  access: DashboardAccessReady,
): Promise<DashboardBootstrapPayload> {
  const internalUserId = access.identity.internalUserId

  try {
    const [accounts, propFirmAccounts, tradeCounts, activeTemplate] = await Promise.all([
      db.query.Account.findMany({
        where: (table, { eq }) => eq(table.userId, internalUserId),
        orderBy: (table, { desc }) => [desc(table.createdAt)],
      }),
      db.query.MasterAccount.findMany({
        where: (table, { eq }) => eq(table.userId, internalUserId),
        with: { PhaseAccount: { orderBy: (table, { asc }) => [asc(table.phaseNumber)] } },
      }),
      loadTradeCounts(internalUserId),
      ensureActiveTemplateForUser(internalUserId),
    ])

    const processedLiveAccounts = accounts.map((account) => ({
      ...account,
      propfirm: '',
      tradeCount: tradeCounts.live.get(account.number) || 0,
      accountType: 'live' as const,
      displayName: account.name || account.number,
      status: 'active' as const,
      currentPhase: null,
      currentPhaseDetails: null,
      isArchived: account.isArchived || false,
    }))

    const processedPropFirmAccounts: any[] = []
    for (const masterAccount of propFirmAccounts) {
      for (const phase of masterAccount.PhaseAccount ?? []) {
        if (phase.status === 'pending' || phase.status === 'pending_approval') continue
        if (!phase.phaseId || phase.phaseId.trim() === '') continue

        const phaseName = getPhaseDisplayName(masterAccount.evaluationType, phase.phaseNumber)
        const surfacedStatus = resolveSurfacedPhaseStatus(
          { status: masterAccount.status, currentPhase: masterAccount.currentPhase },
          { status: phase.status, phaseNumber: phase.phaseNumber },
        )

        processedPropFirmAccounts.push({
          id: phase.id,
          number: phase.phaseId,
          name: masterAccount.accountName,
          propfirm: masterAccount.propFirmName,
          broker: undefined,
          startingBalance: phase.accountSize || masterAccount.accountSize,
          accountType: 'prop-firm' as const,
          displayName: `${masterAccount.accountName} (${phaseName})`,
          tradeCount: tradeCounts.phases.get(phase.id) || 0,
          status: surfacedStatus,
          currentPhase: phase.phaseNumber,
          createdAt: (phase as any).createdAt || masterAccount.createdAt,
          userId: masterAccount.userId,
          isArchived: masterAccount.isArchived || false,
          currentPhaseDetails: {
            phaseNumber: phase.phaseNumber,
            status: surfacedStatus,
            phaseId: phase.phaseId,
            masterAccountId: masterAccount.id,
            masterAccountName: masterAccount.accountName,
            evaluationType: masterAccount.evaluationType,
          },
        })
      }
    }

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
      user: mergeUserSettings(access.user as any, (access.user as any).settings),
      accounts: [...processedLiveAccounts, ...processedPropFirmAccounts],
      activeTemplateShell,
      subscriptionAccess: access.subscriptionAccess,
    }
  } catch (error) {
    reportError(error, {
      surface: 'server',
      operation: 'load-dashboard-bootstrap',
      userId: access.identity.authUserId,
    })
    throw new DashboardBootstrapUnavailableError()
  }
}
