import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowRight01Icon,
  BookOpen01Icon,
  DashboardSquare01Icon,
  Shield01Icon,
  SmartPhone01Icon,
} from '@hugeicons/core-free-icons'
import { DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'

export default function AppFlowDocsPage() {
  return (
    <DocsPage
      badge="Feature Guide"
      title="Application Flow"
      description="JJI has two major surfaces - a public support/docs experience and an authenticated trading workspace - with a companion mobile app that mirrors the same backend."
    >
      <DocsSection title="1. Public surface & authentication flow">
        <p>
          Unauthenticated users land on the public surface: the landing page, documentation, feedback
          form, FAQ, and donation page. All public pages share a common header that displays a
          context-aware primary action - <strong>Sign In</strong> when no session is active, or
          <strong>Back to App</strong> (pointing to <code>/dashboard</code>) when a session exists.
        </p>
        <DocsCardGrid>
          <DocsInfoCard
            icon={<HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} color="currentColor" />}
            title="Magic link sign-in"
            description="The user enters their email and receives a one-time link. Clicking it creates or resumes a Supabase session. The browser redirects to /dashboard with a persistent cookie."
            items={['No password database to compromise', 'Session lasts up to 30 days of inactivity before requiring re-auth', 'Works across devices - sign in on mobile with the same email']}
          />
          <DocsInfoCard
            icon={<HugeiconsIcon icon={Shield01Icon} strokeWidth={2} color="currentColor" />}
            title="OAuth & session restoration"
            description="OAuth via Google, GitHub, or Discord redirects to the provider, then back with an access token. Session tokens are stored in an HTTP-only cookie and refreshed automatically by Supabase."
            items={['OAuth identity is linked to the workspace on first login', 'Cold opens (e.g. installed PWA, browser restart) restore the session silently', 'Sign-out clears the client-side session; data remains on the server']}
          />
        </DocsCardGrid>
      </DocsSection>

      <DocsSection title="2. Web dashboard shell">
        <p>
          After authentication, the user enters the dashboard shell - the primary workspace for all
          trading analytics. The shell provides consistent navigation, global filters, and a command
          palette that follows the user across every page.
        </p>
        <DocsCardGrid>
          <DocsInfoCard
            icon={<HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} color="currentColor" />}
            title="Sidebar & navbar"
            description="The left sidebar lists all major sections: Dashboard, Reports, Trades, Journal, Playbook, Accounts, Backtesting, Data, Challenges, and Settings. The top navbar includes global search, quick-add (trade, journal entry, account), notifications, and the user menu."
            items={['Sidebar collapses to icons on smaller viewports', 'Navbar breadcrumbs show the current page context', 'Quick-add buttons open inline modals without leaving the current page']}
          />
          <DocsInfoCard
            icon={<HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} color="currentColor" />}
            title="Filters & command palette"
            description="The filter bar sits below the navbar and controls data scoping across dashboard, trades, reports, and journal views. The command palette (<kbd>Cmd+K</kbd>) provides keyboard-driven navigation and actions."
            items={['Account, date range, symbol, strategy, and tag filters', 'Filter presets can be saved and shared across sessions', 'Command palette: type to search pages, jump to trades, or run actions']}
          />
          <DocsInfoCard
            icon={<HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} color="currentColor" />}
            title="Routing model"
            description="Authenticated routes follow a flat hierarchy under /dashboard/*. Each section is a separate route: /dashboard, /dashboard/reports, /dashboard/trades, /dashboard/journal, etc. Public routes (/docs/*, /faq, /feedback) remain accessible without auth."
            items={['Public CTA changes to "Back to App" when a session is detected', '/dashboard is the post-auth landing and the primary app entry point', 'Direct navigation to a protected route redirects to sign-in if unauthenticated']}
          />
        </DocsCardGrid>
      </DocsSection>

      <DocsSection title="3. Mobile app navigation & sync">
        <p>
          The Flutter mobile app mirrors the web dashboard's data model but uses a touch-optimized
          interface with bottom tab navigation. It connects to the same Supabase backend and shares
          the same PostgreSQL database, user-scoped row-level security, and real-time subscriptions.
        </p>
        <DocsCardGrid>
          <DocsInfoCard
            icon={<HugeiconsIcon icon={SmartPhone01Icon} strokeWidth={2} color="currentColor" />}
            title="Bottom tab structure"
            description="Five tabs: Dashboard (KPI summary and mini-charts), Trades (paginated trade list with symbol/date/strategy filters), Journal (day-level journaling with voice-to-text), Challenges (prop-firm tracking), and More (settings, AI chat, support, subscription)."
            items={['Tabs persist their scroll position when switching', 'Pull-to-refresh triggers a data sync from Supabase', 'Push notifications surface trade alerts and daily reminders']}
          />
          <DocsInfoCard
            icon={<HugeiconsIcon icon={SmartPhone01Icon} strokeWidth={2} color="currentColor" />}
            title="Real-time sync"
            description="Both platforms subscribe to the same Supabase channels. A trade imported on the web appears in the mobile app within milliseconds. Changes to settings, journal entries, or challenge progress sync automatically."
            items={['Supabase Realtime pushes row-level changes to active clients', 'Offline-capable reads from a local cache when connectivity is intermittent', 'Conflicts are last-write-wins; the same user cannot create conflicting edits']}
          />
          <DocsInfoCard
            icon={<HugeiconsIcon icon={SmartPhone01Icon} strokeWidth={2} color="currentColor" />}
            title="Cross-platform consistency"
            description="The mobile app renders the same computed metrics (win rate, profit factor, Sharpe ratio, etc.) as the web dashboard because they derive from the same trade data and server-side calculations."
            items={['Filter scoping works identically: account, date, symbol, strategy', 'Journal images are uploaded to Supabase Storage and accessible from both platforms', 'AI chat history is shared; conversations started on one device appear on the other']}
          />
        </DocsCardGrid>
      </DocsSection>

      <DocsSection title="4. Typical review workflow">
        <p>
          Most users follow a repeatable loop: import fresh trades, review performance on the
          dashboard, journal the trading day, generate reports, and adjust their approach. The
          platform is designed to minimize friction between each step.
        </p>
        <DocsCardGrid>
          <DocsInfoCard
            icon={<HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} color="currentColor" />}
            title="Import → Dashboard"
            description="Trades are imported via CSV, webhook, or sync source. The import confirmation screen links directly to the dashboard so the user can immediately see updated KPIs."
            items={['Bulk imports process in the background; the dashboard polls for completion', 'New trades are tagged with the current date as the import date', 'Duplicate detection prevents re-importing the same trade']}
          />
          <DocsInfoCard
            icon={<HugeiconsIcon icon={BookOpen01Icon} strokeWidth={2} color="currentColor" />}
            title="Dashboard → Journal"
            description="From the dashboard calendar, click a trading day to open the day review modal. The journal tab shows all notes, screenshots, and tags attached to that day."
            items={['Calendar heatmap colors days by P&L intensity', 'Day review modal includes the trade list for that day', 'Journal entries can reference specific trades or the day as a whole']}
          />
          <DocsInfoCard
            icon={<HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} color="currentColor" />}
            title="Journal → Reports"
            description="After journaling, users often generate reports to share or reflect. Reports aggregate filtered trade data into shareable analytics views."
            items={['Reports include equity curve, drawdown chart, monthly P&L, and trade distribution', 'Reports can be exported as PDF or shared via a public link', 'Report parameters inherit the current filter scope']}
          />
          <DocsInfoCard
            icon={<HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} color="currentColor" />}
            title="Reports → Adjust"
            description="Based on report insights, users tune their strategy, update their playbook, or revisit settings. The playbook builder documents setups, rules, and tagged examples."
            items={['Playbook entries can link to specific trades as reference examples', 'Strategy tags on trades feed into filterable strategy performance views', 'Settings changes (e.g. break-even threshold) reclassify existing trade outcomes retroactively']}
          />
        </DocsCardGrid>
      </DocsSection>

      <DocsSection title="5. Routing expectations">
        <ul>
          <li>Public CTA when signed out: <strong>Sign In</strong></li>
          <li>Public CTA when signed in: <strong>Back to App</strong> → <code>/dashboard</code></li>
          <li>Primary authenticated destination: <code>/dashboard</code></li>
          <li>Support pages (<code>/docs/*</code>, <code>/faq</code>, <code>/feedback</code>) remain public and do not require an account</li>
          <li>Direct access to <code>/dashboard/*</code> without a session redirects to the sign-in page</li>
          <li>Mobile deep links follow the same routing: <code>jji://dashboard</code> opens the dashboard tab</li>
        </ul>
      </DocsSection>
    </DocsPage>
  )
}
