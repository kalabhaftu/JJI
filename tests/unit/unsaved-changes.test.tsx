import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'

import { useUnsavedChanges, type UnsavedChangesController } from '@/hooks/use-unsaved-changes'

describe('useUnsavedChanges', () => {
  it('allows clean navigation and gates dirty navigation until confirmed', async () => {
    let controller: UnsavedChangesController | undefined
    const container = document.createElement('div')
    const root = createRoot(container)
    function Probe({ dirty }: { dirty: boolean }) {
      controller = useUnsavedChanges(dirty)
      return null
    }
    await act(async () => root.render(<Probe dirty={false} />))
    expect(controller?.requestLeave('/clean')).toBe(true)
    await act(async () => root.render(<Probe dirty />))
    expect(controller?.requestLeave('/next')).toBe(false)
    expect(controller?.isDirty).toBe(true)
    await act(async () => controller?.cancelLeave())
    expect(controller?.requestLeave('/next')).toBe(false)
    await act(async () => controller?.confirmLeave())
    expect(controller?.isDirty).toBe(false)
    await act(async () => root.unmount())
  })

  it('registers a beforeunload guard only while dirty', async () => {
    let controller: UnsavedChangesController | undefined
    const root = createRoot(document.createElement('div'))
    function Probe() { controller = useUnsavedChanges(true); return null }
    await act(async () => root.render(<Probe />))
    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(controller?.isDirty).toBe(true)
    await act(async () => root.unmount())
  })
})
