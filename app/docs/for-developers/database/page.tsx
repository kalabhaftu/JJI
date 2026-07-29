import { Database, Group, Shield } from 'lucide-react'
import { DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'

export default function DatabaseDocsPage() {
  return (
    <DocsPage
      badge="For Developers"
      title="Data Model Principles"
      description="Core data domains and design rules that govern the JJI data model."
    >
      <DocsSection title="Core domains">
        <ul>
          <li><strong>Users &amp; Auth:</strong> User accounts, authentication providers, sessions</li>
          <li><strong>Accounts:</strong> Live accounts, master accounts (prop-firm), phase accounts</li>
          <li><strong>Trades:</strong> Trade records with P&amp;L, instruments, timestamps, tags</li>
          <li><strong>Journal:</strong> Daily notes, trade notes, screenshots, emotions</li>
          <li><strong>Prop Firm:</strong> Challenge phases, objectives, payouts, breach records</li>
          <li><strong>Dashboard:</strong> Widget configurations, templates, filter states</li>
          <li><strong>Goals:</strong> Goal definitions and progress tracking</li>
          <li><strong>Notifications:</strong> Notification records and delivery state</li>
        </ul>
      </DocsSection>

      <DocsSection title="Key design rules">
        <ul>
          <li>All data is user-scoped — tables enforce a <code>user_id</code> foreign key constraint and tenant isolation</li>
          <li>Server-side metric aggregations reduce client bundle size and latency</li>
          <li>Timestamps are stored in UTC and formatted using date-fns-tz in the user&apos;s configured timezone</li>
          <li>Database migrations and schema definitions are managed using <strong>Drizzle ORM</strong> and <code>drizzle-kit</code></li>
          <li>Foreign key relations use cascading deletes or explicit cleanup hooks in maintenance services</li>
        </ul>
      </DocsSection>
    </DocsPage>
  )
}
