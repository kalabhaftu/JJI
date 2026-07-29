import { DocsCallout, DocsPage, DocsSection } from '@/components/docs/docs-page'

const faqs = [
  {
    q: 'Is JJI free?',
    a: 'No, JJI is a paid platform at $10/month. It is currently proprietary software, but may be open-sourced again in the future. Payment is processed via cryptocurrency through NOWPayments. There is no free tier or trial - all features require an active subscription.',
  },
  {
    q: 'Is there a mobile app?',
    a: 'Yes, JJI has a mobile app built with Flutter, available for both Android and iOS. It syncs with your web account and includes tabs for the dashboard, trades, journal, challenges, and settings. Push notifications are delivered via Firebase Cloud Messaging. You can download it from the Google Play Store and Apple App Store.',
  },
  {
    q: 'How do I import trades?',
    a: 'Navigate to the import flow from the dashboard navbar or press Cmd+I. JJI supports importing CSV files (NinjaTrader 8, Tradovate, Rithmic, Interactive Brokers, Webull, Thor, Match-Trader, Exness) and real-time TradingView webhooks. Direct broker API syncs (Tradovate, Rithmic) are currently under development. The import wizard provides a column mapper and parsed preview before saving trades to your account.',
  },
  {
    q: 'What data formats are supported?',
    a: 'JJI accepts CSV broker exports, TradingView webhook JSON payloads, Tradovate CSV exports, Rithmic CSV exports, and proprietary formats from supported brokers. You can also enter trades manually through the trade entry form. The import engine normalizes all formats into a consistent internal schema so reports and analytics work the same regardless of the source.',
  },
  {
    q: 'Where is my data stored?',
    a: 'All data is stored in a PostgreSQL database hosted on Supabase. Every user\'s data is strictly scoped and isolated - there is no cross-user access. The dashboard, journal, reports, and all other features read from the same underlying data store, so any change you make is reflected everywhere immediately.',
  },
  {
    q: 'Why does the dashboard look empty?',
    a: 'First, check your account-level filters and date range at the top of the dashboard - a mismatched filter is the most common cause. Next, confirm that your trade data was imported successfully by visiting the trades page. If you see trades there but the dashboard is still empty, review the troubleshooting checklist in the docs. If the problem persists, use the feedback form to reach out with details.',
  },
  {
    q: 'How do prop-firm challenges work?',
    a: 'JJI uses a master-account-based lifecycle model for prop-firm challenges. You configure phases (1-phase or 2-phase) with profit targets, maximum drawdown limits, and daily loss limits. The system automatically tracks your progress, transitions between phases when targets are met, and supports payout tracking when you pass. All evaluation accounts are tied to a real master account so your overall performance stays connected.',
  },
  {
    q: 'Can I share my trades or reports?',
    a: 'Yes, you can generate public read-only share links for any report. These links can be shared with anyone - even non-users - and display a snapshot of the report data. You can revoke or expire shared links at any time from your account settings.',
  },
  {
    q: 'How do I cancel my subscription?',
    a: 'Go to Settings → Subscription and follow the cancellation flow. Cancellations take effect immediately for billing purposes, but your data remains fully accessible until the end of the current billing period. No prorated refunds are issued for partial months. After the billing period ends, your account is downgraded and data access is restricted.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Go to Settings → Account Actions → Delete Account. This action is permanent and irreversible - all your trades, journal entries, challenge data, reports, and account information will be deleted immediately. There is no recovery option, so make sure you export any data you want to keep before proceeding.',
  },
  {
    q: 'What AI features are available?',
    a: 'JJI includes an AI Chat feature powered by OpenAI and xAI models. You can ask it to analyze your trading performance, audit your risk metrics, calculate strategy expectancy, and run psychological assessments based on your journal entries. The AI has context of your account data and can provide personalized insights, not generic advice.',
  },
  {
    q: 'Does the mobile app have all features?',
    a: 'The mobile app covers the core feature set - dashboard overview, trade list and management, journal entries, and prop-firm challenge tracking. However, some advanced features are currently web-only: widget customization on the dashboard, detailed report generation and export, and the admin panel. The team is working to close this gap in future releases.',
  },
]

export default function FAQPage() {
  return (
    <DocsPage
      badge="Resources"
      title="FAQ & Troubleshooting"
      description="Frequently asked questions about using JJI - pricing, imports, mobile app, data, subscriptions, and more."
    >
      <DocsSection title="Frequently Asked Questions">
        <div className="space-y-8">
          {faqs.map((faq, i) => {
            const finalId = faq.q.toLowerCase()
              .replace(/[^\w\s-]/g, '')
              .replace(/\s+/g, '-')
              .trim();
            return (
              <div key={i} id={finalId} className="scroll-mt-24">
                <h3 className="text-lg font-semibold mb-2">{faq.q}</h3>
                <p className="text-muted-foreground">{faq.a}</p>
              </div>
            )
          })}
        </div>
      </DocsSection>

      <DocsCallout title="Still need help?" tone="default">
        If you need help with something not covered here, please use the
        feedback form in the app and include as much detail as possible about
        your issue - including steps to reproduce, screenshots, and your account
        email. This helps us resolve your problem quickly.
      </DocsCallout>
    </DocsPage>
  )
}
