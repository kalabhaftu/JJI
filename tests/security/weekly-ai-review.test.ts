import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const route = readFileSync(
  join(process.cwd(), 'app/api/v1/weekly-review/route.ts'),
  'utf8',
)
const schemaAlignmentMigration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260725231500_align_weekly_ai_review_schema.sql'),
  'utf8',
)

describe('weekly AI review boundary', () => {
  it('requires entitlement, current consent, and a dedicated rate limit', () => {
    expect(route).toContain('checkAIAccess(internalUserId)')
    expect(route).toContain('hasCurrentAiDataConsent(internalUserId)')
    expect(route).toContain('consumeRateLimitKey(`ai-review:${internalUserId}`')
  })

  it('validates provider output and never stores a fabricated AI fallback', () => {
    expect(route).toContain('weeklyReviewResultSchema.parse')
    expect(route).toContain("code: 'AI_PROVIDER_ERROR'")
    expect(route).not.toContain('Fallback if AI is unavailable')
    expect(route).not.toContain('Trade Notes (sample)')
  })

  it('persists the review and notification atomically', () => {
    expect(route).toContain('db.transaction(async (tx)')
    expect(route).toContain('tx.insert(schema.WeeklyAIReview)')
    expect(route).toContain('tx.insert(schema.Notification)')
  })

  it('aligns the legacy production review columns without dropping review data', () => {
    expect(schemaAlignmentMigration).toContain('RENAME COLUMN "focusNextWeek" TO "focus_next_week"')
    expect(schemaAlignmentMigration).toContain('ALTER COLUMN "weekStart" TYPE timestamp with time zone')
    expect(schemaAlignmentMigration).toContain('ALTER COLUMN "weekEnd" TYPE timestamp with time zone')
    expect(schemaAlignmentMigration).not.toContain('DROP TABLE')
  })
})
