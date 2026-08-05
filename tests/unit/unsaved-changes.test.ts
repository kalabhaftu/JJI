import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import { useUnsavedChanges, type UnsavedChangesController } from '@/hooks/use-unsaved-changes'

const roots: Array<ReturnType<typeof createRoot>> = []

afterEach(async () => {
  await act(async () => roots.splice(0).forEach(root => root.unmount()))
  document.body.innerHTML = ''
})

async function renderController(dirty: boolean) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  let controller: UnsavedChangesController | undefined
  function Probe({ isDirty }: { isDirty: boolean }) {
    controller = useUnsavedChanges(isDirty)
    return null
  }
  await act(async () => root.render(createElement(Probe, { isDirty: dirty })))
  return {
    controller: () => controller as UnsavedChangesController,
    rerender: (isDirty: boolean) => act(async () => root.render(createElement(Probe, { isDirty }))),
  }
}

describe('useUnsavedChanges', () => {
  it('allows leaving when clean', async () => {
    const { controller } = await renderController(false)
    let allowed = false
    await act(async () => { allowed = controller().requestLeave('anything') })
    expect(allowed).toBe(true)
  })

  it('blocks a dirty leave until confirmLeave clears the pending destination', async () => {
    const { controller } = await renderController(true)
    let allowed = true
    await act(async () => { allowed = controller().requestLeave('close') })
    expect(allowed).toBe(false)
    await act(async () => controller().confirmLeave())
    await act(async () => { allowed = controller().requestLeave('close') })
    expect(allowed).toBe(true)
  })

  it('still blocks a fresh leave after cancelLeave clears the pending destination', async () => {
    const { controller } = await renderController(true)
    let allowed = true
    await act(async () => { allowed = controller().requestLeave('close') })
    expect(allowed).toBe(false)
    await act(async () => controller().cancelLeave())
    await act(async () => { allowed = controller().requestLeave('close') })
    expect(allowed).toBe(false)
  })

  it('tracks dirty prop changes across re-renders', async () => {
    const { controller, rerender } = await renderController(true)
    expect(controller().isDirty).toBe(true)
    await rerender(false)
    expect(controller().isDirty).toBe(false)
  })

  it('allows a clean leave and blocks once the prop becomes dirty', async () => {
    const { controller, rerender } = await renderController(false)
    let allowed = false
    await act(async () => { allowed = controller().requestLeave('close') })
    expect(allowed).toBe(true)
    await rerender(true)
    await act(async () => { allowed = controller().requestLeave('close') })
    expect(allowed).toBe(false)
  })
})
