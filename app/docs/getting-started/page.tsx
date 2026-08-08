import { HugeiconsIcon } from '@hugeicons/react'
import {
  CheckmarkCircle02Icon,
  DashboardSquare01Icon,
  FileImportIcon,
  Settings02Icon,
  SmartPhone01Icon,
} from '@hugeicons/core-free-icons'
import { DocsCallout, DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'

export default function GettingStartedDocsPage() {
  return (
    <DocsPage
      badge="Getting Started"
      title="Getting Started with JJI"
      description="A complete walkthrough from signup to your first trade review - covering the web dashboard and mobile app."
    >
      <DocsSection title="1. Create your account">
        <p>
          Navigate to the JJI landing page and click <strong>Sign In</strong>. You can sign up
          using either an email magic link or an OAuth provider (Google, GitHub, or Discord).
        </p>
        <DocsCardGrid>
          <DocsInfoCard
            icon={<HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={1.5} color="currentColor" />}
            title="Email magic link"
            description="Enter your email address and click Continue. A one-time sign-in link is sent to your inbox - no password required. Click the link and your session starts immediately."
            items={['Check spam if the email does not arrive within 60 seconds', 'The link expires after 15 minutes; request a new one if needed', 'No password to remember or reset']}
          />
          <DocsInfoCard
            icon={<HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={1.5} color="currentColor" />}
            title="OAuth sign-up"
            description="Choose Google, GitHub, or Discord from the sign-in page. You are redirected to the provider, asked to consent, and returned to JJI with an active session."
            items={['Uses your existing provider account', 'No additional credentials to manage', 'Profile info (name, avatar) syncs from the provider']}
          />
        </DocsCardGrid>
        <p>
          After your first sign-in a workspace is provisioned automatically. You land on the dashboard
          shell - your starting point for all trading analytics.
        </p>
      </DocsSection>

      <DocsSection title="2. Choose a subscription plan">
        <p>
          JJI is a paid platform at <strong>$10/month</strong> (billed via cryptocurrency). The
          subscription grants full access to every feature including trade import, dashboard widgets,
          journaling, prop-firm tracking, AI chat, backtesting, playbook, and reports.
        </p>
        <DocsCardGrid>
          <DocsInfoCard
            icon={<HugeiconsIcon icon={Settings02Icon} strokeWidth={1.5} color="currentColor" />}
            title="How to subscribe"
            description="Go to Settings → Subscription. Select the monthly plan, choose your preferred crypto payment method, and complete the transaction on the payment screen."
            items={['Supported cryptocurrencies are listed at checkout', 'The subscription activates immediately after confirmation', 'Your workspace remains active as long as the subscription is current']}
          />
          <DocsInfoCard
            icon={<HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={1.5} color="currentColor" />}
            title="Grace period & lapses"
            description="If a subscription payment lapses, you have a 7-day grace period to renew before data access is restricted. No data is ever deleted."
            items={['You can re-subscribe at any time to restore access', 'Historical data is preserved during lapses', 'Contact support via the feedback page for billing issues']}
          />
        </DocsCardGrid>
      </DocsSection>

      <DocsSection title="3. Import your first trades">
        <p>
          The import flow ingests trade data from multiple sources. Open the import dialog from the
          dashboard navbar or by pressing <kbd>Cmd+I</kbd> (<kbd>Ctrl+I</kbd> on Windows).
        </p>
        <DocsCardGrid>
          <DocsInfoCard
            icon={<HugeiconsIcon icon={FileImportIcon} strokeWidth={1.5} color="currentColor" />}
            title="CSV import"
            description="Download a broker export as CSV and upload it directly. A mapping preview lets you verify columns before saving."
            items={['Upload broker exports and generic CSV formats', 'Map your columns to JJI fields in the preview step', 'Choose an existing account or create a new one during import']}
          />
          <DocsInfoCard
            icon={<HugeiconsIcon icon={FileImportIcon} strokeWidth={1.5} color="currentColor" />}
            title="Webhooks & sync sources"
            description="For live automation, configure a TradingView webhook or Thor sync. Tradovate, DxFeed, and Rithmic live broker sync are currently under development."
            items={['TradingView webhooks: copy the webhook URL from Settings -> Integrations', 'Thor sync remains available where configured', 'Tradovate, DxFeed, and Rithmic files can still be imported through CSV flows']}
          />
        </DocsCardGrid>
        <p>
          After the import completes, review the parsed trades on the confirmation screen. Verify row
          counts, date ranges, and assigned accounts before finalizing. Imported trades appear
          immediately in the dashboard, trade table, and journal.
        </p>
      </DocsSection>

      <DocsSection title="4. Review the dashboard">
        <p>
          The dashboard is your performance command center. It aggregates all imported trades into KPI
          cards, charts, and a calendar overview - all scoped by your active filters.
        </p>
        <DocsCardGrid>
          <DocsInfoCard
            icon={<HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={1.5} color="currentColor" />}
            title="KPI cards & widgets"
            description="The top row shows key metrics: total trades, win rate, profit factor, average RR, net P&L, and Sharpe ratio. Below the KPIs, widget panels display equity curves, daily P&L bars, trade distribution, and more."
            items={['KPI values update automatically as you change filters', 'Widgets can be added, removed, resized, and rearranged', 'Dashboard templates let you save multiple layouts for different review modes']}
          />
          <DocsInfoCard
            icon={<HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={1.5} color="currentColor" />}
            title="Filters & date range"
            description="Use the filter bar to scope data by account, date range, symbol, strategy, and tags. All dashboard components respond to the active filter set."
            items={['Date presets: Today, This Week, This Month, This Quarter, This Year, All Time', 'Account filters default to all accounts; toggle individual accounts on/off', 'Saved filter presets are available for quick switching']}
          />
        </DocsCardGrid>
      </DocsSection>

      <DocsSection title="5. Set your preferences">
        <p>
          Visit <strong>Settings</strong> from the sidebar to configure how JJI displays and
          processes your data. These settings persist across sessions and devices.
        </p>
        <DocsCardGrid>
          <DocsInfoCard
            icon={<HugeiconsIcon icon={Settings02Icon} strokeWidth={1.5} color="currentColor" />}
            title="Profile & display"
            description="Set your timezone, date and time format, and theme (light, dark, or system). The timezone affects how trades are grouped into trading days."
            items={['Timezone defaults to browser detection; override for consistent day boundaries', 'Theme applies to both web and mobile after sync', 'Display name and avatar sync from your OAuth provider or can be set manually']}
          />
          <DocsInfoCard
            icon={<HugeiconsIcon icon={Settings02Icon} strokeWidth={1.5} color="currentColor" />}
            title="Trading defaults"
            description="Configure the break-even threshold (used to classify trades as winners, losers, or break-even) and default account settings."
            items={['Break-even threshold: trades within ±X% or ±X ticks of zero are classified as break-even', 'Default commission and fee rates apply to imported trades that lack cost data', 'Linked accounts support available sync sources and saved import settings']}
          />
        </DocsCardGrid>
      </DocsSection>

      <DocsSection title="6. Set up the mobile app">
        <p>
          JJI has a companion mobile app built with Flutter, available on both Android and
          iOS. It syncs with your web account in real time.
        </p>
        <DocsCardGrid>
          <DocsInfoCard
            icon={<HugeiconsIcon icon={SmartPhone01Icon} strokeWidth={1.5} color="currentColor" />}
            title="Download & sign in"
            description="Download JJI from the Google Play Store or Apple App Store. Open the app and sign in using the same email magic link or OAuth provider you used on the web."
            items={['No separate registration - your web account works directly', 'After sign-in, the app loads your dashboard, trades, journal, and challenges', 'Push notifications are enabled by default for trade alerts']}
          />
          <DocsInfoCard
            icon={<HugeiconsIcon icon={SmartPhone01Icon} strokeWidth={1.5} color="currentColor" />}
            title="Mobile navigation"
            description="The mobile app uses bottom tab navigation: Dashboard, Trades, Journal, Challenges, and More. All data is synced from the same Supabase backend."
            items={['Dashboard tab: KPI summary and charts optimized for mobile', 'Trades tab: searchable trade list with filters', 'Journal tab: voice-to-text journaling and day review', 'Challenges tab: prop-firm challenge tracking', 'More tab: settings, AI chat, and support']}
          />
        </DocsCardGrid>
      </DocsSection>

      <DocsSection title="7. Next steps">
        <p>
          With trades imported and both platforms set up,           explore the deeper features JJI
          has for trade analysis and improvement.
        </p>
        <DocsCardGrid>
          <DocsInfoCard
            icon={<HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={1.5} color="currentColor" />}
            title="Journal & trade review"
            description="Open the journal to add notes and screenshots to each trading day. Use the calendar to navigate between days and review individual trades."
            items={['Attach screenshots with automatic cropping', 'Tag trades with custom labels for later filtering', 'Voice-to-text journaling available on mobile']}
          />
          <DocsInfoCard
            icon={<HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={1.5} color="currentColor" />}
            title="Prop-firm challenges"
            description="Track prop-firm challenge progress: set up challenge accounts, monitor rule compliance (profit targets, drawdown limits, trading days), and manage payouts."
            items={['Configure challenge rules per firm', 'Live tracking of profit targets and max drawdown', 'Phase transition logging (simulated → funded → payout)']}
          />
          <DocsInfoCard
            icon={<HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={1.5} color="currentColor" />}
            title="AI chat & insights"
            description="Chat with the AI assistant to analyze your trading data. Ask questions like 'What is my win rate this month?' or 'Show me my worst trades by R multiple.'"
            items={['Natural language queries over your trade data', 'Risk audits and strategy performance reviews', 'Pattern detection for common mistakes']}
          />
          <DocsInfoCard
            icon={<HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={1.5} color="currentColor" />}
            title="Reports & backtesting"
            description="Generate detailed analytics reports with chart views and shareable links. Use the backtesting module to test strategies against historical trade data."
            items={['Export reports as PDF or share via public link', 'Backtesting supports custom entry/exit rules', 'Playbook builder for documenting and reusing trade setups']}
          />
        </DocsCardGrid>
      </DocsSection>

      <DocsCallout title="First-run checklist" tone="success">
        <ul>
          <li>Sign in with email magic link or OAuth and confirm you reach the dashboard.</li>
          <li>Complete the subscription payment in Settings → Subscription.</li>
          <li>Import at least one set of trades via CSV, webhook, or sync source.</li>
          <li>Verify KPI cards and widgets reflect your imported data.</li>
          <li>Set your timezone, theme, and break-even threshold in Settings.</li>
          <li>Download and sign in to the mobile app on your phone.</li>
          <li>Open the journal and add a note to your first trading day.</li>
          <li>Explore one bonus feature: AI chat, prop-firm tracking, or backtesting.</li>
        </ul>
      </DocsCallout>
    </DocsPage>
  )
}
