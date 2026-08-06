import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub

const { toastMock, emitTourEventMock, reportClientErrorMock, reportErrorMock } = vi.hoisted(() => ({
  toastMock: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
  emitTourEventMock: vi.fn(),
  reportClientErrorMock: vi.fn(),
  reportErrorMock: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: toastMock }))
vi.mock('@/lib/tours/events', () => ({ emitTourEvent: emitTourEventMock }))
vi.mock('@/lib/observability/report-error', () => ({
  reportClientError: reportClientErrorMock,
  reportError: reportErrorMock,
}))
vi.mock('@/context/theme-provider', () => ({
  useTheme: () => ({
    theme: 'dark',
    accentPack: 'classic',
    widgetStyle: 'default',
    chartStyle: 'smooth',
    setTheme: vi.fn(),
    setAccentPack: vi.fn(),
    setWidgetStyle: vi.fn(),
    setChartStyle: vi.fn(),
  }),
}))
vi.mock('@/context/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'user@test.com' }, isLoading: false }),
}))
vi.mock('@/context/tour-context', () => ({
  useTour: () => ({ startTour: vi.fn(), isActive: false }),
}))
vi.mock('@/server/auth/providers', () => ({
  signOut: vi.fn(),
}))
vi.mock('@/lib/supabase', () => ({
  createClient: () => ({ auth: { signOut: vi.fn() } }),
}))

import { SettingsNavigation } from '@/app/dashboard/settings/components/settings-navigation'
import { SettingsProfileSection } from '@/app/dashboard/settings/components/settings-profile-section'
import { SettingsPreferencesSection } from '@/app/dashboard/settings/components/settings-preferences-section'
import SettingsPage from '@/app/dashboard/settings/page'
import { defaultAiSettings } from '@/app/dashboard/settings/components/settings-config'
import type { SettingsProfileData } from '@/app/dashboard/settings/components/settings-types'

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

function mockMatchMedia(matches: boolean) {
  const mql = {
    matches,
    media: '(min-width: 768px)',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }
  window.matchMedia = vi.fn().mockReturnValue(mql)
  return mql
}

function openDropdownMenu(trigger: HTMLElement) {
  act(() => {
    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
    trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }))
  })
  return settle()
}

function rowContaining(label: string): HTMLDivElement {
  const labelNode = Array.from(document.querySelectorAll('p')).find((node) => node.textContent === label)
  if (!labelNode) throw new Error(`Row label "${label}" not found`)
  const row = labelNode.closest('div.grid')
  if (!row) throw new Error(`Row for label "${label}" not found`)
  return row as HTMLDivElement
}

function findButtonWithText(text: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll('button')).find((candidate) =>
    candidate.textContent?.includes(text)
  )
  if (!button) throw new Error(`Button containing "${text}" not found`)
  return button as HTMLButtonElement
}

const CATEGORIES = [
  { id: 'profile', label: 'Profile', icon: () => <span /> },
  { id: 'preferences', label: 'Preferences', icon: () => <span /> },
] as const

const PROFILE_DATA: SettingsProfileData = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@test.com',
  autoAdjustAccountDate: false,
  breakEvenThreshold: 10,
  pnlDisplayMode: 'net',
  aiSettings: defaultAiSettings,
}

beforeEach(() => {
  toastMock.success.mockReset()
  toastMock.error.mockReset()
  toastMock.info.mockReset()
  emitTourEventMock.mockReset()
  reportClientErrorMock.mockReset()
  reportErrorMock.mockReset()
})

afterEach(() => {
  act(() => {
    roots.splice(0).forEach((root) => root.unmount())
    containers.splice(0).forEach((container) => container.remove())
  })
})

