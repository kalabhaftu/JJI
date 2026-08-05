import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { queryKeyPrefixes } from '@/lib/query/query-keys'

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

import { EditLiveAccountDialog } from '@/components/edit-live-account-dialog'

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

async function submitForm() {
  const form = document.querySelector('form') as HTMLFormElement
  await act(async () => {
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
  })
}

const account = {
  id: 'acc-1',
  number: '123456',
  name: 'Main Trading',
  broker: 'Exness',
  startingBalance: 5000,
  isConfigured: false,
}

describe('EditLiveAccountDialog form contract', () => {
  beforeEach(() => {
    useQueryClientMock.mockImplementation(() => ({ invalidateQueries }))
    apiRequestData.mockResolvedValue(null)
  })

  it('renders the initial account values', async () => {
    await render(<EditLiveAccountDialog open account={account} onOpenChange={vi.fn()} onSuccess={vi.fn()} />)

    expect((document.querySelector('#name') as HTMLInputElement).value).toBe('Main Trading')
    expect((document.querySelector('#broker') as HTMLInputElement).value).toBe('Exness')
    expect((document.querySelector('#number') as HTMLInputElement).value).toBe('123456')
    expect((document.querySelector('#startingBalance') as HTMLInputElement).value).toBe('5000')
  })

  it('locks the number and starting balance fields when the account is configured', async () => {
    const configured = { ...account, isConfigured: true }
    await render(<EditLiveAccountDialog open account={configured} onOpenChange={vi.fn()} onSuccess={vi.fn()} />)

    expect((document.querySelector('#name') as HTMLInputElement).disabled).toBe(false)
    expect((document.querySelector('#broker') as HTMLInputElement).disabled).toBe(false)
    expect((document.querySelector('#number') as HTMLInputElement).disabled).toBe(true)
    expect((document.querySelector('#startingBalance') as HTMLInputElement).disabled).toBe(true)
  })

  it('submits a trimmed PATCH payload and invalidates accounts(scope) on success', async () => {
    const records = installMutation()
    const onOpenChange = vi.fn()
    const onSuccess = vi.fn()

    await render(<EditLiveAccountDialog open account={account} onOpenChange={onOpenChange} onSuccess={onSuccess} />)

    await setInputValue(document.querySelector('#name') as HTMLInputElement, '  Renamed Account  ')
    await submitForm()

    expect(apiRequestData).toHaveBeenCalledWith('/api/v1/accounts/acc-1', expect.objectContaining({
      method: 'PATCH',
      retry: { mode: 'never' },
      operation: 'update-live-account',
    }))
    const [, init] = apiRequestData.mock.calls[0] as [string, { body: string }]
    expect(JSON.parse(init.body)).toEqual({
      name: 'Renamed Account',
      broker: 'Exness',
      number: '123456',
      startingBalance: '5000',
    })

    await act(async () => {
      await records[0].options.onSuccess?.(undefined, records[0].variables)
    })

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeyPrefixes.accounts(SCOPE) })
    expect(toastMock).toHaveBeenCalledWith('Account Updated', expect.anything())
    expect(onSuccess).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('keeps the dialog open and shows an error toast when the mutation fails', async () => {
    const records = installMutation()
    const onOpenChange = vi.fn()
    const onSuccess = vi.fn()

    await render(<EditLiveAccountDialog open account={account} onOpenChange={onOpenChange} onSuccess={onSuccess} />)

    await setInputValue(document.querySelector('#name') as HTMLInputElement, 'Renamed Account')
    await submitForm()

    await act(async () => {
      records[0].options.onError?.(new Error('boom'))
    })

    expect(toastMock).toHaveBeenCalledWith('Update Failed', expect.anything())
    expect(reportClientErrorMock).toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(document.querySelector('#name')).toBeTruthy()
  })
})
