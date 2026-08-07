import { describe, expect, it } from 'vitest'
import { resolveSurfacedPhaseStatus } from '@/lib/prop-firm/reporting'

describe('resolveSurfacedPhaseStatus', () => {
  it('surfaces the current phase of a funded master as funded even when marked passed', () => {
    expect(resolveSurfacedPhaseStatus(
      { status: 'funded', currentPhase: 3 },
      { status: 'passed', phaseNumber: 3 }
    )).toBe('funded')
  })

  it('keeps historical passed phases passed for a funded master', () => {
    expect(resolveSurfacedPhaseStatus(
      { status: 'funded', currentPhase: 3 },
      { status: 'passed', phaseNumber: 2 }
    )).toBe('passed')
  })

  it('returns the phase status for non-funded masters', () => {
    expect(resolveSurfacedPhaseStatus(
      { status: 'active', currentPhase: 2 },
      { status: 'active', phaseNumber: 2 }
    )).toBe('active')
  })

  it('does not surface the current phase of a failed master', () => {
    expect(resolveSurfacedPhaseStatus(
      { status: 'failed', currentPhase: 1 },
      { status: 'passed', phaseNumber: 1 }
    )).toBe('passed')
  })

  it('does not surface a phase ahead of the funded master current phase', () => {
    expect(resolveSurfacedPhaseStatus(
      { status: 'funded', currentPhase: 3 },
      { status: 'passed', phaseNumber: 4 }
    )).toBe('passed')
  })
})