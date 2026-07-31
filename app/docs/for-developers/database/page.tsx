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
          <li>All data is user-scoped - every table includes a user_id foreign key</li>
          <li>Soft deletes where possible for audit trail</li>
          <li>Aggregation happens server-side, not in the client</li>
          <li>Timestamps are stored in UTC, converted to user timezone at render</li>
          <li>Database migrations are managed through Prisma</li>
        </ul>
      </DocsSection>
    </DocsPage>
  )
}
