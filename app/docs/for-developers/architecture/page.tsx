import { DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'

export default function ArchitectureDocsPage() {
  return (
    <DocsPage
      badge="For Developers"
      title="Architecture"
      description="JJI is organized around stable product systems: public support surfaces, an authenticated dashboard shell, shared UI primitives, server-owned analytics, and a companion mobile app."
    >
      <DocsSection title="System boundaries">
        <ul>
          <li><strong>Public layer:</strong> Landing page, docs, feedback - share a coherent shell without requiring authentication</li>
          <li><strong>Dashboard shell:</strong> Sidebar, navbar, filters, command palette, quick-add - the shared authenticated workspace</li>
          <li><strong>Analytics engine:</strong> Server-side data aggregation powers dashboard, reports, and journal</li>
          <li><strong>Mobile app:</strong> Flutter client consuming the same backend via REST APIs and Supabase Realtime</li>
        </ul>
      </DocsSection>

      <DocsSection title="Data flow">
        <p>User data flows through a consistent pipeline:</p>
        <ol>
          <li>User imports trades via the import system (file upload, webhook, broker sync)</li>
          <li>Data is stored in PostgreSQL via Prisma, scoped to the user</li>
          <li>Server-side aggregation computes metrics (P&amp;L, win rate, drawdown, etc.)</li>
          <li>Dashboard and reports render from server-provided aggregations</li>
          <li>Filters modify aggregation scope without re-fetching raw data</li>
        </ol>
      </DocsSection>

      <DocsSection title="Web-mobile architecture">
        <p>The mobile app (Flutter) and web app (Next.js) share:</p>
        <ul>
          <li>Same PostgreSQL database via Supabase</li>
          <li>Same authentication provider (Supabase Auth)</li>
          <li>Same REST API v1 endpoints</li>
          <li>Real-time updates via Supabase Realtime channels</li>
        </ul>
        <p>Each client renders its own UI layer independently.</p>
      </DocsSection>
    </DocsPage>
  )
}
