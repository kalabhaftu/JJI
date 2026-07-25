import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
/**
 * Anchor Service
 * Handles creation of daily equity snapshots (anchors) for drawdown tracking.
 */

/**
 * Create daily anchor for a specific phase account
 */
export async function createDailyAnchor(phaseAccountId: string, timezone: string, forceDate?: Date) {
  const today = forceDate || new Date()
  
  // Get the date at midnight in the user's timezone
  const dateString = today.toLocaleDateString('en-CA', { timeZone: timezone }) // YYYY-MM-DD format
  const anchorDate = new Date(dateString + 'T00:00:00.000Z')

  // Check if anchor already exists for today
  const existingAnchor = await db.query.DailyAnchor.findFirst({
    where: and(
      eq(schema.DailyAnchor.phaseAccountId, phaseAccountId),
      eq(schema.DailyAnchor.date, anchorDate)
    )
  })

  if (existingAnchor) {
    return { created: false, reason: 'already_exists', anchor: existingAnchor }
  }

  // Get phase account with trades before the anchor date (start of day)
  const phaseAccount = await db.query.PhaseAccount.findFirst({
    where: eq(schema.PhaseAccount.id, phaseAccountId),
    with: {
      MasterAccount: true,
      Trade: {
        where: (table, { lt, isNull, or, and }) => or(
          lt(table.exitTime, anchorDate),
          and(isNull(table.exitTime), lt(table.createdAt, anchorDate))
        ),
        columns: { pnl: true, commission: true }
      }
    }
  })

  if (!phaseAccount) {
    return { created: false, reason: 'phase_not_found' }
  }

  // Calculate current equity for anchor
  const totalPnL = phaseAccount.Trade.reduce(
    (sum: number, trade: { pnl: number }) =>
      sum + Number(trade.pnl || 0),
    0
  )
  const anchorEquity = (phaseAccount.accountSize || phaseAccount.MasterAccount.accountSize) + totalPnL

  // Create the anchor
  const [anchor] = await db.insert(schema.DailyAnchor).values({
    id: crypto.randomUUID(),
    phaseAccountId,
    date: anchorDate,
    anchorEquity
  }).onConflictDoNothing({
    target: [schema.DailyAnchor.phaseAccountId, schema.DailyAnchor.date],
  }).returning()

  if (!anchor) {
    const concurrentAnchor = await db.query.DailyAnchor.findFirst({
      where: and(
        eq(schema.DailyAnchor.phaseAccountId, phaseAccountId),
        eq(schema.DailyAnchor.date, anchorDate)
      )
    })
    return { created: false, reason: 'already_exists', anchor: concurrentAnchor }
  }

  return { created: true, anchor }
}

/**
 * Bulk create daily anchors for all active phase accounts
 */
export async function createAllDailyAnchors() {
  const results = {
    totalPhases: 0,
    anchorsCreated: 0,
    anchorsSkipped: 0,
    errors: [] as string[]
  }

  try {
    // Get all active phase accounts
    const activePhases = await db.query.PhaseAccount.findMany({
      where: eq(schema.PhaseAccount.status, 'active'),
      with: {
        MasterAccount: {
          with: {
            User: {
              columns: { id: true },
              with: {
                settings: {
                  columns: { timezone: true }
                }
              }
            }
          }
        }
      }
    })

    results.totalPhases = activePhases.length

    // Create anchors for each active phase
    for (const phase of activePhases) {
      try {
        const timezone = phase.MasterAccount.User.settings?.timezone || 'UTC'
        const result = await createDailyAnchor(phase.id, timezone)
        
        if (result.created) {
          results.anchorsCreated++
        } else {
          results.anchorsSkipped++
        }
      } catch (error) {
        const errorMsg = `Phase ${phase.id}: anchor creation failed`
        results.errors.push(errorMsg)
      }
    }
  } catch (err) {
    results.errors.push(`General Anchor Error: ${err instanceof Error ? err.message : 'unknown error'}`)
  }

  return results
}
