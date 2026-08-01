import 'server-only'

export type WhopEnvironment = 'sandbox' | 'production'
export type WhopPlanKey = 'pro'

function requireWhopEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Whop configuration is incomplete: ${name} is required`)
  }
  return value
}

function normalizePlanId(value: string, environment: WhopEnvironment): string {
  if (/^plan_[A-Za-z0-9]+$/.test(value)) return value

  try {
    const url = new URL(value)
    const expectedHost = environment === 'sandbox' ? 'sandbox.whop.com' : 'whop.com'
    const segments = url.pathname.split('/').filter(Boolean)
    if (
      url.protocol === 'https:'
      && url.hostname === expectedHost
      && segments.length === 2
      && segments[0] === 'checkout'
      && /^plan_[A-Za-z0-9]+$/.test(segments[1] ?? '')
    ) {
      return segments[1]!
    }
  } catch {
    // The stable error below covers malformed URLs without reflecting secrets.
  }

  throw new Error(
    'Whop configuration is invalid: WHOP_PLAN_ID_PRO must be a plan ID or matching-environment checkout URL',
  )
}

export function getWhopEnvironment(): WhopEnvironment {
  const value = requireWhopEnv('WHOP_ENVIRONMENT')
  if (value !== 'sandbox' && value !== 'production') {
    throw new Error('Whop configuration is invalid: WHOP_ENVIRONMENT must be sandbox or production')
  }
  return value
}

export function getWhopConfig() {
  const environment = getWhopEnvironment()
  const planId = normalizePlanId(requireWhopEnv('WHOP_PLAN_ID_PRO'), environment)

  return {
    apiKey: requireWhopEnv('WHOP_API_KEY'),
    webhookSecret: requireWhopEnv('WHOP_WEBHOOK_SECRET'),
    environment,
    planIds: { pro: planId } satisfies Record<WhopPlanKey, string>,
  }
}
