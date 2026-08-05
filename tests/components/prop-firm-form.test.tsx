import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { queryKeyPrefixes } from '@/lib/query/query-keys'

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = TestResizeObserver

const {
  useMutationMock,
  useQueryMock,
  useQueryClientMock,
  invalidateQueries,
  apiRequestData,
  toastMock,
  reportClientErrorMock,
  emitTourEventMock,
  SCOPE,
} = vi.hoisted(() => ({
  useMutationMock: vi.fn(),
  useQueryMock: vi.fn(),
  useQueryClientMock: vi.fn(),
  invalidateQueries: vi.fn().mockResolvedValue(undefined),
  apiRequestData: vi.fn(),
  toastMock: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
  reportClientErrorMock: vi.fn(),
  emitTourEventMock: vi.fn(),
  SCOPE: { surface: 'authenticated', userId: 'user-1' },
}))

vi.mock('@tanstack/react-query', () => ({
  useMutation: useMutationMock,
  useQuery: useQueryMock,
  useQueryClient: useQueryClientMock,
}))

vi.mock('@/lib/api/client', () => ({ apiRequestData }))

vi.mock('sonner', () => ({ toast: toastMock }))

vi.mock('@/lib/observability/report-error', () => ({
  reportClientError: reportClientErrorMock,
  reportError: vi.fn(),
}))

vi.mock('@/lib/tours/events', () => ({ emitTourEvent: emitTourEventMock }))

vi.mock('@/lib/query/use-query-scope', () => ({
  useQueryScope: () => SCOPE,
  isScopeReady: () => true,
}))

import { CreatePropFirmDialog } from '@/app/dashboard/components/prop-firm/create-prop-firm-dialog'

const TEMPLATES = {
  FTMO: {
    programs: [
      {
        evaluationType: 'Two Step',
        phases: {
          phase1: { profitTargetPercent: 10, dailyDrawdownPercent: 5, maxDrawdownPercent: 10, maxDrawdownType: 'static', minTradingDays: 4, timeLimitDays: 30 },
          phase2: { profitTargetPercent: 5, dailyDrawdownPercent: 5, maxDrawdownPercent: 10, maxDrawdownType: 'static', minTradingDays: 4, timeLimitDays: 60 },
          funded: { dailyDrawdownPercent: 5, maxDrawdownPercent: 5, maxDrawdownType: 'static', profitSplitPercent: 80, payoutCycleDays: 14, minProfitForPayout: 100 },
        },
      },
    ],
    accountSizes: [100000, 50000],
  },
}

interface MutationRecord {
  options: {
    mutationFn: (variables: unknown) => Promise<unknown>
    onSuccess?: (result: unknown, variables: unknown) => void | Promise<void>
    onError?: (error: Error) => void
    onSettled?: () => void
  }
  variables: unknown
}

function installMutation(): MutationRecord[] {
  const records: MutationRecord[] = []
  useMutationMock.mockImplementation((options: MutationRecord['options']) => {
    const mutate = vi.fn((variables: unknown) => {
      records.push({ options, variables })
      void options.mutationFn(variables).catch(() => {})
    })
    return { mutate, isPending: false, isError: false, error: null, data: undefined }
  })
  return records
}

const roots: Array<ReturnType<typeof createRoot>> = []

