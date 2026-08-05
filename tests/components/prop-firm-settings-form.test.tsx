import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { queryKeyPrefixes } from '@/lib/query/query-keys'

const {
  useQueryMock,
  useMutationMock,
  useQueryClientMock,
  invalidateQueries,
  apiRequestData,
  toastMock,
  reportClientErrorMock,
  routerPush,
  SCOPE,
} = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  useMutationMock: vi.fn(),
  useQueryClientMock: vi.fn(),
  invalidateQueries: vi.fn().mockResolvedValue(undefined),
  apiRequestData: vi.fn(),
  toastMock: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
  reportClientErrorMock: vi.fn(),
  routerPush: vi.fn(),
  SCOPE: { surface: 'authenticated', userId: 'user-1' },
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock,
  useMutation: useMutationMock,
  useQueryClient: useQueryClientMock,
}))

vi.mock('@/lib/api/client', () => ({ apiRequestData }))

vi.mock('@/lib/query/use-query-scope', () => ({
  useQueryScope: () => SCOPE,
  isScopeReady: () => true,
}))

vi.mock('sonner', () => ({ toast: toastMock }))

vi.mock('@/lib/observability/report-error', () => ({
  reportClientError: reportClientErrorMock,
  reportError: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'account-1' }),
  useRouter: () => ({ push: routerPush, back: vi.fn() }),
}))

import AccountSettingsPage from '@/app/dashboard/prop-firm/accounts/[id]/settings/page'

interface MutationRecord {
  options: {
    mutationFn: (variables: unknown) => Promise<unknown>
    onSuccess?: (result: unknown, variables: unknown) => void | Promise<void>
    onError?: (error: Error) => void
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

const accountData = {
  account: {
    id: 'account-1',
    number: 'MA-1001',
    name: 'Main Account',
    propfirm: 'FTMO',
    status: 'active',
    currentEquity: 95000,
    currentBalance: 95000,
    startingBalance: 100000,
    dailyDrawdownLimit: 5000,
    maxDrawdownLimit: 10000,
    profitTarget: 10000,
    timezone: 'UTC',
    dailyResetTime: '17:00',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    notes: '',
    isArchived: false,
  },
  phases: [],
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

async function clickButton(matchingText: string, scope: ParentNode = document) {
  const button = Array.from(scope.querySelectorAll('button')).find((el) => el.textContent?.trim() === matchingText)
  if (!button) throw new Error(`Button "${matchingText}" not found`)
  await act(async () => {
    button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
    button.click()
  })
  return button
}

describe('AccountSettingsPage form contract', () => {
  beforeEach(() => {
    useQueryClientMock.mockImplementation(() => ({ invalidateQueries }))
    apiRequestData.mockResolvedValue({})
    useQueryMock.mockImplementation(() => ({
      data: accountData,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    }))
  })

  it('submits a PATCH with the settings payload through the canonical request contract', async () => {
    installMutation()
    await render(<AccountSettingsPage />)

    await setInputValue(document.querySelector('#accountName') as HTMLInputElement, 'Renamed Account')
    await clickButton('Save Changes')

    expect(apiRequestData).toHaveBeenCalledWith('/api/v1/prop-firm/accounts/account-1', expect.objectContaining({
      method: 'PATCH',
      retry: { mode: 'never' },
      operation: 'update-prop-firm-account-settings',
    }))
    const [, init] = apiRequestData.mock.calls[0] as [string, { body: string }]
    expect(JSON.parse(init.body)).toEqual({ name: 'Renamed Account', notes: '', isArchived: false })
  })

  it('invalidates prop-firm accounts(scope) and shows a success toast when settings are saved', async () => {
    const records = installMutation()
    await render(<AccountSettingsPage />)

    await setInputValue(document.querySelector('#accountName') as HTMLInputElement, 'Renamed Account')
    await clickButton('Save Changes')

    expect(records).toHaveLength(1)
    const saveRecord = records[0]

    await act(async () => {
      await saveRecord.options.onSuccess?.(undefined, saveRecord.variables)
    })

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeyPrefixes.propFirmAccounts(SCOPE) })
    expect(toastMock.success).toHaveBeenCalledWith('Account updated successfully', expect.anything())
  })

  it('confirms deletion with a DELETE mutation, invalidates both prefixes, and navigates away', async () => {
    const records = installMutation()
    await render(<AccountSettingsPage />)

    await clickButton('Advanced')
    await clickButton('Delete Account')
    await clickButton('Delete Account', document.querySelector('[role="alertdialog"]') as HTMLElement)

    expect(apiRequestData).toHaveBeenCalledWith('/api/v1/prop-firm/accounts/account-1', expect.objectContaining({
      method: 'DELETE',
      retry: { mode: 'never' },
      operation: 'delete-prop-firm-account',
    }))

    const deleteRecord = records[0]
    await act(async () => {
      await deleteRecord.options.onSuccess?.(undefined, deleteRecord.variables)
    })

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeyPrefixes.propFirmAccounts(SCOPE) })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeyPrefixes.accounts(SCOPE) })
    expect(routerPush).toHaveBeenCalledWith('/dashboard/prop-firm/accounts')
    expect(toastMock.success).toHaveBeenCalledWith('Account deleted successfully', expect.anything())
  })

  it('shows an error toast and does not navigate when deletion fails', async () => {
    const records = installMutation()
    await render(<AccountSettingsPage />)

    await clickButton('Advanced')
    await clickButton('Delete Account')
    await clickButton('Delete Account', document.querySelector('[role="alertdialog"]') as HTMLElement)

    const deleteRecord = records[0]
    await act(async () => {
      deleteRecord.options.onError?.(new Error('boom'))
    })

    expect(toastMock.error).toHaveBeenCalledWith('Failed to delete account', expect.anything())
    expect(reportClientErrorMock).toHaveBeenCalled()
    expect(routerPush).not.toHaveBeenCalled()
  })
})
