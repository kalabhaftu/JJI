import { DatabaseZap, Gauge, Layers3 } from 'lucide-react'
import { DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'

export default function PrismaOptimizationDocsPage() {
  return (
    <DocsPage
      badge="For Developers"
      title="Prisma Optimization"
      description="Approach to keeping database queries fast and analytics responsive."
    >
      <DocsSection title="Optimization principles">
        <ul>
          <li><strong>Server-side aggregation:</strong> Compute metrics close to the data source (PostgreSQL) rather than fetching raw rows and aggregating in the client</li>
          <li><strong>Read-optimized:</strong> The dashboard and reports are read-heavy. Queries are optimized for these paths.</li>
          <li><strong>Intentional query shape:</strong> Use reusable aggregation helpers instead of ad-hoc calculations</li>
          <li><strong>Selective includes:</strong> Use Prisma's <code>include</code> and <code>select</code> carefully to avoid overfetching</li>
        </ul>
      </DocsSection>

      <DocsSection title="Common patterns">
        <ul>
          <li>Batch loading for trade lists</li>
          <li>Cached aggregation results for KPI computations</li>
          <li>Indexed columns for frequently filtered fields (user_id, account_id, date)</li>
          <li>Paginated queries for trade tables using cursor-based pagination</li>
        </ul>
      </DocsSection>
    </DocsPage>
  )
}
