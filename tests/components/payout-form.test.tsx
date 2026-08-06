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
  routerPush,
  SCOPE,
} = vi.hoisted(() => ({
  useMutationMock: vi.fn(),
  useQueryMock: vi.fn(),
  useQueryClientMock: vi.fn(),
  invalidateQueries: vi.fn().mockResolvedValue(undefined),
  apiRequestData: vi.fn(),
  toastMock: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
  reportClientErrorMock: vi.fn(),
  routerPush: vi.fn(),
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

vi.mock('@/lib/query/use-query-scope', () => ({
  useQueryScope: () => SCOPE,
  isScopeReady: () => true,
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'acc-1' }),
  useRouter: () => ({ push: routerPush, back: vi.fn() }),
}))

vi.mock('@/context/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

import RequestPayoutPage from '@/app/dashboard/prop-firm/accounts/[id]/payouts/request/page'

const accountData = {
  account: {
    id: 'acc-1',
    number: '12345678',
    name: 'FTMO 100K',
    propfirm: 'FTMO',
    currentPhase: { id: 'ph-1', phaseNumber: 2 },
  },
}

const eligibilityData = {
  isEligible: true,
  daysSinceFunded: 21,
  daysSinceLastPayout: 0,
  netProfitSinceLastPayout: 3100,
  minDaysRequired: 14,
  profitSplitAmount: 2500,
  blockers: [],
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

async function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!
  setter.call(textarea, value)
  await act(async () => {
    textarea.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}

async function submitForm() {
  const form = document.querySelector('form') as HTMLFormElement
  await act(async () => {
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
  })
}

describe('RequestPayoutPage form contract', () => {
  beforeEach(() => {
    useQueryClientMock.mockImplementation(() => ({ invalidateQueries }))
    apiRequestData.mockResolvedValue({ id: 'payout-1' })
    useQueryMock.mockImplementation(({ queryKey }: { queryKey: readonly unknown[] }) => {
      const isAccountKey = queryKey[1] === 'accounts'
      return {
        data: isAccountKey ? accountData : { eligibility: eligibilityData, history: [] },
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      }
    })
  })

  it('renders the eligibility summary and prefills the amount', async () => {
    await render(<RequestPayoutPage />)

    expect(document.body.textContent).toContain('Eligible for Payout')
    expect(document.body.textContent).toContain('21')
    expect(document.body.textContent).toContain('$3100.00')
    expect((document.querySelector('#amount') as HTMLInputElement).value).toBe('2500')
  })

  it('submits the payout request payload through the canonical request contract', async () => {
    installMutation()

    await render(<RequestPayoutPage />)

    await setInputValue(document.querySelector('#amount') as HTMLInputElement, '2000')
    await setTextareaValue(document.querySelector('#notes') as HTMLTextAreaElement, 'First payout')
    await submitForm()

    expect(apiRequestData).toHaveBeenCalledWith('/api/v1/prop-firm/payouts', expect.objectContaining({
      method: 'POST',
      retry: { mode: 'never' },
      operation: 'submit-payout-request',
    }))
    const [, init] = apiRequestData.mock.calls[0] as [string, { body: string }]
    expect(JSON.parse(init.body)).toEqual({
      masterAccountId: 'acc-1',
      phaseAccountId: 'ph-1',
      amount: 2000,
      notes: 'First payout',
    })
  })

  it('invalidates the payouts and propFirmAccounts prefixes and navigates on success', async () => {
    const records = installMutation()

    await render(<RequestPayoutPage />)

    await setInputValue(document.querySelector('#amount') as HTMLInputElement, '2000')
    await submitForm()

    expect(records).toHaveLength(1)

    await act(async () => {
      await records[0].options.onSuccess?.({}, records[0].variables)
    })

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeyPrefixes.payouts(SCOPE) })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeyPrefixes.propFirmAccounts(SCOPE) })
    expect(toastMock.success).toHaveBeenCalledWith('Payout request submitted successfully')
    expect(routerPush).toHaveBeenCalledWith('/dashboard/prop-firm/accounts/acc-1/payouts')
  })

  it('blocks amounts above the available balance without calling the API', async () => {
    installMutation()

    await render(<RequestPayoutPage />)

    await setInputValue(document.querySelector('#amount') as HTMLInputElement, '99999')
    await submitForm()

    expect(apiRequestData).not.toHaveBeenCalled()
    expect(toastMock.error).toHaveBeenCalledWith('Amount exceeds available balance ($2500.00)')
  })
})
