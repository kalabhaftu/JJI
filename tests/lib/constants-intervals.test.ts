import { describe, expect, it } from 'vitest'
import {
  IMPORT_JOB_PROCESS_SPACER_MS,
  RESTORE_JOB_PROCESS_SPACER_MS,
  RESTORE_REFRESH_DELAY_MS,
  SUBSCRIPTION_CONFIRMATION_POLL_MS,
} from '@/lib/constants/intervals'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const source = (path: string) => readFileSync(join(root, path), 'utf8')

describe('interval constants', () => {
  it('defines the expected interval values', () => {
    expect(IMPORT_JOB_PROCESS_SPACER_MS).toBe(350)
    expect(RESTORE_JOB_PROCESS_SPACER_MS).toBe(400)
    expect(RESTORE_REFRESH_DELAY_MS).toBe(1000)
    expect(SUBSCRIPTION_CONFIRMATION_POLL_MS).toBe(5000)
  })

  it('does not keep dead POLL_INTERVAL constants', () => {
    const constants = source('lib/constants/index.ts')
    expect(constants).not.toMatch(/POLL_INTERVAL/)
  })
})
