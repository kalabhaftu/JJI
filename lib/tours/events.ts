export const TOUR_EVENT = 'jji-tour-event'

export function emitTourEvent(key: string, detail?: Record<string, unknown>) {
  if (typeof document === 'undefined') return
  document.dispatchEvent(new CustomEvent(TOUR_EVENT, { detail: { key, ...detail } }))
}
