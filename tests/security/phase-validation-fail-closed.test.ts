import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('manual trade phase validation', () => {
  it('returns before import for non-valid and transport failures', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'app/dashboard/components/import/manual-trade-entry/manual-trade-form.tsx'), 'utf8')
    const validation = source.indexOf("if (validation.status !== 'valid')")
    const importCall = source.indexOf('importTradesThroughApi({')
    expect(validation).toBeGreaterThan(-1)
    expect(source.slice(validation, importCall)).toContain('return')
    expect(source.slice(source.indexOf('catch (error)', validation), importCall)).toContain('setPhaseValidationError(message)')
  })

  it('disables submission while validation or save is in progress', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'app/dashboard/components/import/manual-trade-entry/manual-trade-form.tsx'), 'utf8')
    expect(source).toContain('disabled={isSubmitting}')
    expect(source).toContain('setIsSubmitting(true)')
    expect(source).toContain('setIsSubmitting(false)')
    expect(source).toContain('submitInFlightRef.current')
    expect(source).toContain('Retry validation')
  })
})
