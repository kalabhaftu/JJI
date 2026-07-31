import { BookOpenText, LayoutDashboard, Smartphone, Upload } from 'lucide-react'

import {
  DocsCardGrid,
  DocsInfoCard,
  DocsLinkList,
  DocsPage,
  DocsSection,
} from '@/components/docs/docs-page'

export default function DocsHome() {
  return (
    <DocsPage
      badge="Documentation"
      title="JJI Knowledge Base"
      description="Complete guides for the JJI trading analytics platform - covering the web dashboard and the companion mobile app for Android and iOS."
    >
      <DocsSection
        title="Start here"
        description="New to JJI? Begin with the onboarding path below."
      >
        <DocsLinkList
          links={[
            {
              href: '/docs/getting-started',
              label: 'Quick Start Guide',
              description: 'Sign up, import your first trades, configure your dashboard, and set up the mobile app - all in one walkthrough.',
            },
            {
              href: '/docs/features/app-flow',
              label: 'Application Flow',
              description: 'Understand how the web dashboard, mobile app, authentication, and support pages connect.',
            },
            {
              href: '/docs/faq',
              label: 'FAQ & Troubleshooting',
              description: 'Browse common questions about pricing, data, imports, account management, and mobile sync.',
            },
          ]}
        />
      </DocsSection>

      <DocsSection
        title="Platforms"
        description="JJI is available on web and mobile. Both platforms share the same backend and data."
      >
        <DocsCardGrid>
          <DocsInfoCard
            icon={LayoutDashboard}
            title="Web Dashboard"
            description="The full-featured web application built with Next.js. Access all analytics, journaling, prop-firm tracking, backtesting, AI chat, reports, and settings from any browser."
            items={['Desktop-first responsive design', 'PWA installable for offline support', 'Real-time updates via Supabase', 'All features available']}
          />
          <DocsInfoCard
            icon={Smartphone}
            title="Mobile App (Android & iOS)"
            description="Native Flutter app for on-the-go trade review. Syncs with your web account automatically."
            items={['Dashboard, trades, journal, and prop-firm views', 'Push notifications for alerts and reminders', 'Speech-to-text journaling', 'Available on Android and iOS via app stores']}
          />
        </DocsCardGrid>
      </DocsSection>

      <DocsSection
        title="Core features"
        description="Every feature is documented step by step. Pick the one you need."
      >
        <DocsCardGrid className="lg:grid-cols-3">
          <DocsInfoCard
            icon={Upload}
            title="Trade Import"
            description="Import trades from broker exports, CSV files, TradingView webhooks, Thor, Match-Trader, Exness, and other supported CSV formats."
            items={['Supported file formats and webhook sources', 'Parsing review before saving', 'Direct broker sync marked under development']}
          />
          <DocsInfoCard
            icon={LayoutDashboard}
            title="Dashboard & Widgets"
            description="Customizable dashboard with KPI cards, charts, calendar views, and filter-aware widgets."
            items={['Widget grid with drag-and-drop', 'Dashboard templates', 'Filter scoping']}
          />
          <DocsInfoCard
            icon={BookOpenText}
            title="Journal & Trade Review"
            description="Daily journal entries, trade notes, screenshots, and calendar-connected review flows."
            items={['Day-level journaling', 'Image previews and cropping', 'Calendar-to-day review modal']}
          />
        </DocsCardGrid>
      </DocsSection>

      <DocsSection
        title="Quick navigation"
        description="Direct links to the most commonly referenced guides."
      >
        <DocsLinkList
          links={[
            {
              href: '/docs/features/importing',
              label: 'Importing Trades',
              description: 'Step-by-step import tutorial with all supported sources.',
            },
            {
              href: '/docs/features/dashboard',
              label: 'Dashboard Reference',
              description: 'KPIs, widget editing, filters, templates, and calendar behavior.',
            },
            {
              href: '/docs/features/prop-firm',
              label: 'Prop Firm Tracking',
              description: 'Challenge lifecycles, phase transitions, and payout management.',
            },
            {
              href: '/docs/features/ai-chat',
              label: 'AI Chat & Insights',
              description: 'AI-powered trade analysis, risk audits, and strategy reviews.',
            },
            {
              href: '/docs/features/reports',
              label: 'Reports & Sharing',
              description: 'Analytics reports, chart views, and public share links.',
            },
          ]}
        />
      </DocsSection>

      <DocsSection
        title="Developer documentation"
        description="For developers interested in understanding the architecture, tech stack, and contribution guidelines."
      >
        <DocsCardGrid>
          <DocsInfoCard
            icon={LayoutDashboard}
            title="Tech Stack & Architecture"
            description="Next.js, TypeScript, Flutter, Supabase, PostgreSQL, and more. Learn how the platform is built."
          />
          <DocsInfoCard
            icon={Smartphone}
            title="Mobile App Architecture"
            description="Flutter/Dart codebase, Riverpod state management, go_router navigation, and Supabase integration."
          />
        </DocsCardGrid>
      </DocsSection>
    </DocsPage>
  )
}
