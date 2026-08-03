import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TradeWorkspace } from '@/components/ui/trade-workspace'

const roots: Array<ReturnType<typeof createRoot>> = []

afterEach(async () => {
  await act(async () => roots.splice(0).forEach(root => root.unmount()))
  document.body.innerHTML = ''
})

async function renderWorkspace(props: Partial<React.ComponentProps<typeof TradeWorkspace>> = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  const onRequestClose = vi.fn()
  await act(async () => root.render(
    <TradeWorkspace mode="dialog" open title="Edit trade" description="Trade fields" onRequestClose={onRequestClose} {...props}>
      <input aria-label="Symbol" />
    </TradeWorkspace>
  ))
  return { onRequestClose }
}

describe('TradeWorkspace', () => {
  it('labels dialog content and moves focus inside', async () => {
    await renderWorkspace()
    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog).toHaveAccessibleName('Edit trade')
    expect(dialog).toHaveAccessibleDescription('Trade fields')
    expect(dialog?.contains(document.activeElement)).toBe(true)
  })

  it('requests close on Escape when clean', async () => {
    const { onRequestClose } = await renderWorkspace()
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(onRequestClose).toHaveBeenCalledOnce()
  })

  it('requires confirmation before closing a dirty workspace', async () => {
    const onConfirmDiscard = vi.fn()
    const { onRequestClose } = await renderWorkspace({ dirty: true, onConfirmDiscard })
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(onRequestClose).not.toHaveBeenCalled()
    expect(document.querySelector('[role="alertdialog"]')).toHaveAccessibleName('Discard unsaved changes?')
    const discard = Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Discard changes')
    await act(async () => discard?.click())
    expect(onConfirmDiscard).toHaveBeenCalledOnce()
    expect(onRequestClose).toHaveBeenCalledOnce()
  })

  it('renders route mode as a named region instead of a modal', async () => {
    await renderWorkspace({ mode: 'route' })
    expect(document.querySelector('[role="region"]')).toHaveAccessibleName('Edit trade')
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })
})
