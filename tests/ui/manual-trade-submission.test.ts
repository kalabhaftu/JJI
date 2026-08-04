import { beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const { importTradesThroughApi } = vi.hoisted(() => ({ importTradesThroughApi: vi.fn() }))
vi.mock('@/lib/api/trade-import-client', () => ({ importTradesThroughApi }))

import { createManualTradeSubmission } from '@/app/dashboard/components/import/manual-trade-entry/manual-trade-submission'
import { ManualTradeValidationError } from '@/app/dashboard/components/import/manual-trade-entry/manual-trade-validation-error'

describe('live manual trade submission', () => {
  const values = { accountNumber: 'account-1', instrument: 'NQ', comment: 'preserve me' }

  beforeEach(() => importTradesThroughApi.mockReset())

  it.each([
    ['offline', 0, null],
    ['timeout', 408, null],
    ['malformed', 200, { success: true }],
    ['forbidden', 403, { success: false }],
    ['server', 500, { success: false }],
  ])('blocks import and exposes inline recovery for %s validation', async (_label, status, payload) => {
    const controller = createManualTradeSubmission({
      validate: vi.fn().mockResolvedValue({ status, payload }),
      buildImport: vi.fn(),
    })

    await controller.submit(values)

    expect(importTradesThroughApi).not.toHaveBeenCalled()
    expect(controller.getState()).toMatchObject({ status: 'blocked', values, message: expect.any(String) })
  })

  it('retries validation with preserved values and imports only after success', async () => {
    const validate = vi.fn()
      .mockResolvedValueOnce({ status: 500, payload: null })
      .mockResolvedValueOnce({ status: 200, payload: { success: true, data: { accountType: 'regular' } } })
    const buildImport = vi.fn((submitted) => ({ accountId: 'id-1', trades: [submitted] }))
    importTradesThroughApi.mockResolvedValue({ importedCount: 1 })
    const controller = createManualTradeSubmission({ validate, buildImport })

    await controller.submit(values)
    await controller.retry()

    expect(validate).toHaveBeenNthCalledWith(2, values)
    expect(buildImport).toHaveBeenCalledWith(values)
    expect(importTradesThroughApi).toHaveBeenCalledTimes(1)
  })

  it('blocks duplicate submission while validation is in flight', async () => {
    let resolveValidation!: (value: { status: number; payload: unknown }) => void
    const validate = vi.fn(() => new Promise<{ status: number; payload: unknown }>((resolve) => { resolveValidation = resolve }))
    const controller = createManualTradeSubmission({ validate, buildImport: vi.fn() })

    const first = controller.submit(values)
    const duplicate = controller.submit(values)
    resolveValidation({ status: 403, payload: null })
    await Promise.all([first, duplicate])

    expect(validate).toHaveBeenCalledTimes(1)
    expect(importTradesThroughApi).not.toHaveBeenCalled()
  })

  it('renders blocked validation as an inline retryable alert', () => {
    const markup = renderToStaticMarkup(React.createElement(ManualTradeValidationError, { message: 'Validation timed out', retry: vi.fn(), disabled: false }))
    expect(markup).toContain('role="alert"')
    expect(markup).toContain('Validation timed out')
    expect(markup).toContain('Retry validation')
  })
})