afterEach(async () => {
  await act(async () => roots.splice(0).forEach((root) => root.unmount()))
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

async function render(element: React.ReactElement) {
  const root = createRoot(document.body.appendChild(document.createElement('div')))
  roots.push(root)
  await act(async () => root.render(element))
  return root
}

async function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  setter.call(input, value)
  await act(async () => {
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}

async function pickOption(comboboxIndex: number, value: string) {
  const comboboxes = Array.from(document.querySelectorAll('[role="combobox"]')) as HTMLButtonElement[]
  await act(async () => {
    comboboxes[comboboxIndex].click()
  })
  await act(async () => {
    const option = Array.from(document.querySelectorAll('[role="option"]')).find(
      (el) => el.textContent?.trim() === value
    ) as HTMLElement
    option.click()
  })
}

async function submitForm() {
  const form = document.querySelector('form') as HTMLFormElement
  await act(async () => {
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
  })
}

async function fillRequiredFields() {
  await setInputValue(document.querySelector('#accountName') as HTMLInputElement, 'My Challenge')
  await pickOption(0, 'FTMO')
  await pickOption(2, '$100,000')
  await setInputValue(document.querySelector('#phase1AccountId') as HTMLInputElement, '12345678')
}

describe('CreatePropFirmDialog form contract', () => {
  beforeEach(() => {
    useQueryClientMock.mockImplementation(() => ({ invalidateQueries }))
    apiRequestData.mockResolvedValue({ id: 'pf-acc-1' })
    useQueryMock.mockReturnValue({ data: TEMPLATES, isLoading: false, error: null })
  })

  it('submits the prop firm payload through the canonical request contract', async () => {
    installMutation()

    await render(<CreatePropFirmDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />)

    await fillRequiredFields()
    await submitForm()

    expect(apiRequestData).toHaveBeenCalledWith('/api/v1/prop-firm/accounts', expect.objectContaining({
      method: 'POST',
      retry: { mode: 'never' },
      operation: 'create-prop-firm-account',
    }))
    const [, init] = apiRequestData.mock.calls[0] as [string, { body: string }]
    expect(JSON.parse(init.body)).toMatchObject({
      accountName: 'My Challenge',
      propFirmName: 'FTMO',
      accountSize: 100000,
      evaluationType: 'Two Step',
      phase1AccountId: '12345678',
    })
  })

  it('invalidates propFirmAccounts and accounts prefixes and dispatches jji-account-created on success', async () => {
    const records = installMutation()
    const onOpenChange = vi.fn()
    const onSuccess = vi.fn()
    const createdHandler = vi.fn()
    document.addEventListener('jji-account-created', createdHandler)

    const createdResult = {
      id: 'pf-acc-1',
      phases: [{ id: 'active-phase-1', status: 'active' }],
      masterAccount: { id: 'master-1' },
    }
    apiRequestData.mockResolvedValue(createdResult)

    await render(<CreatePropFirmDialog open onOpenChange={onOpenChange} onSuccess={onSuccess} />)

    await fillRequiredFields()
    await submitForm()

    expect(records).toHaveLength(1)

    await act(async () => {
      await records[0].options.onSuccess?.(createdResult, records[0].variables)
    })

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeyPrefixes.propFirmAccounts(SCOPE) })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeyPrefixes.accounts(SCOPE) })
    expect(toastMock.success).toHaveBeenCalledWith('Account created!', expect.anything())
    expect(emitTourEventMock).toHaveBeenCalledWith('account.created', { id: 'active-phase-1' })
    expect(createdHandler).toHaveBeenCalledTimes(1)
    const event = createdHandler.mock.calls[0][0] as CustomEvent
    expect(event.detail).toEqual({ id: 'active-phase-1', type: 'prop-firm' })
    expect(onSuccess).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('maps duplicate-name failures to the accountName field error and keeps the dialog open', async () => {
    const records = installMutation()
    const onOpenChange = vi.fn()
    const onSuccess = vi.fn()
    apiRequestData.mockRejectedValue(new Error('An account with this name already exists. Please choose a different name.'))

    await render(<CreatePropFirmDialog open onOpenChange={onOpenChange} onSuccess={onSuccess} />)

    await fillRequiredFields()
    await submitForm()

    await act(async () => {
      records[0].options.onError?.(new Error('An account with this name already exists. Please choose a different name.'))
    })

    expect(toastMock.error).toHaveBeenCalledWith('Failed to create account', expect.anything())
    expect(reportClientErrorMock).toHaveBeenCalled()
    expect(document.querySelector('form')?.textContent).toContain('Account name already exists')
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(document.querySelector('[data-tour="create-account-dialog"]')).toBeTruthy()
  })

  it('keeps the dialog open and shows an error toast when the mutation fails', async () => {
    const records = installMutation()
    const onOpenChange = vi.fn()

    await render(<CreatePropFirmDialog open onOpenChange={onOpenChange} onSuccess={vi.fn()} />)

    await fillRequiredFields()
    await submitForm()

    await act(async () => {
      records[0].options.onError?.(new Error('boom'))
    })

    expect(toastMock.error).toHaveBeenCalledWith('Failed to create account', expect.anything())
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(document.querySelector('[data-tour="create-account-dialog"]')).toBeTruthy()
  })

  it('gates the templates query on open', async () => {
    await render(<CreatePropFirmDialog open={false} onOpenChange={vi.fn()} onSuccess={vi.fn()} />)
    expect(useQueryMock).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }))

    const root = roots[roots.length - 1]
    await act(async () => {
      root.render(<CreatePropFirmDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />)
    })
    expect(useQueryMock).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }))
  })
})
