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

export function getWhopEnvironment(): WhopEnvironment {
  const value = requireWhopEnv('WHOP_ENVIRONMENT')
  if (value !== 'sandbox' && value !== 'production') {
    throw new Error('Whop configuration is invalid: WHOP_ENVIRONMENT must be sandbox or production')
  }
  return value
}

export function getWhopConfig() {
  const planId = requireWhopEnv('WHOP_PLAN_ID_PRO')
  if (!/^plan_[A-Za-z0-9]+$/.test(planId)) {
    throw new Error('Whop configuration is invalid: WHOP_PLAN_ID_PRO must be a plan ID')
  }

  return {
    apiKey: requireWhopEnv('WHOP_API_KEY'),
    webhookSecret: requireWhopEnv('WHOP_WEBHOOK_SECRET'),
    environment: getWhopEnvironment(),
    planIds: { pro: planId } satisfies Record<WhopPlanKey, string>,
  }
}
