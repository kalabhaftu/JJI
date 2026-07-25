import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const policies = readFileSync(
  join(process.cwd(), 'supabase/storage-policies.sql'),
  'utf8',
)

describe('storage policies', () => {
  it('keeps feedback attachments private', () => {
    expect(policies).toContain("('feedback-attachments', 'feedback-attachments', false)")
  })

  it('requires an authenticated owner prefix for every browser upload bucket', () => {
    for (const bucket of ['trade-images', 'feedback-attachments', 'weekly-calendars']) {
      expect(policies).toContain(`bucket_id = '${bucket}'`)
    }
    expect(policies.match(/auth\.uid\(\)::text/g)?.length).toBeGreaterThanOrEqual(10)
    expect(policies).not.toMatch(/to\s+anon[\s\S]{0,100}for\s+(insert|update|delete)/i)
  })

  it('removes every permissive legacy production policy before adding replacements', () => {
    for (const policy of [
      'Allow authenticated uploads',
      'Allow authenticated uploads to trade-images',
      'Allow user deletes',
      'Allow user updates',
      'Allow users to delete their files',
      'Allow users to update their files',
      'feedback_attachments_insert',
    ]) {
      expect(policies).toContain(`drop policy if exists "${policy}" on storage.objects;`)
    }
  })
})
