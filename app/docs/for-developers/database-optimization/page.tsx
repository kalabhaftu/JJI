import { DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'
import { HugeiconsIcon } from '@hugeicons/react'
import { FlashIcon, GaugeIcon } from '@hugeicons/core-free-icons'

export default function DatabaseOptimizationDocsPage() {
  return (
    <DocsPage
      badge="For Developers"
      title="Database & Query Optimization"
      description="Design strategies and performance patterns used with Drizzle ORM and PostgreSQL for low-latency trading analytics."
    >
      <DocsSection title="Query Principles">
        <ul>
          <li>
            <strong>Server-Side Aggregations:</strong> Compute KPIs, P&amp;L metrics, and equity curve statistics directly in PostgreSQL queries using Drizzle expression helpers rather than pulling thousands of raw trade records to the Node runtime.
          </li>
          <li>
            <strong>Strict Column Selection:</strong> Use explicit Drizzle select schemas (<code>db.select({`{ id: schema.trades.id, pnl: schema.trades.netPnl }`})</code>) to avoid pulling unneeded text fields, journal body blobs, or screenshot URLs during fast dashboard overview renders.
          </li>
          <li>
            <strong>User-Scoped Compound Indexes:</strong> Primary query paths filter by <code>user_id</code> along with <code>account_id</code>, <code>opened_at</code>, or <code>status</code>. Database migrations maintain compound indexes on <code>(user_id, opened_at)</code> and <code>(user_id, account_id)</code>.
          </li>
          <li>
            <strong>Unified Caching:</strong> Frequently accessed aggregation totals and user account configurations leverage Upstash Redis caching with explicit tag invalidation on trade imports or edits.
          </li>
        </ul>
      </DocsSection>

      <DocsSection title="Drizzle ORM Performance Patterns">
        <DocsCardGrid>
          <DocsInfoCard
            icon={<HugeiconsIcon icon={FlashIcon} strokeWidth={2} color="currentColor" />}
            title="Batch Loading & Relational Queries"
            description="Fetch related trades, tags, and account records in single database roundtrips using Drizzle's relational query API or batch statement execution."
            items={[
              'Prevents N+1 query overhead on trade tables',
              'Reduces database connection pool exhaustion under load',
              'Ensures consistent execution plans across environment scales',
            ]}
          />
          <DocsInfoCard
            icon={<HugeiconsIcon icon={GaugeIcon} strokeWidth={2} color="currentColor" />}
            title="Prepared Statements & Cache Versioning"
            description="Use prepared parameter queries for high-throughput API endpoints and increment cache versioning counters to invalidate stale dashboard metrics."
            items={[
              'Lowers query parse and plan overhead on PostgreSQL',
              'Sub-second dashboard loading across large trade histories',
              'Atomic cache invalidation on trade insertion or deletion',
            ]}
          />
        </DocsCardGrid>
      </DocsSection>

      <DocsSection title="Database Maintenance & Background Cleaning">
        <p>
          Heavy maintenance tasks — such as cleaning expired import jobs, purging orphaned storage files, and recalculating daily performance anchors — are executed asynchronously in background jobs via <strong>Inngest</strong>.
        </p>
      </DocsSection>
    </DocsPage>
  )
}
