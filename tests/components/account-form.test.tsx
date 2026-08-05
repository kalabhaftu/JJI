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
  emitTourEventMock,
  SCOPE,
} = vi.hoisted(() => ({
  useMutationMock: vi.fn(),
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

import { CreateLiveAccountDialog } from '@/app/dashboard/components/accounts/create-live-account-dialog'

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

async function pickOption(value: string) {
  await act(async () => {
    (document.querySelector('[role="combobox"]') as HTMLButtonElement).click()
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

describe('CreateLiveAccountDialog form contract', () => {
  beforeEach(() => {
    useQueryClientMock.mockImplementation(() => ({ invalidateQueries }))
    apiRequestData.mockResolvedValue({ id: 'acc-1' })
  })

  it('submits a trimmed payload and resolves the Other broker to the custom value', async () => {
    installMutation()
    const onOpenChange = vi.fn()

    await render(<CreateLiveAccountDialog open onOpenChange={onOpenChange} onSuccess={vi.fn()} />)

    await setInputValue(document.querySelector('#name') as HTMLInputElement, '  Main Trading  ')
    await setInputValue(document.querySelector('#number') as HTMLInputElement, '  12345678  ')
    await setInputValue(document.querySelector('#startingBalance') as HTMLInputElement, '50000')
    await pickOption('Other')
    await setInputValue(document.querySelector('#customBroker') as HTMLInputElement, 'My Broker Co')
    await submitForm()

    expect(apiRequestData).toHaveBeenCalledWith('/api/v1/accounts', expect.objectContaining({
      method: 'POST',
      retry: { mode: 'never' },
      operation: 'create-live-account',
    }))
    const [, init] = apiRequestData.mock.calls[0] as [string, { body: string }]
    expect(JSON.parse(init.body)).toEqual({
      name: 'Main Trading',
      number: '12345678',
      startingBalance: 50000,
      broker: 'My Broker Co',
    })
  })

  it('invalidates accounts(scope) and dispatches jji-account-created with the created id on success', async () => {
    const records = installMutation()
    const onOpenChange = vi.fn()
    const onSuccess = vi.fn()
    const createdHandler = vi.fn()
    document.addEventListener('jji-account-created', createdHandler)

    await render(<CreateLiveAccountDialog open onOpenChange={onOpenChange} onSuccess={onSuccess} />)

    await setInputValue(document.querySelector('#name') as HTMLInputElement, 'Main Trading')
    await setInputValue(document.querySelector('#number') as HTMLInputElement, '12345678')
    await setInputValue(document.querySelector('#startingBalance') as HTMLInputElement, '50000')
    await pickOption('Exness')
    await submitForm()

    expect(records).toHaveLength(1)

    await act(async () => {
      await records[0].options.onSuccess?.({ id: 'acc-1' }, records[0].variables)
    })

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeyPrefixes.accounts(SCOPE) })
    expect(toastMock.success).toHaveBeenCalledWith('Account created!', expect.anything())
    expect(emitTourEventMock).toHaveBeenCalledWith('account.created', { id: 'acc-1' })
    expect(createdHandler).toHaveBeenCalledTimes(1)
    const event = createdHandler.mock.calls[0][0] as CustomEvent
    expect(event.detail).toEqual({ id: 'acc-1', type: 'live' })
    expect(onSuccess).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('keeps the dialog open and shows an error toast when the mutation fails', async () => {
    const records = installMutation()
    const onOpenChange = vi.fn()
    const onSuccess = vi.fn()

    await render(<CreateLiveAccountDialog open onOpenChange={onOpenChange} onSuccess={onSuccess} />)

    await setInputValue(document.querySelector('#name') as HTMLInputElement, 'Main Trading')
    await setInputValue(document.querySelector('#number') as HTMLInputElement, '12345678')
    await setInputValue(document.querySelector('#startingBalance') as HTMLInputElement, '50000')
    await pickOption('Exness')
    await submitForm()

    await act(async () => {
      records[0].options.onError?.(new Error('boom'))
    })

    expect(toastMock.error).toHaveBeenCalledWith('Failed to create account', expect.anything())
    expect(reportClientErrorMock).toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(document.querySelector('[data-tour="create-account-dialog"]')).toBeTruthy()
  })
})
