import { Database, ShieldCheck, Workflow } from 'lucide-react'
import { DocsCardGrid, DocsInfoCard, DocsPage, DocsSection } from '@/components/docs/docs-page'

export default function BackendDocsPage() {
  return (
    <DocsPage
      badge="For Developers"
      title="Backend Structure"
      description="The JJI backend is primarily server-side, handling data aggregation, filtering, authentication, and analytics computations."
    >
      <DocsSection title="API architecture">
        <ul>
          <li><strong>Route handlers:</strong> Next.js App Router route handlers in <code>app/api/</code></li>
          <li><strong>API versioning:</strong> v1 API under <code>app/api/v1/</code></li>
          <li><strong>Server utilities:</strong> Shared server logic in <code>server/</code> directory</li>
          <li><strong>Authentication:</strong> Edge middleware in <code>proxy.ts</code> for auth checks</li>
        </ul>
      </DocsSection>

      <DocsSection title="Key backend responsibilities">
        <ul>
          <li>Dashboard data aggregation and filtering</li>
          <li>Report generation and analytics computation</li>
          <li>User-scoped data isolation (one user never sees another's data)</li>
          <li>Trade import parsing and validation</li>
          <li>Prop-firm phase evaluation and tracking</li>
          <li>Background jobs via Vercel Cron (daily maintenance, phase evaluation, subscription checks)</li>
        </ul>
      </DocsSection>

      <DocsSection title="Security">
        <ul>
          <li>Row-Level Security (RLS) via Supabase for database-level user isolation</li>
          <li>Server-side auth enforcement in all route handlers</li>
          <li>Rate limiting on API endpoints</li>
          <li>CSP headers configured in security.config.js</li>
        </ul>
      </DocsSection>
    </DocsPage>
  )
}
