import { Resend } from 'resend'
import { reportError } from '@/lib/observability/report-error'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const from = process.env.RESEND_FROM_EMAIL || 'JJI <onboarding@resend.dev>'

export function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] ?? character)
}

export interface SendEmailInput {
  to: string
  subject: string
  html: string
  idempotencyKey: string
  operation: string
  requestId?: string
  entityId?: string
}

export async function sendEmail(input: SendEmailInput) {
  if (!resend) {
    return { skipped: true as const, delivered: false as const, providerId: null }
  }

  try {
    const result = await resend.emails.send(
      { from, to: [input.to], subject: input.subject, html: input.html },
      { idempotencyKey: input.idempotencyKey.slice(0, 256) },
    )
    if (result.error) {
      throw new Error(`Resend rejected email delivery: ${result.error.name ?? 'provider_error'}`)
    }
    return {
      skipped: false as const,
      delivered: true as const,
      providerId: result.data?.id ?? null,
    }
  } catch (error) {
    reportError(error, {
      surface: 'background-job',
      operation: input.operation,
      ...(input.requestId ? { requestId: input.requestId } : {}),
      ...(input.entityId ? { entityId: input.entityId } : {}),
      tags: {
        provider: 'resend',
        recipientPresent: Boolean(input.to),
      },
    })
    return { skipped: false as const, delivered: false as const, providerId: null }
  }
}