describe('Settings navigation orientation', () => {
  it('renders vertical on desktop', async () => {
    mockMatchMedia(true)
    const onValueChange = vi.fn()
    render(<SettingsNavigation categories={CATEGORIES} value="profile" onValueChange={onValueChange} />)
    await settle()

    const tablist = document.querySelector('[role="tablist"]')
    expect(tablist?.getAttribute('aria-orientation')).toBe('vertical')
  })

  it('renders horizontal on mobile', async () => {
    mockMatchMedia(false)
    const onValueChange = vi.fn()
    render(<SettingsNavigation categories={CATEGORIES} value="profile" onValueChange={onValueChange} />)
    await settle()

    const tablist = document.querySelector('[role="tablist"]')
    expect(tablist?.getAttribute('aria-orientation')).toBe('horizontal')
  })

  it('re-orients when the viewport crosses the breakpoint', async () => {
    const mql = mockMatchMedia(true)
    const onValueChange = vi.fn()
    render(<SettingsNavigation categories={CATEGORIES} value="profile" onValueChange={onValueChange} />)
    await settle()

    expect(document.querySelector('[role="tablist"]')?.getAttribute('aria-orientation')).toBe('vertical')

    const changeListener = mql.addEventListener.mock.calls.find(([event]) => event === 'change')?.[1] as
      | (() => void)
      | undefined
    expect(changeListener).toBeTruthy()

    mql.matches = false
    act(() => changeListener!())
    await settle()

    expect(document.querySelector('[role="tablist"]')?.getAttribute('aria-orientation')).toBe('horizontal')
  })

  it('reports tab changes to the caller and tour events', async () => {
    mockMatchMedia(true)
    const onValueChange = vi.fn()
    render(<SettingsNavigation categories={CATEGORIES} value="profile" onValueChange={onValueChange} />)
    await settle()

    act(() => {
      document.querySelector<HTMLElement>('[data-tour="settings-tab-preferences"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      )
    })
    await settle()

    expect(onValueChange).toHaveBeenCalledWith('preferences')
    expect(emitTourEventMock).toHaveBeenCalledWith('settings.tab.preferences')
  })
})

describe('Settings profile section', () => {
  it('saves locally edited profile fields', async () => {
    const onSave = vi.fn()
    let isEditingProfile = true
    let profileData = { ...PROFILE_DATA, firstName: 'Grace' }
    const setProfileData: React.Dispatch<React.SetStateAction<SettingsProfileData>> = (updater) => {
      profileData = typeof updater === 'function' ? (updater as (prev: SettingsProfileData) => SettingsProfileData)(profileData) : updater
    }

    function Harness() {
      return (
        <SettingsProfileSection
          user={{ email: 'ada@test.com' }}
          profileData={profileData}
          setProfileData={setProfileData}
          isEditingProfile={isEditingProfile}
          setIsEditingProfile={(next) => { isEditingProfile = Boolean(next) }}
          isLoadingProfile={false}
          isUpdatingProfile={false}
          onCancelEdit={() => { isEditingProfile = false }}
          onSave={onSave}
          subscriptionData={null}
          isLoadingSubscription={false}
          isCancelingSubscription={false}
          onCancelSubscription={async () => {}}
        />
      )
    }

    render(<Harness />)
    await settle()

    const firstNameInput = document.querySelector<HTMLInputElement>('input#first-name') ??
      Array.from(document.querySelectorAll('input')).find((input) => input.placeholder?.toLowerCase().includes('first'))!
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set
    act(() => {
      setter.call(firstNameInput, 'Katherine')
      firstNameInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await settle()

    act(() => {
      findButtonWithText('Save Profile').click()
    })
    await settle()

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(profileData.firstName).toBe('Katherine')
  })
})

describe('Settings preferences section', () => {
  it('saves the break-even threshold from its own row without a global profile save', async () => {
    const onBreakEvenSave = vi.fn()
    let breakEvenDraft = '10'
    const setBreakEvenDraft: React.Dispatch<React.SetStateAction<string>> = (updater) => {
      breakEvenDraft = typeof updater === 'function' ? (updater as (prev: string) => string)(breakEvenDraft) : updater
    }

    function Harness() {
      return (
        <SettingsPreferencesSection
          theme="dark"
          accentPack="classic"
          widgetStyle="default"
          chartStyle="smooth"
          onThemeChange={vi.fn()}
          onAccentChange={vi.fn()}
          onWidgetStyleChange={vi.fn()}
          onChartStyleChange={vi.fn()}
          timezone="America/New_York"
          onTimezoneChange={vi.fn()}
          use24HourFormat={true}
          setUse24HourFormat={vi.fn()}
          profileData={PROFILE_DATA}
          breakEvenDraft={breakEvenDraft}
          setBreakEvenDraft={setBreakEvenDraft}
          isUpdatingBreakEven={false}
          onBreakEvenSave={onBreakEvenSave}
          onPnlDisplayModeChange={vi.fn()}
          privacyMode={false}
          onPrivacyModeToggle={vi.fn()}
          onAutoAdjustChange={vi.fn()}
          isLoadingProfile={false}
          isUpdatingAiSettings={false}
          onAiSettingsChange={vi.fn()}
        />
      )
    }

    render(<Harness />)
    await settle()

    const breakEvenRow = Array.from(document.querySelectorAll('p')).find((node) =>
      node.textContent?.includes('Break-even threshold')
    )?.closest('div.grid')
    const breakEvenInput = breakEvenRow?.querySelector<HTMLInputElement>('input[type="number"]')
    if (!breakEvenInput) throw new Error('Break-even input not found')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set
    act(() => {
      setter.call(breakEvenInput, '25')
      breakEvenInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await settle()

    act(() => {
      findButtonWithText('Save').click()
    })
    await settle()

    expect(onBreakEvenSave).toHaveBeenCalledTimes(1)
    expect(document.body.textContent).not.toContain('Save Profile')
    expect(breakEvenDraft).toBe('25')
  })

  it('uses the persisted 24-hour format setting from the store', async () => {
    const setUse24HourFormat = vi.fn()
    let use24HourFormat = false

    function Harness() {
      return (
        <SettingsPreferencesSection
          theme="dark"
          accentPack="classic"
          widgetStyle="default"
          chartStyle="smooth"
          onThemeChange={vi.fn()}
          onAccentChange={vi.fn()}
          onWidgetStyleChange={vi.fn()}
          onChartStyleChange={vi.fn()}
          timezone="America/New_York"
          onTimezoneChange={vi.fn()}
          use24HourFormat={use24HourFormat}
          setUse24HourFormat={(value) => {
            use24HourFormat = value
            setUse24HourFormat(value)
          }}
          profileData={PROFILE_DATA}
          breakEvenDraft="10"
          setBreakEvenDraft={vi.fn()}
          isUpdatingBreakEven={false}
          onBreakEvenSave={vi.fn()}
          onPnlDisplayModeChange={vi.fn()}
          privacyMode={false}
          onPrivacyModeToggle={vi.fn()}
          onAutoAdjustChange={vi.fn()}
          isLoadingProfile={false}
          isUpdatingAiSettings={false}
          onAiSettingsChange={vi.fn()}
        />
      )
    }

    render(<Harness />)
    await settle()

    const row = rowContaining('Time Format')
    expect(row.textContent).toContain('12-hour')

    const trigger = Array.from(row.querySelectorAll('button')).find((button) => button.textContent?.includes('Change'))
    if (!trigger) throw new Error('Time Format Change trigger not found')
    await openDropdownMenu(trigger)

    const radioItems = Array.from(document.querySelectorAll('[role="menuitemradio"]'))
    const twelveHour = radioItems.find((item) => item.textContent?.includes('12-hour (2:30 PM)'))
    expect(twelveHour).toBeTruthy()

    act(() => {
      twelveHour?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await settle()

    expect(setUse24HourFormat).toHaveBeenCalledWith(false)
    expect(toastMock.success).toHaveBeenCalledWith('Time format updated', expect.anything())
  })
})

describe('Settings page draft preservation', () => {
  it('keeps edited profile fields when switching tabs and back', async () => {
    const storage = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, String(value)),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
      },
      configurable: true,
    })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const mql = mockMatchMedia(true)

    render(<SettingsPage />)
    await settle()
    await settle()

    const firstNameInput = Array.from(document.querySelectorAll('input')).find((input) =>
      input.placeholder?.toLowerCase().includes('first')
    )
    if (!firstNameInput) throw new Error('First name input not rendered')

    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set
    act(() => {
      setter.call(firstNameInput, 'Rosalind')
      firstNameInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await settle()

    act(() => {
      document.querySelector<HTMLElement>('[data-tour="settings-tab-preferences"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      )
    })
    await settle()
    await settle()

    act(() => {
      document.querySelector<HTMLElement>('[data-tour="settings-tab-profile"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      )
    })
    await settle()
    await settle()

    const inputAfterSwitch = Array.from(document.querySelectorAll('input')).find((input) =>
      input.placeholder?.toLowerCase().includes('first')
    )
    expect(inputAfterSwitch?.value).toBe('Rosalind')
    expect(!!mql).toBe(true)
  })
})