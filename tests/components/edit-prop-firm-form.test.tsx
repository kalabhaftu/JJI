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
  useQueryClientMock,
  invalidateQueries,
  apiRequestData,
  toastMock,
  reportClientErrorMock,
  SCOPE,
} = vi.hoisted(() => ({
  useMutationMock: vi.fn(),
  useQueryClientMock: vi.fn(),
  invalidateQueries: vi.fn().mockResolvedValue(undefined),
  apiRequestData: vi.fn(),
  toastMock: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
  reportClientErrorMock: vi.fn(),
  SCOPE: { surface: 'authenticated', userId: 'user-1' },
}))

vi.mock('@tanstack/react-query', () => ({
  useMutation: useMutationMock,
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

import { EditPropFirmAccountDialog } from '@/components/edit-prop-firm-account-dialog'

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

beforeEach(() => {
  try {
    localStorage.clear()
  } catch (error) {

  }
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

async function submitForm() {
  const form = document.querySelector('form') as HTMLFormElement
  await act(async () => {
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
  })
}

const accountWithMaster = {
  id: 'pf-1',
  accountName: 'My Challenge',
  propfirm: 'FTMO',
  currentPhaseDetails: { masterAccountId: 'master-1' },
}

describe('EditPropFirmAccountDialog form contract', () => {
  beforeEach(() => {
    useQueryClientMock.mockImplementation(() => ({ invalidateQueries }))
    apiRequestData.mockResolvedValue({})
  })

  it('renders the account name as the initial value', async () => {
    await render(
      <EditPropFirmAccountDialog open onOpenChange={vi.fn()} account={accountWithMaster} onSuccess={vi.fn()} />
    )

    expect((document.querySelector('#accountName') as HTMLInputElement).value).toBe('My Challenge')
  })

  it('submits a PATCH payload to the master account endpoint', async () => {
    installMutation()

    await render(
      <EditPropFirmAccountDialog open onOpenChange={vi.fn()} account={accountWithMaster} onSuccess={vi.fn()} />
    )

    await setInputValue(document.querySelector('#accountName') as HTMLInputElement, '  Renamed Challenge  ')
    await submitForm()

    expect(apiRequestData).toHaveBeenCalledWith('/api/v1/prop-firm/accounts/master-1', expect.objectContaining({
      method: 'PATCH',
      retry: { mode: 'never' },
      operation: 'update-prop-firm-account',
    }))
    const [, init] = apiRequestData.mock.calls[0] as [string, { body: string }]
    expect(JSON.parse(init.body)).toEqual({ accountName: 'Renamed Challenge' })
  })

  it('invalidates propFirmAccounts and accounts prefixes and closes on success', async () => {
    const records = installMutation()
    const onOpenChange = vi.fn()
    const onSuccess = vi.fn()

    await render(
      <EditPropFirmAccountDialog open onOpenChange={onOpenChange} account={accountWithMaster} onSuccess={onSuccess} />
    )

    await setInputValue(document.querySelector('#accountName') as HTMLInputElement, 'Renamed Challenge')
    await submitForm()

    expect(records).toHaveLength(1)

    await act(async () => {
      await records[0].options.onSuccess?.({}, records[0].variables)
    })

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeyPrefixes.propFirmAccounts(SCOPE) })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeyPrefixes.accounts(SCOPE) })
    expect(toastMock.success).toHaveBeenCalledWith('Account Updated', expect.anything())
    expect(onSuccess).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows an error toast and keeps the dialog open when the mutation fails', async () => {
    const records = installMutation()
    const onOpenChange = vi.fn()
    apiRequestData.mockRejectedValue(new Error('boom'))

    await render(
      <EditPropFirmAccountDialog open onOpenChange={onOpenChange} account={accountWithMaster} onSuccess={vi.fn()} />
    )

    await setInputValue(document.querySelector('#accountName') as HTMLInputElement, 'Renamed Challenge')
    await submitForm()

    await act(async () => {
      records[0].options.onError?.(new Error('boom'))
    })

    expect(toastMock.error).toHaveBeenCalledWith('Update Failed', expect.anything())
    expect(reportClientErrorMock).toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(document.querySelector('#accountName')).toBeTruthy()
  })
})
