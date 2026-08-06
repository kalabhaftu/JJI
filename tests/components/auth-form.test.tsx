import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub

const { verifyOtpMock, signInWithEmailMock, toastMock, reportClientErrorMock } = vi.hoisted(() => ({
  verifyOtpMock: vi.fn(),
  signInWithEmailMock: vi.fn(),
  toastMock: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
  reportClientErrorMock: vi.fn(),
}))

vi.mock('@/server/auth/otp', () => ({ verifyOtp: verifyOtpMock }))
vi.mock('@/server/auth/providers', () => ({
  signInWithEmail: signInWithEmailMock,
  signInWithDiscord: vi.fn(),
  signInWithGoogle: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: toastMock }))
vi.mock('@/lib/observability/report-error', () => ({
  reportClientError: reportClientErrorMock,
  reportError: vi.fn(),
}))

import { UserAuthForm } from '@/components/user-auth-form'

const roots: Array<ReturnType<typeof createRoot>> = []
const containers: HTMLDivElement[] = []

function render(element: React.ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  containers.push(container)
  const root = createRoot(container)
  roots.push(root)
  act(() => {
    root.render(element)
  })
}

async function settle() {
  for (let i = 0; i < 8; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set
  setter.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

async function sendCode(email: string) {
  signInWithEmailMock.mockResolvedValueOnce({ error: null, url: null })
  const emailInput = document.querySelector<HTMLInputElement>('input#email')!
  setInputValue(emailInput, email)
  await settle()
  act(() => {
    Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Send verification code'))!.click()
  })
  await settle()
}

function typeOtp(code: string) {
  const otpInput = document.querySelector<HTMLInputElement>('input[data-input-otp]')!
  setInputValue(otpInput, code)
}

function clickOtpSubmit() {
  act(() => {
    Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Verify code'))!.click()
  })
}

beforeEach(() => {
  verifyOtpMock.mockReset()
  signInWithEmailMock.mockReset()
  toastMock.success.mockReset()
  toastMock.error.mockReset()
  toastMock.info.mockReset()
  reportClientErrorMock.mockReset()
})

afterEach(() => {
  act(() => {
    roots.splice(0).forEach((root) => root.unmount())
    containers.splice(0).forEach((container) => container.remove())
  })
})

describe('UserAuthForm OTP error persistence', () => {
  it('shows a persistent inline error after a failed verification attempt', async () => {
    verifyOtpMock.mockRejectedValueOnce(new Error('Invalid code'))

    render(<UserAuthForm />)
    await sendCode('user@example.com')

    expect(signInWithEmailMock).toHaveBeenCalled()

    typeOtp('123456')
    await settle()
    await new Promise((resolve) => setTimeout(resolve, 450))
    await settle()

    const alert = document.querySelector('[role="alert"]')
    expect(alert).toBeTruthy()
    expect(alert!.textContent).toContain("That code didn't work. Please try again.")

    expect(toastMock.error).toHaveBeenCalledWith('Verification Failed', expect.anything())
  })

  it('keeps the error message visible while the user retypes the code', async () => {
    verifyOtpMock.mockRejectedValueOnce(new Error('Invalid code'))

    render(<UserAuthForm />)
    await sendCode('user@example.com')

    typeOtp('123456')
    await settle()
    await new Promise((resolve) => setTimeout(resolve, 450))
    await settle()

    expect(document.querySelector('[role="alert"]')).toBeTruthy()

    typeOtp('234567')
    await settle()

    expect(document.querySelector('[role="alert"]')).toBeTruthy()
  })

  it('runs a 30s resend countdown and re-enables the resend button', async () => {
    vi.useFakeTimers()
    try {
      render(<UserAuthForm />)

      signInWithEmailMock.mockResolvedValueOnce({ error: null, url: null })
      const emailInput = document.querySelector<HTMLInputElement>('input#email')!
      setInputValue(emailInput, 'user@example.com')
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      act(() => {
        Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Send verification code'))!.click()
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })

      const resend = () => Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Resend'))!
      expect(resend().textContent).toContain('Resend in 30s')
      expect(resend().hasAttribute('disabled')).toBe(true)

      for (let i = 0; i < 30; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000)
        })
      }

      expect(resend().textContent).toContain('Resend Code')
      expect(resend().hasAttribute('disabled')).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})