import { sendEmail } from '@/lib/email'

export async function sendWelcomeEmail(toEmail: string, name: string | null) {
  const greeting = name ? `Hi ${name},` : 'Hi there,'

  const html = `
    <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">Welcome to JJI Pro! 🎉</h2>
      <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
        ${greeting}
      </p>
      <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
        Your payment was successful and your account has been fully upgraded to Pro. We are thrilled to have you!
      </p>
      <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
        You can now access all premium features on your dashboard.
      </p>
      <div style="margin: 30px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://www.justjournalit.site'}/dashboard" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Go to Dashboard
        </a>
      </div>
      <p style="color: #4a4a4a; font-size: 14px; line-height: 1.5; margin-top: 40px; border-top: 1px solid #eaeaea; padding-top: 20px;">
        If you have any questions, just reply to this email. We're here to help!<br>
        - The JJI Team
      </p>
    </div>
  `

  return sendEmail({
    to: toEmail,
    subject: 'Welcome to JJI Pro! Your account is upgraded.',
    html,
  })
}
