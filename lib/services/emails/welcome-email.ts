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
      <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 24px 0;">
        <h3 style="color: #1a1a1a; margin-top: 0;">🚀 Next steps to get started:</h3>
        <ol style="color: #4a4a4a; font-size: 15px; line-height: 1.6; padding-left: 20px; margin-bottom: 0;">
          <li style="margin-bottom: 12px;"><strong>Sync Your Accounts:</strong> Connect your Prop Firm or Brokerage accounts in Settings to start tracking automatically.</li>
          <li style="margin-bottom: 12px;"><strong>Set Your Goals:</strong> Define your daily loss limits, profit targets, and customized trading rules.</li>
          <li><strong>Review Your Insights:</strong> Check out the AI-driven analytics on your dashboard to see personalized trading advice based on your performance.</li>
        </ol>
      </div>
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
