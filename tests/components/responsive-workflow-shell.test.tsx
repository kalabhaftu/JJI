import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ResponsiveWorkflowShell } from '@/components/ui/responsive-workflow-shell'

describe('ResponsiveWorkflowShell', () => {
  it('renders semantic heading, description, form, back navigation, and actions', () => {
    const markup = renderToStaticMarkup(
      <ResponsiveWorkflowShell title="Edit trade" description="Update journal fields" backHref="/dashboard/table" onSubmit={() => {}} actions={<button type="submit">Save</button>}>
        <label>Notes<input name="notes" /></label>
      </ResponsiveWorkflowShell>
    )
    const document = new DOMParser().parseFromString(markup, 'text/html')
    expect(document.querySelector('h1')?.textContent).toBe('Edit trade')
    expect(document.querySelector('form')).not.toBeNull()
    expect(document.querySelector('a')?.getAttribute('href')).toBe('/dashboard/table')
    expect(document.querySelector('footer button')?.textContent).toBe('Save')
  })

  it('announces unsaved changes', () => {
    const markup = renderToStaticMarkup(<ResponsiveWorkflowShell title="Edit" dirty actions={null}>Body</ResponsiveWorkflowShell>)
    expect(markup).toContain('Unsaved changes')
  })
})
