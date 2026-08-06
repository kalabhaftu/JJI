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

describe('OTP recovery flow', () => {
  it('clears the error and returns to the email screen when going back', async () => {
    verifyOtpMock.mockRejectedValueOnce(new Error('Invalid code'))

    render(<UserAuthForm />)
    await sendCode('user@example.com')

    typeOtp('123456')
    await settle()
    await new Promise((resolve) => setTimeout(resolve, 450))
    await settle()

    expect(document.querySelector('[role="alert"]')).toBeTruthy()

    act(() => {
      Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Change email'))!.click()
    })
    await settle()

    expect(document.querySelector('[role="alert"]')).toBeNull()
    expect(document.querySelector('input#email')).toBeTruthy()
  })

  it('recovers successfully after a failed attempt', async () => {
    verifyOtpMock.mockRejectedValueOnce(new Error('Invalid code'))
    verifyOtpMock.mockResolvedValueOnce(undefined)

    render(<UserAuthForm />)
    await sendCode('user@example.com')

    typeOtp('123456')
    await settle()
    await new Promise((resolve) => setTimeout(resolve, 450))
    await settle()

    expect(document.querySelector('[role="alert"]')).toBeTruthy()

    typeOtp('654321')
    await settle()
    await new Promise((resolve) => setTimeout(resolve, 450))
    await settle()

    expect(toastMock.success).toHaveBeenCalledWith('Verified successfully', expect.anything())
    expect(verifyOtpMock).toHaveBeenCalledTimes(2)
  })

  it('locks the resend during a rate limit and unlocks it after the cooldown', async () => {
    vi.useFakeTimers()
    try {
      verifyOtpMock.mockRejectedValueOnce(new Error('rate limit exceeded. Try again later.'))

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

      typeOtp('123456')
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600)
      })

      const resend = () => Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Resend'))!
      expect(toastMock.error).toHaveBeenCalledWith('Too Many Attempts', expect.anything())

      let sawLocked = false
      for (let i = 0; i < 900; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(50)
        })
        if (resend().textContent?.includes('Resend locked')) {
          sawLocked = true
          expect(resend().hasAttribute('disabled')).toBe(true)
          break
        }
      }
      expect(sawLocked).toBe(true)

      let sawUnlocked = false
      for (let i = 0; i < 200; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(50)
        })
        if (resend().textContent?.includes('Resend Code') && !resend().hasAttribute('disabled')) {
          sawUnlocked = true
          break
        }
      }
      expect(sawUnlocked).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})