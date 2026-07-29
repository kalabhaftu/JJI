import { describe, expect, it } from 'vitest'

import {
  computeProcessingProgress,
  parseJobState,
} from '@/server/import-jobs/state'

describe('import job state', () => {
  it('recovers from missing or malformed persisted state', () => {
    expect(parseJobState(null)).toEqual({
      phase: 'preparing',
      tradeIndex: 0,
      backtestIndex: 0,
      imported: 0,
      skipped: 0,
    })
    expect(parseJobState({
      phase: 'trades',
      tradeIndex: 25,
      imported: 20,
    })).toEqual({
      phase: 'trades',
      tradeIndex: 25,
      backtestIndex: 0,
      imported: 20,
      skipped: 0,
    })
  })

  it('keeps processing progress within the reserved 10-95 range', () => {
    expect(computeProcessingProgress(0, 0)).toBe(95)
    expect(computeProcessingProgress(100, 0)).toBe(10)
    expect(computeProcessingProgress(100, 50)).toBe(52)
    expect(computeProcessingProgress(100, 500)).toBe(95)
  })
})
