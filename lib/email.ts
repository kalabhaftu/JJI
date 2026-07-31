import { Resend } from 'resend'
import logger from '@/lib/logger'

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

export async function sendEmail(input: { to: string; subject: string; html: string }) {
  if (!resend) return { skipped: true as const }

  try {
    const result = await resend.emails.send({ from, to: [input.to], subject: input.subject, html: input.html })
    return { skipped: false as const, result }
  } catch (error) {
    logger.error({ event: 'email_delivery_failed', error, subject: input.subject, recipientPresent: Boolean(input.to) }, 'Resend email delivery failed')
    return { skipped: false as const, result: null }
  }
}
