import React from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PhaseValidationAlert, validateBeforeManualTradeSave } from '@/app/dashboard/components/import/manual-trade-entry/phase-validation-workflow'

describe('manual trade validation workflow', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('does not save after blocked validation and preserves submitted values', async () => {
    const values = { accountNumber: 'account-1', instrument: 'NQ', comment: 'keep this' }
    const save = vi.fn()
    const result = await validateBeforeManualTradeSave(values, vi.fn().mockResolvedValue({ status: 'blocked', reason: 'offline', message: 'Retry validation.' }), save)
    expect(result).toMatchObject({ status: 'blocked' })
    expect(save).not.toHaveBeenCalled()
    expect(values).toEqual({ accountNumber: 'account-1', instrument: 'NQ', comment: 'keep this' })
  })

  it('renders inline recovery and Retry runs validation again', async () => {
    const retry = vi.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => root.render(<PhaseValidationAlert message="Validation unavailable" onRetry={retry} isRetrying={false} />))
    expect(container.textContent).toContain('Validation unavailable')
    const button = container.querySelector('button')!
    await act(async () => button.click())
    expect(retry).toHaveBeenCalledTimes(1)
    await act(async () => root.unmount())
  })
})
