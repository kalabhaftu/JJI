import { reportError, type ErrorSurface } from '@/lib/observability/report-error'

const allowedSurfaces = new Set<ErrorSurface>([
  'client',
  'server',
  'phase-evaluation',
  'import',
])
const surface = process.argv[2] as ErrorSurface | undefined
const productionTarget = process.env.NODE_ENV === 'production'
  || process.env.VERCEL_ENV === 'production'
  || /(?:^|\.)justjournalit\.site$/i.test(process.env.NEXT_PUBLIC_APP_URL ?? '')

if (productionTarget) {
  throw new Error('Controlled observability verification refuses production targets')
}
if (process.env.JJI_CONTROLLED_FAILURES !== '1') {
  throw new Error('Set JJI_CONTROLLED_FAILURES=1 to acknowledge a controlled local failure')
}
if (!surface || !allowedSurfaces.has(surface)) {
  throw new Error(
    'Choose one verification surface: client, server, phase-evaluation, or import',
  )
}

const eventId = reportError(
  new Error(`Controlled ${surface} observability verification`),
  {
    surface,
    operation: 'controlled-observability-verification',
    tags: { controlled: true },
  },
)

console.log(JSON.stringify({ surface, eventId: eventId ?? null }))
